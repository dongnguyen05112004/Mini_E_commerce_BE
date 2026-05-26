/**
 * staffController.js
 * Implements all Staff role business logic as described in
 * Staff_User_Stories_Product_Backlog_Mart_System.txt
 *
 * US-STF-01/02/03/04/05  – POS bán hàng tại quầy
 * US-STF-06/07/08/09/10  – Xử lý đơn hàng online
 * US-STF-11              – Xem tồn kho cơ bản
 * US-STF-12              – Tra cứu sản phẩm
 * US-STF-13              – Tra cứu khách hàng
 * US-STF-14              – Ghi nhận đổi/trả hàng
 * US-STF-15              – Báo cáo ca làm việc cá nhân
 * US-STF-16              – Ghi chú xử lý đơn hàng
 */

const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const createHttpError = require("../utils/httpError");
const { toInt } = require("../utils/number");
const { increaseInventory } = require("../services/inventoryService");
const generateCode = require("../utils/codeGenerator");

/* ─────────────────────────────────────────────────────────────
   HELPER: log thay đổi trạng thái đơn hàng vào orderStatusLog
   ───────────────────────────────────────────────────────────── */
const logOrderStatus = (tx, { onlineOrderId, fromStatusCode, toStatusCode, changedById, note }) =>
  tx.orderStatusLog.create({
    data: { onlineOrderId, fromStatusCode, toStatusCode, changedById, note },
  });

/* ─────────────────────────────────────────────────────────────
   HELPER: ghi activity log cho nhân viên
   ───────────────────────────────────────────────────────────── */
const logActivity = (tx, { userId, action, entityType, entityId, req, metadata }) =>
  tx.userActivityLog.create({
    data: {
      userId,
      action,
      entityType,
      entityId,
      ipAddress: req?.ip || req?.connection?.remoteAddress,
      userAgent: req?.headers?.["user-agent"],
      metadata: metadata || {},
    },
  });

/* ═══════════════════════════════════════════════════════════
   1. POS – TÌM SẢN PHẨM (US-STF-02)
   GET /api/staff/pos/products?keyword=&warehouseId=
   ═══════════════════════════════════════════════════════════ */
const searchPosProducts = asyncHandler(async (req, res) => {
  const { keyword = "", warehouseId, limit = 20 } = req.query;
  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const term = keyword.trim();

  const where = {
    status: "ACTIVE",
    OR: [
      { name: { contains: term } },
      { sku: { contains: term } },
      { barcode: { contains: term } },
    ],
  };

  const products = await prisma.product.findMany({
    where,
    take,
    select: {
      id: true,
      name: true,
      sku: true,
      barcode: true,
      salePrice: true,
      costPrice: true,
      unit: true,
      status: true,
      inventory: warehouseId
        ? {
            where: { warehouseId: toInt(warehouseId, "warehouseId") },
            select: { quantity: true, reservedQuantity: true },
          }
        : {
            select: { quantity: true, reservedQuantity: true, warehouseId: true },
          },
    },
  });

  // Chỉ trả về sản phẩm còn hàng (tồn khả dụng > 0)
  const available = products.filter((p) => {
    const totalAvail = p.inventory.reduce(
      (sum, inv) => sum + (inv.quantity - inv.reservedQuantity),
      0
    );
    return totalAvail > 0;
  });

  res.json({ data: available });
});

/* ═══════════════════════════════════════════════════════════
   2. POS – XEM CHI TIẾT HÓA ĐƠN POS (US-STF-03/05)
   GET /api/staff/pos/sales/:id
   ═══════════════════════════════════════════════════════════ */
const getPosSaleDetail = asyncHandler(async (req, res) => {
  const saleId = toInt(req.params.id, "id");

  const sale = await prisma.posSale.findUnique({
    where: { id: saleId },
    include: {
      items: true,
      staff: { select: { id: true, fullName: true, email: true } },
      customer: { select: { id: true, fullName: true, email: true, phone: true } },
      branch: { select: { id: true, name: true, address: true } },
    },
  });

  if (!sale) {
    throw createHttpError(404, "POS sale not found");
  }

  // Staff chỉ xem hóa đơn của mình trừ khi là Admin/Manager
  if (
    req.user.roleCode === "STAFF" &&
    sale.staffId !== req.user.id
  ) {
    throw createHttpError(403, "Permission denied");
  }

  res.json({ data: sale });
});

/* ═══════════════════════════════════════════════════════════
   3. POS – DANH SÁCH HÓA ĐƠN CỦA STAFF HIỆN TẠI (US-STF-15)
   GET /api/staff/pos/my-sales?startDate=&endDate=&page=&limit=
   ═══════════════════════════════════════════════════════════ */
const getMyPosSales = asyncHandler(async (req, res) => {
  const { startDate, endDate, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = Math.min(parseInt(limit, 10) || 20, 100);

  const where = { staffId: req.user.id };

  if (startDate || endDate) {
    where.createdAt = {};
    if (startDate) where.createdAt.gte = new Date(startDate);
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);
      where.createdAt.lte = end;
    }
  }

  const [sales, total] = await Promise.all([
    prisma.posSale.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
    prisma.posSale.count({ where }),
  ]);

  res.json({ data: sales, total, page: parseInt(page, 10), limit: take });
});

/* ═══════════════════════════════════════════════════════════
   4. ĐƠN HÀNG ONLINE – DANH SÁCH (US-STF-06)
   GET /api/staff/orders?status=&page=&limit=&search=
   ═══════════════════════════════════════════════════════════ */
const getOnlineOrders = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20, search = "" } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = Math.min(parseInt(limit, 10) || 20, 100);

  const where = {};

  if (status) where.statusCode = status;

  if (search.trim()) {
    where.OR = [
      { orderCode: { contains: search.trim() } },
      { receiverName: { contains: search.trim() } },
      { receiverPhone: { contains: search.trim() } },
    ];
  }

  const [orders, total] = await Promise.all([
    prisma.onlineOrder.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: "desc" },
      include: {
        status: { select: { code: true, name: true } },
        customer: { select: { id: true, fullName: true, email: true, phone: true } },
        items: {
          select: {
            id: true,
            productName: true,
            productSku: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
          },
        },
      },
    }),
    prisma.onlineOrder.count({ where }),
  ]);

  res.json({ data: orders, total, page: parseInt(page, 10), limit: take });
});

/* ═══════════════════════════════════════════════════════════
   5. ĐƠN HÀNG ONLINE – CHI TIẾT (US-STF-06)
   GET /api/staff/orders/:id
   ═══════════════════════════════════════════════════════════ */
const getOnlineOrderDetail = asyncHandler(async (req, res) => {
  const orderId = toInt(req.params.id, "id");

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    include: {
      status: true,
      customer: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          customerProfile: true,
        },
      },
      items: {
        include: {
          product: {
            select: { id: true, sku: true, barcode: true, name: true },
          },
        },
      },
      delivery: true,
      logs: {
        orderBy: { createdAt: "desc" },
        include: { changedBy: { select: { id: true, fullName: true } } },
      },
    },
  });

  if (!order) {
    throw createHttpError(404, "Online order not found");
  }

  res.json({ data: order });
});

/* ═══════════════════════════════════════════════════════════
   6. ĐƠN HÀNG ONLINE – XÁC NHẬN (US-STF-07)
   PUT /api/staff/orders/:id/confirm
   Body: { note? }
   ═══════════════════════════════════════════════════════════ */
const confirmOnlineOrder = asyncHandler(async (req, res) => {
  const orderId = toInt(req.params.id, "id");
  const { note } = req.body;

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw createHttpError(404, "Online order not found");

    if (order.statusCode !== "PENDING") {
      throw createHttpError(400, `Cannot confirm order with status: ${order.statusCode}`);
    }

    // Kiểm tra tồn kho khả dụng trước khi xác nhận
    if (order.warehouseId) {
      for (const item of order.items) {
        if (!item.productId) continue;

        const inv = await tx.inventory.findUnique({
          where: {
            warehouseId_productId: {
              warehouseId: order.warehouseId,
              productId: item.productId,
            },
          },
        });

        const available = inv ? inv.quantity - inv.reservedQuantity : 0;
        if (available < item.quantity) {
          throw createHttpError(409, "Insufficient inventory for item", {
            productId: item.productId,
            productName: item.productName,
            available,
            requested: item.quantity,
          });
        }
      }
    }

    // Chuyển sang CONFIRMED
    const updatedOrder = await tx.onlineOrder.update({
      where: { id: orderId },
      data: { statusCode: "CONFIRMED" },
      include: { items: true, delivery: true },
    });

    await logOrderStatus(tx, {
      onlineOrderId: orderId,
      fromStatusCode: "PENDING",
      toStatusCode: "CONFIRMED",
      changedById: req.user.id,
      note: note || "Confirmed by staff",
    });

    // Cập nhật delivery
    await tx.delivery.updateMany({
      where: { onlineOrderId: orderId },
      data: { status: "PREPARING" },
    });

    await logActivity(tx, {
      userId: req.user.id,
      action: "CONFIRM_ONLINE_ORDER",
      entityType: "onlineOrder",
      entityId: orderId,
      req,
      metadata: { orderCode: order.orderCode },
    });

    return updatedOrder;
  });

  res.json({ message: "Order confirmed successfully", data: result });
});

/* ═══════════════════════════════════════════════════════════
   7. ĐƠN HÀNG ONLINE – PHIẾU CHUẨN BỊ HÀNG (US-STF-08)
   GET /api/staff/orders/:id/pick-list
   ═══════════════════════════════════════════════════════════ */
const getPickList = asyncHandler(async (req, res) => {
  const orderId = toInt(req.params.id, "id");

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          product: {
            select: { id: true, name: true, sku: true, barcode: true },
          },
        },
      },
      customer: { select: { fullName: true, phone: true } },
    },
  });

  if (!order) throw createHttpError(404, "Online order not found");

  const pickList = {
    orderId: order.id,
    orderCode: order.orderCode,
    status: order.statusCode,
    customer: order.customer,
    receiverName: order.receiverName,
    receiverPhone: order.receiverPhone,
    shippingAddress: order.shippingAddress,
    note: order.note,
    items: order.items.map((item) => ({
      productId: item.productId,
      productName: item.productName || item.product?.name,
      sku: item.productSku || item.product?.sku,
      barcode: item.productBarcode || item.product?.barcode,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    })),
  };

  res.json({ data: pickList });
});

/* ═══════════════════════════════════════════════════════════
   8. ĐƠN HÀNG ONLINE – CẬP NHẬT TRẠNG THÁI (US-STF-08/09)
   PUT /api/staff/orders/:id/status
   Body: { statusCode, note? }
   ═══════════════════════════════════════════════════════════ */
const updateOnlineOrderStatus = asyncHandler(async (req, res) => {
  const orderId = toInt(req.params.id, "id");
  const { statusCode: nextStatusCode, note } = req.body;

  if (!nextStatusCode) {
    throw createHttpError(400, "statusCode is required");
  }

  // Danh sách trạng thái staff được phép chuyển
  const STAFF_ALLOWED_TRANSITIONS = {
    CONFIRMED: ["PREPARING", "PROCESSING"],
    PREPARING: ["SHIPPING"],
    PROCESSING: ["SHIPPING"],
    SHIPPING: ["COMPLETED"],
  };

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw createHttpError(404, "Online order not found");

    const allowed = STAFF_ALLOWED_TRANSITIONS[order.statusCode] || [];
    if (!allowed.includes(nextStatusCode)) {
      throw createHttpError(
        400,
        `Cannot transition from ${order.statusCode} to ${nextStatusCode}`
      );
    }

    // Khi chuyển sang SHIPPING: tiêu thụ hàng đã giữ (consume reserved)
    if (nextStatusCode === "SHIPPING" && order.warehouseId) {
      const { consumeReservedInventory } = require("../services/inventoryService");
      for (const item of order.items) {
        if (!item.productId) continue;
        await consumeReservedInventory(tx, {
          warehouseId: order.warehouseId,
          productId: item.productId,
          userId: req.user.id,
          quantity: item.quantity,
          referenceType: "ONLINE_ORDER",
          referenceId: order.id,
          note: `Ship online order ${order.orderCode}`,
        });

        await tx.product.update({
          where: { id: item.productId },
          data: { soldCount: { increment: item.quantity } },
        });
      }
    }

    const updatedOrder = await tx.onlineOrder.update({
      where: { id: orderId },
      data: { statusCode: nextStatusCode },
      include: { items: true, delivery: true },
    });

    await logOrderStatus(tx, {
      onlineOrderId: orderId,
      fromStatusCode: order.statusCode,
      toStatusCode: nextStatusCode,
      changedById: req.user.id,
      note,
    });

    // Đồng bộ trạng thái delivery
    const DELIVERY_MAP = {
      PREPARING: "PREPARING",
      PROCESSING: "PREPARING",
      SHIPPING: "SHIPPING",
      COMPLETED: "DELIVERED",
    };
    const deliveryStatus = DELIVERY_MAP[nextStatusCode];
    if (deliveryStatus) {
      await tx.delivery.updateMany({
        where: { onlineOrderId: orderId },
        data: {
          status: deliveryStatus,
          shippedAt: deliveryStatus === "SHIPPING" ? new Date() : undefined,
          deliveredAt: deliveryStatus === "DELIVERED" ? new Date() : undefined,
        },
      });
    }

    if (nextStatusCode === "COMPLETED" && order.statusCode !== "COMPLETED") {
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
    }

    await logActivity(tx, {
      userId: req.user.id,
      action: "UPDATE_ORDER_STATUS",
      entityType: "onlineOrder",
      entityId: orderId,
      req,
      metadata: { from: order.statusCode, to: nextStatusCode },
    });

    return updatedOrder;
  });

  res.json({ message: "Order status updated", data: result });
});

/* ═══════════════════════════════════════════════════════════
   9. ĐƠN HÀNG ONLINE – HỦY ĐƠN (US-STF-10)
   PUT /api/staff/orders/:id/cancel
   Body: { reason }
   ═══════════════════════════════════════════════════════════ */
const cancelOnlineOrder = asyncHandler(async (req, res) => {
  const orderId = toInt(req.params.id, "id");
  const { reason } = req.body;

  if (!reason || !reason.trim()) {
    throw createHttpError(400, "reason is required when cancelling an order");
  }

  // Staff chỉ được hủy đơn ở các trạng thái cho phép
  const STAFF_CANCELLABLE_STATUSES = [
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "PROCESSING",
  ];
  const RESERVED_STATUSES = new Set([
    "PENDING",
    "CONFIRMED",
    "PREPARING",
    "PROCESSING",
  ]);
  const CONSUMED_STATUSES = new Set(["SHIPPING", "COMPLETED"]);

  const result = await prisma.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findUnique({
      where: { id: orderId },
      include: { items: true },
    });

    if (!order) throw createHttpError(404, "Online order not found");

    if (!STAFF_CANCELLABLE_STATUSES.includes(order.statusCode)) {
      throw createHttpError(
        400,
        `Staff cannot cancel order with status: ${order.statusCode}`
      );
    }

    // Hoàn lại tồn kho đã giữ
    if (order.warehouseId) {
      const { releaseReservedInventory, increaseInventory: addInventory } =
        require("../services/inventoryService");

      for (const item of order.items) {
        if (!item.productId) continue;

        if (RESERVED_STATUSES.has(order.statusCode)) {
          await releaseReservedInventory(tx, {
            warehouseId: order.warehouseId,
            productId: item.productId,
            userId: req.user.id,
            quantity: item.quantity,
            referenceType: "ONLINE_ORDER",
            referenceId: order.id,
            note: `Cancel release: ${reason}`,
          });
        } else if (CONSUMED_STATUSES.has(order.statusCode)) {
          await addInventory(tx, {
            warehouseId: order.warehouseId,
            productId: item.productId,
            userId: req.user.id,
            quantity: item.quantity,
            type: "RETURN_IN",
            referenceType: "ONLINE_ORDER",
            referenceId: order.id,
            note: `Cancel return: ${reason}`,
          });
        }
      }
    }

    const updatedOrder = await tx.onlineOrder.update({
      where: { id: orderId },
      data: { statusCode: "CANCELLED" },
      include: { items: true, delivery: true },
    });

    await logOrderStatus(tx, {
      onlineOrderId: orderId,
      fromStatusCode: order.statusCode,
      toStatusCode: "CANCELLED",
      changedById: req.user.id,
      note: reason,
    });

    await tx.delivery.updateMany({
      where: { onlineOrderId: orderId },
      data: { status: "CANCELLED" },
    });

    await logActivity(tx, {
      userId: req.user.id,
      action: "CANCEL_ONLINE_ORDER",
      entityType: "onlineOrder",
      entityId: orderId,
      req,
      metadata: { reason, previousStatus: order.statusCode },
    });

    return updatedOrder;
  });

  res.json({ message: "Order cancelled successfully", data: result });
});

/* ═══════════════════════════════════════════════════════════
   10. TỒN KHO – XEM CƠ BẢN (US-STF-11)
   GET /api/staff/inventory?warehouseId=&productId=&lowStock=
   ═══════════════════════════════════════════════════════════ */
const getInventory = asyncHandler(async (req, res) => {
  const { warehouseId, productId, lowStock, page = 1, limit = 50 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = Math.min(parseInt(limit, 10) || 50, 200);

  const where = {};
  if (warehouseId) where.warehouseId = toInt(warehouseId, "warehouseId");
  if (productId) where.productId = toInt(productId, "productId");

  const inventory = await prisma.inventory.findMany({
    where,
    skip,
    take,
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          barcode: true,
          status: true,
          minStock: true,
          unit: true,
        },
      },
      warehouse: { select: { id: true, name: true } },
    },
  });

  const result = inventory
    .filter((inv) => {
      if (lowStock === "true") {
        return inv.quantity <= (inv.product?.minStock ?? 0);
      }
      return true;
    })
    .map((inv) => ({
      ...inv,
      availableQuantity: inv.quantity - inv.reservedQuantity,
      isLowStock: inv.quantity <= (inv.product?.minStock ?? 0),
    }));

  res.json({ data: result });
});

/* ═══════════════════════════════════════════════════════════
   11. SẢN PHẨM – TRA CỨU (US-STF-12)
   GET /api/staff/products?keyword=&categoryId=&page=&limit=
   ═══════════════════════════════════════════════════════════ */
const searchProducts = asyncHandler(async (req, res) => {
  const { keyword = "", categoryId, page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const term = keyword.trim();

  const where = { status: "ACTIVE" };

  if (categoryId) where.categoryId = toInt(categoryId, "categoryId");

  if (term) {
    where.OR = [
      { name: { contains: term } },
      { sku: { contains: term } },
      { barcode: { contains: term } },
    ];
  }

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take,
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        salePrice: true,
        unit: true,
        status: true,
        minStock: true,
        category: { select: { id: true, name: true } },
        inventory: {
          select: { quantity: true, reservedQuantity: true, warehouseId: true },
        },
      },
    }),
    prisma.product.count({ where }),
  ]);

  const enriched = products.map((p) => ({
    ...p,
    totalStock: p.inventory.reduce((s, inv) => s + inv.quantity, 0),
    availableStock: p.inventory.reduce(
      (s, inv) => s + (inv.quantity - inv.reservedQuantity),
      0
    ),
  }));

  res.json({ data: enriched, total, page: parseInt(page, 10), limit: take });
});

/* ═══════════════════════════════════════════════════════════
   12. KHÁCH HÀNG – TRA CỨU (US-STF-13)
   GET /api/staff/customers?keyword=&page=&limit=
   ═══════════════════════════════════════════════════════════ */
const searchCustomers = asyncHandler(async (req, res) => {
  const { keyword = "", page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = Math.min(parseInt(limit, 10) || 20, 100);
  const term = keyword.trim();

  const where = {
    role: { code: "CUSTOMER" },
    status: "ACTIVE",
  };

  if (term) {
    where.OR = [
      { fullName: { contains: term } },
      { email: { contains: term } },
      { phone: { contains: term } },
    ];
  }

  const [customers, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take,
      orderBy: { fullName: "asc" },
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        status: true,
        customerProfile: {
          select: { totalOrders: true, totalSpent: true, loyaltyPoints: true },
        },
        addresses: {
          where: { isDefault: true },
          select: { id: true, receiverName: true, receiverPhone: true, city: true },
          take: 1,
        },
      },
    }),
    prisma.user.count({ where }),
  ]);

  res.json({ data: customers, total, page: parseInt(page, 10), limit: take });
});

/* ═══════════════════════════════════════════════════════════
   13. KHÁCH HÀNG – LỊCH SỬ ĐƠN HÀNG (US-STF-13)
   GET /api/staff/customers/:id/orders
   ═══════════════════════════════════════════════════════════ */
const getCustomerOrders = asyncHandler(async (req, res) => {
  const customerId = toInt(req.params.id, "id");
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const take = Math.min(parseInt(limit, 10) || 10, 50);

  const customer = await prisma.user.findUnique({
    where: { id: customerId },
    select: { id: true, fullName: true, email: true, phone: true },
  });

  if (!customer) throw createHttpError(404, "Customer not found");

  const [onlineOrders, posSales] = await Promise.all([
    prisma.onlineOrder.findMany({
      where: { customerId },
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderCode: true,
        statusCode: true,
        total: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true } },
      },
    }),
    prisma.posSale.findMany({
      where: { customerId },
      skip,
      take,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        code: true,
        total: true,
        createdAt: true,
        items: { select: { productName: true, quantity: true } },
      },
    }),
  ]);

  res.json({
    data: {
      customer,
      onlineOrders,
      posSales,
    },
  });
});

/* ═══════════════════════════════════════════════════════════
   14. ĐỔI/TRẢ HÀNG (US-STF-14)
   POST /api/staff/returns
   Body: {
     sourceType: 'POS_SALE' | 'ONLINE_ORDER',
     sourceId: number,
     warehouseId: number,
     reason: string,
     returnToStock: boolean,
     items: [{ productId, quantity, note? }]
   }
   ═══════════════════════════════════════════════════════════ */
const createReturn = asyncHandler(async (req, res) => {
  const { sourceType, sourceId, warehouseId, reason, returnToStock = true, items } = req.body;

  if (!sourceType || !sourceId || !warehouseId || !reason || !Array.isArray(items) || items.length === 0) {
    throw createHttpError(400, "sourceType, sourceId, warehouseId, reason and items are required");
  }

  if (!["POS_SALE", "ONLINE_ORDER"].includes(sourceType)) {
    throw createHttpError(400, "sourceType must be POS_SALE or ONLINE_ORDER");
  }

  const result = await prisma.$transaction(async (tx) => {
    // Xác thực nguồn đơn hàng
    let sourceOrder = null;
    if (sourceType === "POS_SALE") {
      sourceOrder = await tx.posSale.findUnique({
        where: { id: toInt(sourceId, "sourceId") },
        include: { items: true },
      });
      if (!sourceOrder) throw createHttpError(404, "POS sale not found");
      if (sourceOrder.status !== "COMPLETED") {
        throw createHttpError(400, "Only completed POS sales can be returned");
      }
    } else {
      sourceOrder = await tx.onlineOrder.findUnique({
        where: { id: toInt(sourceId, "sourceId") },
        include: { items: true },
      });
      if (!sourceOrder) throw createHttpError(404, "Online order not found");
      if (sourceOrder.statusCode !== "COMPLETED") {
        throw createHttpError(400, "Only completed online orders can be returned");
      }
    }

    // Kiểm tra số lượng trả không vượt số đã mua
    for (const retItem of items) {
      const sourceItem = sourceOrder.items.find(
        (si) => si.productId === toInt(retItem.productId, "productId")
      );
      if (!sourceItem) {
        throw createHttpError(400, `Product ${retItem.productId} not found in original order`);
      }
      if (toInt(retItem.quantity, "quantity") > sourceItem.quantity) {
        throw createHttpError(400, `Return quantity exceeds original quantity for product ${retItem.productId}`);
      }
    }

    const returnCode = generateCode("RET");
    const warehouseIdInt = toInt(warehouseId, "warehouseId");

    // Tạo bản ghi đổi/trả (dùng inventory transaction với type RETURN_IN)
    const returnRecord = await tx.inventoryTransaction.createMany({
      data: items.map((item) => ({
        warehouseId: warehouseIdInt,
        productId: toInt(item.productId, "productId"),
        userId: req.user.id,
        type: "RETURN_IN",
        quantity: toInt(item.quantity, "quantity"),
        referenceType: sourceType,
        referenceId: toInt(sourceId, "sourceId"),
        note: `[${returnCode}] Return: ${reason}${item.note ? " | " + item.note : ""}`,
      })),
    });

    // Nếu nhập lại kho, cập nhật tồn kho
    if (returnToStock) {
      for (const item of items) {
        const productId = toInt(item.productId, "productId");
        const qty = toInt(item.quantity, "quantity");

        await tx.inventory.upsert({
          where: {
            warehouseId_productId: { warehouseId: warehouseIdInt, productId },
          },
          update: { quantity: { increment: qty } },
          create: { warehouseId: warehouseIdInt, productId, quantity: qty, reservedQuantity: 0 },
        });

        // Giảm soldCount
        await tx.product.update({
          where: { id: productId },
          data: { soldCount: { decrement: qty } },
        });
      }
    }

    await logActivity(tx, {
      userId: req.user.id,
      action: "PROCESS_RETURN",
      entityType: sourceType === "POS_SALE" ? "posSale" : "onlineOrder",
      entityId: toInt(sourceId, "sourceId"),
      req,
      metadata: {
        returnCode,
        reason,
        returnToStock,
        itemCount: items.length,
      },
    });

    return {
      returnCode,
      sourceType,
      sourceId: toInt(sourceId, "sourceId"),
      warehouseId: warehouseIdInt,
      reason,
      returnToStock,
      items,
      processedBy: req.user.id,
      processedAt: new Date(),
    };
  });

  res.status(201).json({ message: "Return processed successfully", data: result });
});

/* ═══════════════════════════════════════════════════════════
   15. BÁO CÁO CA LÀM VIỆC CÁ NHÂN (US-STF-15)
   GET /api/staff/reports/my-shift?date=&startDate=&endDate=
   ═══════════════════════════════════════════════════════════ */
const getMyShiftReport = asyncHandler(async (req, res) => {
  const { date, startDate, endDate } = req.query;
  const staffId = req.user.id;

  // Mặc định: hôm nay nếu không truyền tham số
  let gte, lte;
  if (date) {
    gte = new Date(date);
    lte = new Date(date);
    lte.setHours(23, 59, 59, 999);
  } else {
    gte = startDate ? new Date(startDate) : (() => { const d = new Date(); d.setHours(0,0,0,0); return d; })();
    lte = endDate ? new Date(endDate) : (() => { const d = new Date(); d.setHours(23,59,59,999); return d; })();
  }

  const where = { staffId, createdAt: { gte, lte } };

  const [sales, payments] = await Promise.all([
    prisma.posSale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { items: true },
    }),
    prisma.payment.findMany({
      where: {
        targetType: "POS_SALE",
        targetId: { in: [] }, // sẽ fill sau
        createdAt: { gte, lte },
      },
      include: { paymentMethod: { select: { name: true, code: true } } },
    }),
  ]);

  // Lấy payments thực sự
  const saleIds = sales.map((s) => s.id);
  const actualPayments = await prisma.payment.findMany({
    where: { targetType: "POS_SALE", targetId: { in: saleIds } },
    include: { paymentMethod: { select: { name: true, code: true } } },
  });

  // Tổng doanh thu theo phương thức thanh toán
  const revenueByMethod = {};
  for (const p of actualPayments) {
    const methodName = p.paymentMethod?.name || "Unknown";
    if (!revenueByMethod[methodName]) revenueByMethod[methodName] = 0;
    revenueByMethod[methodName] += Number(p.amount);
  }

  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.total), 0);

  res.json({
    data: {
      staffId,
      staffName: req.user.fullName,
      period: { from: gte, to: lte },
      totalInvoices: sales.length,
      totalRevenue,
      revenueByPaymentMethod: revenueByMethod,
      sales: sales.map((s) => ({
        id: s.id,
        code: s.code,
        total: s.total,
        itemCount: s.items.length,
        createdAt: s.createdAt,
      })),
    },
  });
});

/* ═══════════════════════════════════════════════════════════
   16. GHI CHÚ XỬ LÝ ĐƠN HÀNG (US-STF-16)
   POST /api/staff/orders/:id/notes
   Body: { note }
   ═══════════════════════════════════════════════════════════ */
const addOrderNote = asyncHandler(async (req, res) => {
  const orderId = toInt(req.params.id, "id");
  const { note } = req.body;

  if (!note || !note.trim()) {
    throw createHttpError(400, "note is required");
  }

  const order = await prisma.onlineOrder.findUnique({
    where: { id: orderId },
    select: { id: true, statusCode: true, orderCode: true },
  });

  if (!order) throw createHttpError(404, "Online order not found");

  if (order.statusCode === "CANCELLED" || order.statusCode === "COMPLETED") {
    throw createHttpError(400, "Cannot add note to a completed or cancelled order");
  }

  // Ghi chú vào orderStatusLog mà không thay đổi trạng thái
  const log = await prisma.orderStatusLog.create({
    data: {
      onlineOrderId: orderId,
      fromStatusCode: order.statusCode,
      toStatusCode: order.statusCode, // giữ nguyên
      changedById: req.user.id,
      note: note.trim(),
    },
    include: { changedBy: { select: { id: true, fullName: true } } },
  });

  res.status(201).json({ message: "Note added successfully", data: log });
});

/* ═══════════════════════════════════════════════════════════
   EXPORTS
   ═══════════════════════════════════════════════════════════ */
module.exports = {
  // POS
  searchPosProducts,
  getPosSaleDetail,
  getMyPosSales,

  // Online Orders
  getOnlineOrders,
  getOnlineOrderDetail,
  confirmOnlineOrder,
  getPickList,
  updateOnlineOrderStatus,
  cancelOnlineOrder,

  // Inventory
  getInventory,

  // Products
  searchProducts,

  // Customers
  searchCustomers,
  getCustomerOrders,

  // Returns
  createReturn,

  // Reports
  getMyShiftReport,

  // Notes
  addOrderNote,
};
