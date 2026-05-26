const createHttpError = require("../utils/httpError");

const ensureInventory = async (tx, warehouseId, productId) => {
  const inventory = await tx.inventory.findUnique({
    where: {
      warehouseId_productId: {
        warehouseId,
        productId,
      },
    },
  });

  if (!inventory) {
    throw createHttpError(404, "Inventory record not found", {
      warehouseId,
      productId,
    });
  }

  return inventory;
};

const getOrCreateInventory = async (tx, warehouseId, productId) =>
  tx.inventory.upsert({
    where: {
      warehouseId_productId: {
        warehouseId,
        productId,
      },
    },
    update: {},
    create: {
      warehouseId,
      productId,
      quantity: 0,
      reservedQuantity: 0,
    },
  });

const assertAvailableQuantity = (inventory, quantity) => {
  const availableQuantity = inventory.quantity - inventory.reservedQuantity;

  if (availableQuantity < quantity) {
    throw createHttpError(409, "Insufficient inventory", {
      warehouseId: inventory.warehouseId,
      productId: inventory.productId,
      availableQuantity,
      requestedQuantity: quantity,
    });
  }
};

const createInventoryTransaction = (tx, data) =>
  tx.inventoryTransaction.create({
    data,
  });

const increaseInventory = async (
  tx,
  {
    warehouseId,
    productId,
    userId,
    quantity,
    type,
    referenceType,
    referenceId,
    note,
  }
) => {
  const inventory = await getOrCreateInventory(tx, warehouseId, productId);
  const beforeQuantity = inventory.quantity;
  const afterQuantity = beforeQuantity + quantity;

  await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      quantity: afterQuantity,
    },
  });

  await createInventoryTransaction(tx, {
    warehouseId,
    productId,
    userId,
    type,
    quantity,
    beforeQuantity,
    afterQuantity,
    referenceType,
    referenceId,
    note,
  });
};

const decreaseInventory = async (
  tx,
  {
    warehouseId,
    productId,
    userId,
    quantity,
    type,
    referenceType,
    referenceId,
    note,
  }
) => {
  const inventory = await ensureInventory(tx, warehouseId, productId);
  assertAvailableQuantity(inventory, quantity);

  const beforeQuantity = inventory.quantity;
  const afterQuantity = beforeQuantity - quantity;

  await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      quantity: afterQuantity,
    },
  });

  await createInventoryTransaction(tx, {
    warehouseId,
    productId,
    userId,
    type,
    quantity,
    beforeQuantity,
    afterQuantity,
    referenceType,
    referenceId,
    note,
  });
};

const reserveInventory = async (
  tx,
  { warehouseId, productId, userId, quantity, referenceType, referenceId, note }
) => {
  const inventory = await ensureInventory(tx, warehouseId, productId);
  assertAvailableQuantity(inventory, quantity);

  const beforeQuantity = inventory.reservedQuantity;
  const afterQuantity = beforeQuantity + quantity;

  await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      reservedQuantity: afterQuantity,
    },
  });

  await createInventoryTransaction(tx, {
    warehouseId,
    productId,
    userId,
    type: "ONLINE_ORDER_RESERVE",
    quantity,
    beforeQuantity,
    afterQuantity,
    referenceType,
    referenceId,
    note,
  });
};

const releaseReservedInventory = async (
  tx,
  { warehouseId, productId, userId, quantity, referenceType, referenceId, note }
) => {
  const inventory = await ensureInventory(tx, warehouseId, productId);

  if (inventory.reservedQuantity < quantity) {
    throw createHttpError(409, "Reserved inventory is lower than requested quantity", {
      warehouseId,
      productId,
      reservedQuantity: inventory.reservedQuantity,
      requestedQuantity: quantity,
    });
  }

  const beforeQuantity = inventory.reservedQuantity;
  const afterQuantity = beforeQuantity - quantity;

  await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      reservedQuantity: afterQuantity,
    },
  });

  await createInventoryTransaction(tx, {
    warehouseId,
    productId,
    userId,
    type: "CANCEL_RELEASE",
    quantity,
    beforeQuantity,
    afterQuantity,
    referenceType,
    referenceId,
    note,
  });
};

const consumeReservedInventory = async (
  tx,
  { warehouseId, productId, userId, quantity, referenceType, referenceId, note }
) => {
  const inventory = await ensureInventory(tx, warehouseId, productId);

  if (inventory.reservedQuantity < quantity || inventory.quantity < quantity) {
    throw createHttpError(409, "Cannot consume reserved inventory", {
      warehouseId,
      productId,
      quantity: inventory.quantity,
      reservedQuantity: inventory.reservedQuantity,
      requestedQuantity: quantity,
    });
  }

  const beforeQuantity = inventory.quantity;
  const afterQuantity = beforeQuantity - quantity;

  await tx.inventory.update({
    where: { id: inventory.id },
    data: {
      quantity: afterQuantity,
      reservedQuantity: inventory.reservedQuantity - quantity,
    },
  });

  await createInventoryTransaction(tx, {
    warehouseId,
    productId,
    userId,
    type: "ONLINE_ORDER_OUT",
    quantity,
    beforeQuantity,
    afterQuantity,
    referenceType,
    referenceId,
    note,
  });
};

module.exports = {
  increaseInventory,
  decreaseInventory,
  reserveInventory,
  releaseReservedInventory,
  consumeReservedInventory,
};
