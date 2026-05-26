const prisma = require("../config/db");
const generateCode = require("../utils/codeGenerator");
const createHttpError = require("../utils/httpError");
const { toInt, toMoney, toNumber, toPositiveInt } = require("../utils/number");
const { increaseInventory } = require("./inventoryService");

const normalizePurchaseItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, "items must be a non-empty array");
  }

  return items.map((item, index) => ({
    productId: toInt(item.productId, `items[${index}].productId`),
    quantity: toPositiveInt(item.quantity, `items[${index}].quantity`),
    unitCost: toNumber(item.unitCost, 0),
  }));
};

const createPurchaseOrder = async (payload, actor) => {
  const supplierId = toInt(payload.supplierId, "supplierId");
  const branchId = toInt(payload.branchId, "branchId");
  const warehouseId = toInt(payload.warehouseId, "warehouseId");
  const items = normalizePurchaseItems(payload.items);

  items.forEach((item) => {
    if (item.unitCost < 0) {
      throw createHttpError(400, "unitCost cannot be negative");
    }
  });

  return prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.findUnique({
      where: { id: warehouseId },
      select: { branchId: true },
    });

    if (!warehouse || warehouse.branchId !== branchId) {
      throw createHttpError(400, "warehouseId does not belong to branchId");
    }

    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.unitCost,
      0
    );

    const purchaseOrder = await tx.purchaseOrder.create({
      data: {
        code: payload.code || generateCode("PO"),
        supplierId,
        branchId,
        warehouseId,
        createdById: actor.id,
        status: payload.status || "PENDING_APPROVAL",
        subtotal: toMoney(subtotal),
        total: toMoney(subtotal),
        note: payload.note,
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitCost: toMoney(item.unitCost),
            totalCost: toMoney(item.quantity * item.unitCost),
          })),
        },
      },
      include: {
        items: true,
      },
    });

    return purchaseOrder;
  });
};

const approvePurchaseOrder = async (purchaseOrderId, actor) =>
  prisma.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
    });

    if (!purchaseOrder) {
      throw createHttpError(404, "Purchase order not found");
    }

    if (!["DRAFT", "PENDING_APPROVAL"].includes(purchaseOrder.status)) {
      throw createHttpError(409, "Purchase order cannot be approved from current status");
    }

    return tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: "APPROVED",
        approvedById: actor.id,
        approvedAt: new Date(),
      },
      include: {
        items: true,
      },
    });
  });

const receivePurchaseOrder = async (purchaseOrderId, actor) =>
  prisma.$transaction(async (tx) => {
    const purchaseOrder = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: {
        items: true,
      },
    });

    if (!purchaseOrder) {
      throw createHttpError(404, "Purchase order not found");
    }

    if (purchaseOrder.status !== "APPROVED") {
      throw createHttpError(409, "Only approved purchase orders can be received");
    }

    for (const item of purchaseOrder.items) {
      const remainingQuantity = item.quantity - item.receivedQuantity;

      if (remainingQuantity <= 0) continue;

      await increaseInventory(tx, {
        warehouseId: purchaseOrder.warehouseId,
        productId: item.productId,
        userId: actor.id,
        quantity: remainingQuantity,
        type: "PURCHASE_IN",
        referenceType: "PURCHASE_ORDER",
        referenceId: purchaseOrder.id,
        note: `Receive purchase order ${purchaseOrder.code}`,
      });

      await tx.purchaseOrderItem.update({
        where: { id: item.id },
        data: {
          receivedQuantity: item.quantity,
        },
      });
    }

    return tx.purchaseOrder.update({
      where: { id: purchaseOrderId },
      data: {
        status: "RECEIVED",
        receivedAt: new Date(),
      },
      include: {
        items: true,
      },
    });
  });

module.exports = {
  createPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
};
