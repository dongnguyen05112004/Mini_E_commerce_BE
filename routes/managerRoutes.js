const express = require("express");
const resources = require("../controllers/v2ResourceControllers");
const {
  approvePurchaseOrder,
  createPurchaseOrder,
  receivePurchaseOrder,
} = require("../controllers/workflowController");
const { managerOnly, protect } = require("../middleware/authMiddleware");
const { addCrudRoutes, addReadOnlyRoutes } = require("./routeBuilder");
const managerController = require("../controllers/managerController");

const router = express.Router();

router.use(protect, managerOnly);

// Custom Manager Routes
router.get("/dashboard", managerController.getManagerDashboard);
router.patch("/products/:id/status", managerController.updateProductStatus);
router.get("/inventory/low-stock", managerController.getLowStockInventory);
router.post("/stock-checks", managerController.createStockCheck);
router.patch("/stock-checks/:id/adjust", managerController.adjustStockCheck);
router.get("/reports/revenue", managerController.getRevenueReport);
router.get("/reports/profit", managerController.getProfitReport);
router.get("/reports/inventory", managerController.getInventoryReport);
router.get("/reports/top-products", managerController.getTopProducts);
router.get("/reports/slow-moving-products", managerController.getSlowMovingProducts);


addCrudRoutes(router, "categories", resources.categories);
addCrudRoutes(router, "brands", resources.brands);
addCrudRoutes(router, "units", resources.units);
addCrudRoutes(router, "products", resources.products);
addCrudRoutes(router, "product-images", resources.productImages);
addCrudRoutes(router, "warehouses", resources.warehouses);
addCrudRoutes(router, "inventory", resources.inventory);
addCrudRoutes(router, "inventory-transactions", resources.inventoryTransactions);
addCrudRoutes(router, "suppliers", resources.suppliers);
addCrudRoutes(router, "purchase-orders", resources.purchaseOrders);
addCrudRoutes(router, "purchase-order-items", resources.purchaseOrderItems);
addCrudRoutes(router, "promotions", resources.promotions);
addCrudRoutes(router, "promotion-products", resources.promotionProducts);

addReadOnlyRoutes(router, "pos-sales", resources.posSales);
addReadOnlyRoutes(router, "pos-sale-items", resources.posSaleItems);
addReadOnlyRoutes(router, "online-orders", resources.onlineOrders);
addReadOnlyRoutes(router, "online-order-items", resources.onlineOrderItems);
addReadOnlyRoutes(router, "order-status-logs", resources.orderStatusLogs);
addReadOnlyRoutes(router, "payments", resources.payments);
addReadOnlyRoutes(router, "deliveries", resources.deliveries);

router.post("/workflows/purchase-orders", createPurchaseOrder);
router.patch("/workflows/purchase-orders/:id/approve", approvePurchaseOrder);
router.patch("/workflows/purchase-orders/:id/receive", receivePurchaseOrder);

module.exports = router;
