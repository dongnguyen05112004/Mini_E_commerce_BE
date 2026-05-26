const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

// 1. Update Product Status
const updateProductStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    const error = new Error("Status is required");
    error.statusCode = 400;
    throw error;
  }

  const productId = parseInt(id, 10);
  const product = await prisma.product.findUnique({ where: { id: productId } });

  if (!product) {
    const error = new Error("Product not found");
    error.statusCode = 404;
    throw error;
  }

  const updatedProduct = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.update({
      where: { id: productId },
      data: { status }
    });

    await tx.userActivityLog.create({
      data: {
        userId: req.user.id,
        action: "UPDATE_PRODUCT_STATUS",
        entityType: "product",
        entityId: productId,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
        metadata: { oldStatus: product.status, newStatus: status }
      }
    });

    return updated;
  });

  res.json({ message: `Product status updated to ${status}`, data: updatedProduct });
});

// 2. Get Low Stock Inventory
const getLowStockInventory = asyncHandler(async (req, res) => {
  const allInventory = await prisma.inventory.findMany({
    include: {
      product: { select: { id: true, name: true, sku: true, minStock: true, status: true } },
      warehouse: { select: { id: true, name: true, branchId: true } }
    }
  });

  const lowStockItems = allInventory.filter(
    item => item.product.status === "ACTIVE" && item.quantity <= item.product.minStock
  );

  res.json({ data: lowStockItems });
});

// 3. Create Stock Check
const createStockCheck = asyncHandler(async (req, res) => {
  const { warehouseId, note, items } = req.body;

  if (!warehouseId || !Array.isArray(items) || items.length === 0) {
    const error = new Error("warehouseId and items are required");
    error.statusCode = 400;
    throw error;
  }

  // Fetch current system quantities for products
  const productIds = items.map(i => i.productId);
  const currentInventories = await prisma.inventory.findMany({
    where: { warehouseId, productId: { in: productIds } }
  });

  const inventoryMap = new Map();
  currentInventories.forEach(inv => inventoryMap.set(inv.productId, inv.quantity));

  const stockCheck = await prisma.stockCheck.create({
    data: {
      code: `SC-${Date.now()}`,
      warehouseId,
      createdById: req.user.id,
      note,
      items: {
        create: items.map(item => {
          const sysQty = inventoryMap.get(item.productId) || 0;
          return {
            productId: item.productId,
            systemQuantity: sysQty,
            actualQuantity: item.actualQuantity,
            difference: item.actualQuantity - sysQty
          };
        })
      }
    },
    include: { items: true }
  });

  res.status(201).json({ data: stockCheck });
});

// 4. Adjust Stock Check
const adjustStockCheck = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const stockCheckId = parseInt(id, 10);

  const stockCheck = await prisma.stockCheck.findUnique({
    where: { id: stockCheckId },
    include: { items: true }
  });

  if (!stockCheck) {
    const error = new Error("Stock check not found");
    error.statusCode = 404;
    throw error;
  }

  if (stockCheck.status !== "DRAFT") {
    const error = new Error(`Cannot adjust a stock check in ${stockCheck.status} status`);
    error.statusCode = 400;
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    // Mark as COMPLETED
    await tx.stockCheck.update({
      where: { id: stockCheckId },
      data: { status: "COMPLETED" }
    });

    // Update inventory and create transactions
    for (const item of stockCheck.items) {
      if (item.difference === 0) continue;

      const inventory = await tx.inventory.upsert({
        where: {
          warehouseId_productId: {
            warehouseId: stockCheck.warehouseId,
            productId: item.productId
          }
        },
        update: { quantity: item.actualQuantity },
        create: {
          warehouseId: stockCheck.warehouseId,
          productId: item.productId,
          quantity: item.actualQuantity
        }
      });

      await tx.inventoryTransaction.create({
        data: {
          warehouseId: stockCheck.warehouseId,
          productId: item.productId,
          userId: req.user.id,
          type: item.difference > 0 ? "ADJUSTMENT_IN" : "ADJUSTMENT_OUT",
          quantity: Math.abs(item.difference),
          beforeQuantity: item.systemQuantity,
          afterQuantity: item.actualQuantity,
          referenceType: "STOCK_CHECK",
          referenceId: stockCheckId,
          note: `Adjusted from stock check ${stockCheck.code}`
        }
      });
    }

    await tx.userActivityLog.create({
      data: {
        userId: req.user.id,
        action: "ADJUST_STOCK_CHECK",
        entityType: "stockCheck",
        entityId: stockCheckId,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
        metadata: { itemsAdjusted: stockCheck.items.length }
      }
    });
  });

  res.json({ message: "Stock check adjusted successfully" });
});

// 5. Get Revenue Report
const getRevenueReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  const whereOnline = { statusCode: "COMPLETED", paymentStatus: "PAID" };
  const wherePos = { status: "COMPLETED" };

  if (startDate || endDate) {
    whereOnline.createdAt = {};
    wherePos.createdAt = {};
    if (startDate) {
      whereOnline.createdAt.gte = new Date(startDate);
      wherePos.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      whereOnline.createdAt.lte = new Date(endDate);
      wherePos.createdAt.lte = new Date(endDate);
    }
  }

  const [onlineOrders, posSales] = await Promise.all([
    prisma.onlineOrder.findMany({ where: whereOnline, select: { total: true } }),
    prisma.posSale.findMany({ where: wherePos, select: { total: true } })
  ]);

  const onlineRevenue = onlineOrders.reduce((sum, order) => sum + Number(order.total), 0);
  const posRevenue = posSales.reduce((sum, sale) => sum + Number(sale.total), 0);

  res.json({
    data: {
      onlineRevenue,
      posRevenue,
      totalRevenue: onlineRevenue + posRevenue
    }
  });
});

// 6. Get Profit Report
const getProfitReport = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;
  
  const whereOnline = {
    onlineOrder: { statusCode: "COMPLETED", paymentStatus: "PAID" },
  };
  const wherePos = { posSale: { status: "COMPLETED" } };

  if (startDate || endDate) {
    whereOnline.createdAt = {};
    wherePos.createdAt = {};
    if (startDate) {
      whereOnline.createdAt.gte = new Date(startDate);
      wherePos.createdAt.gte = new Date(startDate);
    }
    if (endDate) {
      whereOnline.createdAt.lte = new Date(endDate);
      wherePos.createdAt.lte = new Date(endDate);
    }
  }

  const [onlineItems, posItems] = await Promise.all([
    prisma.onlineOrderItem.findMany({ where: whereOnline, select: { totalPrice: true, costPrice: true, quantity: true } }),
    prisma.posSaleItem.findMany({ where: wherePos, select: { totalPrice: true, costPrice: true, quantity: true } })
  ]);

  let onlineRevenue = 0, onlineCost = 0;
  onlineItems.forEach(item => {
    onlineRevenue += Number(item.totalPrice);
    onlineCost += Number(item.costPrice) * item.quantity;
  });

  let posRevenue = 0, posCost = 0;
  posItems.forEach(item => {
    posRevenue += Number(item.totalPrice);
    posCost += Number(item.costPrice) * item.quantity;
  });

  res.json({
    data: {
      online: { revenue: onlineRevenue, cost: onlineCost, profit: onlineRevenue - onlineCost },
      pos: { revenue: posRevenue, cost: posCost, profit: posRevenue - posCost },
      totalProfit: (onlineRevenue - onlineCost) + (posRevenue - posCost)
    }
  });
});

// 7. Get Inventory Report
const getInventoryReport = asyncHandler(async (req, res) => {
  const inventory = await prisma.inventory.findMany({
    include: { product: { select: { id: true, name: true, sku: true } } }
  });
  
  const report = {};
  inventory.forEach(inv => {
    if (!report[inv.productId]) {
      report[inv.productId] = {
        productId: inv.productId,
        name: inv.product.name,
        sku: inv.product.sku,
        totalQuantity: 0,
        reservedQuantity: 0
      };
    }
    report[inv.productId].totalQuantity += inv.quantity;
    report[inv.productId].reservedQuantity += inv.reservedQuantity;
  });

  res.json({ data: Object.values(report) });
});

// 8. Get Top Products
const getTopProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    orderBy: { soldCount: "desc" },
    take: 10,
    select: { id: true, name: true, sku: true, soldCount: true, salePrice: true }
  });

  res.json({ data: products });
});

// 9. Get Slow Moving Products
const getSlowMovingProducts = asyncHandler(async (req, res) => {
  const products = await prisma.product.findMany({
    where: { status: "ACTIVE", soldCount: 0 },
    orderBy: { createdAt: "asc" },
    take: 50,
    select: { id: true, name: true, sku: true, createdAt: true, soldCount: true }
  });

  res.json({ data: products });
});

// 10. Manager Dashboard
const getManagerDashboard = asyncHandler(async (req, res) => {
  const [
    totalProducts,
    activeProducts,
    totalOrders,
    pendingOrders,
    totalInventoryRecords,
    lowStockItems,
    onlineRevenue,
    posRevenue
  ] = await Promise.all([
    prisma.product.count(),
    prisma.product.count({ where: { status: "ACTIVE" } }),
    prisma.onlineOrder.count(),
    prisma.onlineOrder.count({ where: { statusCode: "PENDING" } }),
    prisma.inventory.count(),
    // Low stock: active products whose inventory quantity <= minStock
    prisma.inventory.count({
      where: {
        product: { status: "ACTIVE" },
        quantity: { lte: prisma.inventory.fields.quantity } // will compute in post
      }
    }).catch(() => 0),
    prisma.onlineOrder.aggregate({
      where: { statusCode: "COMPLETED", paymentStatus: "PAID" },
      _sum: { total: true }
    }),
    prisma.posSale.aggregate({
      where: { status: "COMPLETED" },
      _sum: { total: true }
    })
  ]);

  // Compute low stock separately (Prisma doesn't support column comparison in where)
  const allInventory = await prisma.inventory.findMany({
    include: { product: { select: { minStock: true, status: true } } }
  });
  const lowStockCount = allInventory.filter(
    inv => inv.product.status === "ACTIVE" && inv.quantity <= inv.product.minStock
  ).length;

  const onlineRev = Number(onlineRevenue._sum.total || 0);
  const posRev = Number(posRevenue._sum.total || 0);

  res.json({
    data: {
      products: {
        total: totalProducts,
        active: activeProducts
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders
      },
      inventory: {
        totalRecords: totalInventoryRecords,
        lowStockItems: lowStockCount
      },
      revenue: {
        online: onlineRev,
        pos: posRev,
        total: onlineRev + posRev
      }
    }
  });
});

module.exports = {
  updateProductStatus,
  getLowStockInventory,
  createStockCheck,
  adjustStockCheck,
  getRevenueReport,
  getProfitReport,
  getInventoryReport,
  getTopProducts,
  getSlowMovingProducts,
  getManagerDashboard
};
