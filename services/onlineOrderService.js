const prisma = require("../config/db");
const generateCode = require("../utils/codeGenerator");
const createHttpError = require("../utils/httpError");
const { toInt, toMoney, toNumber } = require("../utils/number");
const {
  consumeReservedInventory,
  increaseInventory,
  releaseReservedInventory,
  reserveInventory,
} = require("./inventoryService");

const RESERVED_STATUSES = new Set([
  "PENDING",
  "CONFIRMED",
  "PROCESSING",
  "PREPARING",
]);
const CONSUMED_STATUSES = new Set(["SHIPPING", "COMPLETED", "RETURNED"]);

const asTrimmedString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const normalizeStatusToken = (value) =>
  value === undefined || value === null
    ? ""
    : String(value).trim().replace(/[\s-]+/g, "_").toUpperCase();

const ORDER_STATUS_ALIASES = {
  PENDING: "PENDING",
  WAITING: "PENDING",
  CONFIRMED: "CONFIRMED",
  PACKING: "PREPARING",
  PREPARING: "PREPARING",
  PROCESSING: "PROCESSING",
  SHIPPING: "SHIPPING",
  SHIPPED: "SHIPPING",
  DELIVERED: "COMPLETED",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
  RETURNED: "RETURNED",
};

const normalizeOrderStatusCode = (value) => {
  const token = normalizeStatusToken(value);
  return ORDER_STATUS_ALIASES[token] || token;
};

const getDefaultPaymentMethod = async (tx) => {
  const paymentMethod = await tx.paymentMethod.findFirst({
    where: {
      code: "COD",
      status: "ACTIVE",
    },
  });

  if (!paymentMethod) {
    throw createHttpError(400, "Default COD payment method not found");
  }

  return paymentMethod;
};

const getPaymentMethod = async (tx, payload) => {
  if (payload.paymentMethodId) {
    return tx.paymentMethod.findUnique({
      where: { id: toInt(payload.paymentMethodId, "paymentMethodId") },
    });
  }

  if (payload.paymentMethodCode) {
    return tx.paymentMethod.findUnique({
      where: { code: asTrimmedString(payload.paymentMethodCode).toUpperCase() },
    });
  }

  return getDefaultPaymentMethod(tx);
};

const resolveShippingAddress = async (tx, customerId, payload) => {
  if (payload.addressId) {
    const address = await tx.customerAddress.findFirst({
      where: {
        id: toInt(payload.addressId, "addressId"),
        userId: customerId,
      },
    });

    if (!address) {
      throw createHttpError(404, "Customer address not found");
    }

    return {
      addressId: address.id,
      receiverName: address.receiverName,
      receiverPhone: address.receiverPhone,
      shippingAddress: [
        address.line1,
        address.ward,
        address.district,
        address.city,
      ]
        .filter(Boolean)
        .join(", "),
    };
  }

  const addressPayload = payload.address || payload;
  const receiverName = asTrimmedString(addressPayload.receiverName);
  const receiverPhone = asTrimmedString(addressPayload.receiverPhone);
  const line1 = asTrimmedString(addressPayload.line1);
  const ward = asTrimmedString(addressPayload.ward);
  const district = asTrimmedString(addressPayload.district);
  const city = asTrimmedString(addressPayload.city);
  const shippingAddressText =
    asTrimmedString(addressPayload.shippingAddress) ||
    [line1, ward, district, city].filter(Boolean).join(", ");

  if (!receiverName || !receiverPhone || !shippingAddressText) {
    throw createHttpError(
      400,
      "receiverName, receiverPhone and shippingAddress/line1 are required"
    );
  }

  let createdAddress = null;

  if (payload.saveAddress || addressPayload.saveAddress) {
    if (!line1 || !city) {
      throw createHttpError(400, "line1 and city are required to save address");
    }

    const isDefault = Boolean(
      payload.isDefaultAddress || addressPayload.isDefault
    );

    if (isDefault) {
      await tx.customerAddress.updateMany({
        where: { userId: customerId },
        data: { isDefault: false },
      });
    }

    const addressCount = await tx.customerAddress.count({
      where: { userId: customerId },
    });

    createdAddress = await tx.customerAddress.create({
      data: {
        userId: customerId,
        receiverName,
        receiverPhone,
        line1,
        ward,
        district,
        city,
        isDefault: isDefault || addressCount === 0,
      },
    });
  }

  return {
    addressId: createdAddress?.id || null,
    receiverName,
    receiverPhone,
    shippingAddress: shippingAddressText,
  };
};

const calculatePromotionDiscount = async (tx, promotionCode, subtotal, orderItems) => {
  if (!promotionCode) {
    return { discountTotal: 0, promotionNote: null };
  }

  const now = new Date();
  const promotion = await tx.promotion.findUnique({
    where: { code: asTrimmedString(promotionCode).toUpperCase() },
    include: {
      products: {
        select: { productId: true },
      },
    },
  });

  if (
    !promotion ||
    promotion.status !== "ACTIVE" ||
    promotion.startAt > now ||
    promotion.endAt < now
  ) {
    throw createHttpError(400, "Promotion is not available");
  }

  const minOrderAmount = toNumber(promotion.minOrderAmount, 0);
  if (minOrderAmount > 0 && subtotal < minOrderAmount) {
    throw createHttpError(400, "Order does not meet promotion minimum amount");
  }

  const promotionProductIds = promotion.products.map((item) => item.productId);
  const discountBase =
    promotionProductIds.length > 0
      ? orderItems
          .filter((item) => promotionProductIds.includes(item.productId))
          .reduce((sum, item) => sum + item.totalPrice, 0)
      : subtotal;

  if (discountBase <= 0) {
    throw createHttpError(400, "Promotion does not apply to cart items");
  }

  let discountTotal =
    promotion.discountType === "PERCENT"
      ? (discountBase * toNumber(promotion.discountValue, 0)) / 100
      : toNumber(promotion.discountValue, 0);

  const maxDiscountAmount = toNumber(promotion.maxDiscountAmount, 0);
  if (maxDiscountAmount > 0) {
    discountTotal = Math.min(discountTotal, maxDiscountAmount);
  }

  return {
    discountTotal,
    promotionNote: `Promotion ${promotion.code}`,
  };
};

const resolvePaymentStatuses = (paymentMethod, payload) => {
  if (paymentMethod.code === "COD") {
    return {
      orderPaymentStatus: "UNPAID",
      paymentStatus: "UNPAID",
      paidAt: null,
    };
  }

  const requestedStatus = asTrimmedString(payload.paymentStatus).toUpperCase();
  const paymentStatus = ["PAID", "FAILED", "PENDING"].includes(requestedStatus)
    ? requestedStatus
    : "PENDING";

  return {
    orderPaymentStatus: paymentStatus,
    paymentStatus,
    paidAt: paymentStatus === "PAID" ? new Date() : null,
  };
};

const updateCustomerProfileForCompletedOrder = async (tx, order) => {
  await tx.customerProfile.upsert({
    where: { userId: order.customerId },
    update: {
      totalOrders: { increment: 1 },
      totalSpent: { increment: order.total },
      loyaltyPoints: { increment: Math.floor(Number(order.total || 0)) },
    },
    create: {
      userId: order.customerId,
      totalOrders: 1,
      totalSpent: order.total,
      loyaltyPoints: Math.floor(Number(order.total || 0)),
    },
  });
};

const createOnlineOrderFromCart = async (payload, actor) => {
  const customerId =
    actor.roleCode === "CUSTOMER"
      ? actor.id
      : toInt(payload.customerId || actor.id, "customerId");
  const shippingFee = toNumber(payload.shippingFee, 0);
  const manualDiscountTotal =
    actor.roleCode === "CUSTOMER" ? 0 : toNumber(payload.discountTotal, 0);

  return prisma.$transaction(async (tx) => {
    // Resolve warehouseId: use provided, or auto-pick the first available warehouse
    let warehouseId = payload.warehouseId ? toInt(payload.warehouseId, "warehouseId") : null;
    let warehouse = null;

    if (warehouseId) {
      warehouse = await tx.warehouse.findUnique({
        where: { id: warehouseId },
        select: { id: true, branchId: true },
      });
    }

    if (!warehouse) {
      // Auto-resolve: pick any active warehouse
      warehouse = await tx.warehouse.findFirst({
        select: { id: true, branchId: true },
        orderBy: { id: "asc" },
      });
    }

    if (!warehouse) {
      throw createHttpError(404, "No warehouse available");
    }

    warehouseId = warehouse.id;

    const cart = await tx.cart.findUnique({
      where: { userId: customerId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      throw createHttpError(400, "Cart is empty");
    }

    const shippingAddress = await resolveShippingAddress(tx, customerId, payload);
    const paymentMethod = await getPaymentMethod(tx, payload);

    if (!paymentMethod || paymentMethod.status !== "ACTIVE") {
      throw createHttpError(400, "Payment method is not available");
    }

    const orderItems = cart.items.map((item) => {
      const product = item.product;

      if (!product || product.status !== "ACTIVE") {
        throw createHttpError(400, "Product is not available", {
          productId: item.productId,
        });
      }

      const unitPrice = toNumber(product.salePrice, 0);

      if (unitPrice <= 0) {
        throw createHttpError(400, "Product unit price must be greater than 0", {
          productId: product.id,
        });
      }

      return {
        productId: product.id,
        productName: product.name,
        productSku: product.sku,
        productBarcode: product.barcode,
        unitPrice,
        costPrice: toNumber(product.costPrice, 0),
        quantity: item.quantity,
        totalPrice: unitPrice * item.quantity,
      };
    });

    const subtotal = orderItems.reduce((sum, item) => sum + item.totalPrice, 0);
    const promotion = await calculatePromotionDiscount(
      tx,
      payload.promotionCode,
      subtotal,
      orderItems
    );
    const discountTotal = manualDiscountTotal + promotion.discountTotal;
    const total = subtotal + shippingFee - discountTotal;

    if (total < 0) {
      throw createHttpError(400, "Order total cannot be negative");
    }

    const paymentStatuses = resolvePaymentStatuses(paymentMethod, payload);

    const onlineOrder = await tx.onlineOrder.create({
      data: {
        orderCode: payload.orderCode || generateCode("ONL"),
        customerId,
        addressId: shippingAddress.addressId,
        branchId: warehouse.branchId,
        warehouseId,
        statusCode: "PENDING",
        receiverName: shippingAddress.receiverName,
        receiverPhone: shippingAddress.receiverPhone,
        shippingAddress: shippingAddress.shippingAddress,
        note: [payload.note, promotion.promotionNote].filter(Boolean).join(" | ") || null,
        subtotal: toMoney(subtotal),
        shippingFee: toMoney(shippingFee),
        discountTotal: toMoney(discountTotal),
        total: toMoney(total),
        paymentStatus: paymentStatuses.orderPaymentStatus,
        items: {
          create: orderItems.map((item) => ({
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            productBarcode: item.productBarcode,
            unitPrice: toMoney(item.unitPrice),
            costPrice: toMoney(item.costPrice),
            quantity: item.quantity,
            totalPrice: toMoney(item.totalPrice),
          })),
        },
        logs: {
          create: {
            toStatusCode: "PENDING",
            changedById: actor.id,
            note: "Order created from cart",
          },
        },
      },
      include: {
        items: true,
        logs: true,
      },
    });

    for (const item of orderItems) {
      await reserveInventory(tx, {
        warehouseId,
        productId: item.productId,
        userId: actor.id,
        quantity: item.quantity,
        referenceType: "ONLINE_ORDER",
        referenceId: onlineOrder.id,
        note: `Reserve for online order ${onlineOrder.orderCode}`,
      });
    }

    await tx.delivery.create({
      data: {
        onlineOrderId: onlineOrder.id,
        receiverName: shippingAddress.receiverName,
        receiverPhone: shippingAddress.receiverPhone,
        shippingAddress: shippingAddress.shippingAddress,
        fee: toMoney(shippingFee),
        status: "PENDING",
      },
    });

    await tx.payment.create({
      data: {
        paymentCode: payload.paymentCode || generateCode("PAY"),
        targetType: "ONLINE_ORDER",
        targetId: onlineOrder.id,
        paymentMethodId: paymentMethod.id,
        amount: toMoney(total),
        status: paymentStatuses.paymentStatus,
        transactionCode: payload.transactionCode,
        paidAt: paymentStatuses.paidAt,
        note: payload.paymentNote,
      },
    });

    await tx.cartItem.deleteMany({
      where: {
        cartId: cart.id,
      },
    });

    return tx.onlineOrder.findUnique({
      where: { id: onlineOrder.id },
      include: {
        status: true,
        items: true,
        delivery: true,
        logs: true,
      },
    });
  });
};

const getDeliveryStatusFromOrderStatus = (statusCode) => {
  const map = {
    PENDING: "PENDING",
    CONFIRMED: "PREPARING",
    PROCESSING: "PREPARING",
    PREPARING: "PREPARING",
    SHIPPING: "SHIPPING",
    COMPLETED: "DELIVERED",
    CANCELLED: "CANCELLED",
    RETURNED: "DELIVERED",
  };

  return map[statusCode];
};

const applyInventoryForStatusTransition = async (
  tx,
  { order, nextStatusCode, actorId, note }
) => {
  if (!order.warehouseId) {
    throw createHttpError(400, "Order warehouseId is required for inventory transition");
  }

  if (order.statusCode === "CANCELLED") {
    throw createHttpError(409, "Cancelled order cannot change status");
  }

  if (nextStatusCode === "CANCELLED") {
    for (const item of order.items) {
      if (!item.productId) continue;

      if (CONSUMED_STATUSES.has(order.statusCode)) {
        await increaseInventory(tx, {
          warehouseId: order.warehouseId,
          productId: item.productId,
          userId: actorId,
          quantity: item.quantity,
          type: "RETURN_IN",
          referenceType: "ONLINE_ORDER",
          referenceId: order.id,
          note: note || `Cancel online order ${order.orderCode}`,
        });
      } else if (RESERVED_STATUSES.has(order.statusCode)) {
        await releaseReservedInventory(tx, {
          warehouseId: order.warehouseId,
          productId: item.productId,
          userId: actorId,
          quantity: item.quantity,
          referenceType: "ONLINE_ORDER",
          referenceId: order.id,
          note: note || `Release online order ${order.orderCode}`,
        });
      }
    }

    return;
  }

  if (!CONSUMED_STATUSES.has(order.statusCode) && CONSUMED_STATUSES.has(nextStatusCode)) {
    for (const item of order.items) {
      if (!item.productId) continue;

      await consumeReservedInventory(tx, {
        warehouseId: order.warehouseId,
        productId: item.productId,
        userId: actorId,
        quantity: item.quantity,
        referenceType: "ONLINE_ORDER",
        referenceId: order.id,
        note: note || `Ship online order ${order.orderCode}`,
      });

      await tx.product.update({
        where: { id: item.productId },
        data: {
          soldCount: {
            increment: item.quantity,
          },
        },
      });
    }
  }
};

const updateOnlineOrderStatus = async (onlineOrderId, payload, actor) => {
  const nextStatusCode = normalizeOrderStatusCode(
    payload.statusCode ?? payload.status ?? payload.orderStatus
  );

  if (!nextStatusCode) {
    throw createHttpError(400, "statusCode is required");
  }

  return prisma.$transaction(async (tx) => {
    const targetStatus = await tx.orderStatus.findUnique({
      where: { code: nextStatusCode },
    });

    if (!targetStatus || targetStatus.status !== "ACTIVE") {
      throw createHttpError(400, "Target order status is not available");
    }

    const order = await tx.onlineOrder.findUnique({
      where: { id: onlineOrderId },
      include: {
        status: true,
        items: true,
      },
    });

    if (!order) {
      throw createHttpError(404, "Online order not found");
    }

    if (order.statusCode === nextStatusCode) {
      if (nextStatusCode === "COMPLETED" && order.paymentStatus !== "PAID") {
        const paidAt = new Date();
        await tx.onlineOrder.update({
          where: { id: onlineOrderId },
          data: { paymentStatus: "PAID" },
        });
        await tx.payment.updateMany({
          where: {
            targetType: "ONLINE_ORDER",
            targetId: onlineOrderId,
            status: { in: ["UNPAID", "PENDING", "FAILED"] },
          },
          data: {
            status: "PAID",
            paidAt,
          },
        });
      }

      return tx.onlineOrder.findUnique({
        where: { id: onlineOrderId },
        include: {
          items: true,
          delivery: true,
        },
      });
    }

    await applyInventoryForStatusTransition(tx, {
      order,
      nextStatusCode,
      actorId: actor.id,
      note: payload.note,
    });

    const updatedOrder = await tx.onlineOrder.update({
      where: { id: onlineOrderId },
      data: {
        statusCode: nextStatusCode,
        ...(nextStatusCode === "COMPLETED" ? { paymentStatus: "PAID" } : {}),
      },
      include: {
        items: true,
        delivery: true,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        onlineOrderId,
        fromStatusCode: order.statusCode,
        toStatusCode: nextStatusCode,
        changedById: actor.id,
        note: payload.note,
      },
    });

    const deliveryStatus = getDeliveryStatusFromOrderStatus(nextStatusCode);
    if (deliveryStatus) {
      await tx.delivery.updateMany({
        where: { onlineOrderId },
        data: {
          status: deliveryStatus,
          ...(payload.carrierName !== undefined
            ? { carrierName: payload.carrierName || null }
            : {}),
          ...(payload.trackingCode !== undefined
            ? { trackingCode: payload.trackingCode || null }
            : {}),
          shippedAt: deliveryStatus === "SHIPPING" ? new Date() : undefined,
          deliveredAt: deliveryStatus === "DELIVERED" ? new Date() : undefined,
        },
      });
    }

    if (nextStatusCode === "COMPLETED" && order.statusCode !== "COMPLETED") {
      await tx.payment.updateMany({
        where: {
          targetType: "ONLINE_ORDER",
          targetId: onlineOrderId,
          status: { in: ["UNPAID", "PENDING", "FAILED"] },
        },
        data: {
          status: "PAID",
          paidAt: new Date(),
        },
      });

      await updateCustomerProfileForCompletedOrder(tx, order);
    }

    return updatedOrder;
  });
};

const cancelOnlineOrder = async (onlineOrderId, payload, actor) =>
  prisma.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findUnique({
      where: { id: onlineOrderId },
      include: {
        status: true,
        items: true,
      },
    });

    if (!order) {
      throw createHttpError(404, "Online order not found");
    }

    if (actor.roleCode === "CUSTOMER") {
      if (order.customerId !== actor.id) {
        throw createHttpError(403, "Cannot cancel another customer's order");
      }

      if (!order.status.allowCancelByCustomer) {
        throw createHttpError(403, "Customer cannot cancel this order status");
      }
    }

    await applyInventoryForStatusTransition(tx, {
      order,
      nextStatusCode: "CANCELLED",
      actorId: actor.id,
      note: payload.note,
    });

    const updatedOrder = await tx.onlineOrder.update({
      where: { id: onlineOrderId },
      data: {
        statusCode: "CANCELLED",
      },
      include: {
        items: true,
        delivery: true,
      },
    });

    await tx.orderStatusLog.create({
      data: {
        onlineOrderId,
        fromStatusCode: order.statusCode,
        toStatusCode: "CANCELLED",
        changedById: actor.id,
        note: payload.note,
      },
    });

    await tx.delivery.updateMany({
      where: { onlineOrderId },
      data: { status: "CANCELLED" },
    });

    return updatedOrder;
  });

module.exports = {
  createOnlineOrderFromCart,
  updateOnlineOrderStatus,
  cancelOnlineOrder,
};
