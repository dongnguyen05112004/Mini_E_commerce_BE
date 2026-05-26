const prisma = require("../config/db");
const generateCode = require("../utils/codeGenerator");
const createHttpError = require("../utils/httpError");
const { toInt, toMoney, toNumber, toPositiveInt } = require("../utils/number");
const { decreaseInventory } = require("./inventoryService");

const normalizeSaleItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, "items must be a non-empty array");
  }

  return items.map((item, index) => ({
    productId: toInt(item.productId, `items[${index}].productId`),
    quantity: toPositiveInt(item.quantity, `items[${index}].quantity`),
    unitPrice: item.unitPrice,
    discountAmount: toNumber(item.discountAmount, 0),
  }));
};

const createPosSale = async (payload, actor) => {
  const branchId = toInt(payload.branchId, "branchId");
  const warehouseId = toInt(payload.warehouseId, "warehouseId");
  const staffId = actor.id;
  const customerId =
    payload.customerId === undefined || payload.customerId === null
      ? null
      : toInt(payload.customerId, "customerId");
  const paidAmount = toNumber(payload.paidAmount, 0);
  const taxTotal = toNumber(payload.taxTotal, 0);
  const orderDiscountAmount = toNumber(payload.discountTotal || payload.discountAmount, 0);
  const normalizedItems = normalizeSaleItems(payload.items);

  return prisma.$transaction(async (tx) => {
    // Resolve payment method: accept paymentMethodId (int) or paymentMethod/paymentMethodCode (string)
    let paymentMethodId = null;
    if (payload.paymentMethodId) {
      paymentMethodId = toInt(payload.paymentMethodId, "paymentMethodId");
    } else {
      const pmCode = (payload.paymentMethod || payload.paymentMethodCode || "CASH").toUpperCase();
      const pm = await tx.paymentMethod.findFirst({
        where: {
          OR: [
            { code: pmCode },
            { code: pmCode === "CASH" ? "COD" : pmCode },
          ],
          status: "ACTIVE"
        },
        select: { id: true }
      });
      if (!pm) {
        throw createHttpError(400, `Payment method not found: ${pmCode}`);
      }
      paymentMethodId = pm.id;
    }

    const warehouse = await tx.warehouse.findUnique({
      where: { id: warehouseId },
      select: { id: true, branchId: true },
    });

    if (!warehouse || warehouse.branchId !== branchId) {
      throw createHttpError(400, "warehouseId does not belong to branchId");
    }

    if (customerId !== null) {
      const customer = await tx.user.findUnique({
        where: { id: customerId },
        select: {
          id: true,
          status: true,
          role: {
            select: { code: true },
          },
        },
      });

      if (
        !customer ||
        customer.status !== "ACTIVE" ||
        customer.role?.code !== "CUSTOMER"
      ) {
        throw createHttpError(400, "Customer account is not available");
      }
    }

    const products = await tx.product.findMany({
      where: {
        id: {
          in: normalizedItems.map((item) => item.productId),
        },
      },
    });
    const productMap = new Map(products.map((product) => [product.id, product]));

    const saleItems = normalizedItems.map((item) => {
      const product = productMap.get(item.productId);

      if (!product || product.status !== "ACTIVE") {
        throw createHttpError(400, "Product is not available", {
          productId: item.productId,
        });
      }

      const unitPrice = toNumber(item.unitPrice ?? product.salePrice, 0);

      if (unitPrice <= 0) {
        throw createHttpError(400, "Product unit price must be greater than 0", {
          productId: product.id,
        });
      }

      const grossTotal = unitPrice * item.quantity;
      const totalPrice = grossTotal - item.discountAmount;

      if (totalPrice < 0) {
        throw createHttpError(400, "Item total cannot be negative", {
          productId: product.id,
        });
      }

      return {
        product,
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productBarcode: product.barcode,
        unitPrice,
        costPrice: toNumber(product.costPrice, 0),
        quantity: item.quantity,
        discountAmount: item.discountAmount,
        totalPrice,
      };
    });

    const subtotal = saleItems.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0
    );
    const itemDiscountTotal = saleItems.reduce(
      (sum, item) => sum + item.discountAmount,
      0
    );
    const discountTotal = itemDiscountTotal + orderDiscountAmount;
    const total = subtotal - discountTotal + taxTotal;

    if (total < 0) {
      throw createHttpError(400, "Sale total cannot be negative");
    }

    if (paidAmount < total) {
      throw createHttpError(400, "paidAmount must be greater than or equal to total");
    }

    const posSale = await tx.posSale.create({
      data: {
        code: payload.code || generateCode("POS"),
        branchId,
        staffId,
        customerId,
        subtotal: toMoney(subtotal),
        discountTotal: toMoney(discountTotal),
        taxTotal: toMoney(taxTotal),
        total: toMoney(total),
        paidAmount: toMoney(paidAmount),
        changeAmount: toMoney(paidAmount - total),
        status: "COMPLETED",
        paymentStatus: "PAID",
        items: {
          create: saleItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            productBarcode: item.productBarcode,
            unitPrice: toMoney(item.unitPrice),
            costPrice: toMoney(item.costPrice),
            quantity: item.quantity,
            discountAmount: toMoney(item.discountAmount),
            totalPrice: toMoney(item.totalPrice),
          })),
        },
      },
      include: {
        items: true,
      },
    });

    await Promise.all(
      saleItems.map(async (item) => {
        await decreaseInventory(tx, {
          warehouseId,
          productId: item.productId,
          userId: staffId,
          quantity: item.quantity,
          type: "POS_SALE_OUT",
          referenceType: "POS_SALE",
          referenceId: posSale.id,
          note: `POS sale ${posSale.code}`,
        });

        await tx.product.update({
          where: { id: item.productId },
          data: {
            soldCount: {
              increment: item.quantity,
            },
          },
        });
      })
    );

    await tx.payment.create({
      data: {
        paymentCode: payload.paymentCode || generateCode("PAY"),
        targetType: "POS_SALE",
        targetId: posSale.id,
        paymentMethodId,
        amount: toMoney(total),
        status: "PAID",
        paidAt: new Date(),
        note: payload.paymentNote,
      },
    });

    if (customerId !== null) {
      await tx.customerProfile.upsert({
        where: { userId: customerId },
        update: {
          totalOrders: { increment: 1 },
          totalSpent: { increment: toMoney(total) },
          loyaltyPoints: { increment: Math.floor(total) },
        },
        create: {
          userId: customerId,
          totalOrders: 1,
          totalSpent: toMoney(total),
          loyaltyPoints: Math.floor(total),
        },
      });
    }

    return tx.posSale.findUnique({
      where: { id: posSale.id },
      include: {
        items: true,
      },
    });
  });
};

module.exports = {
  createPosSale,
};
