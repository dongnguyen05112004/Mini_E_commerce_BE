const express = require("express");
const resources = require("../controllers/v2ResourceControllers");
const { adminOnly, protect } = require("../middleware/authMiddleware");
const { addCrudRoutes, addReadOnlyRoutes } = require("./routeBuilder");
const adminController = require("../controllers/adminController");

const router = express.Router();

router.use(protect, adminOnly);

// Custom routes (evaluated first to prevent capturing by generic routes)
router.get("/dashboard", adminController.getDashboardStats);
router.get("/activity-logs/export", adminController.exportActivityLogs);
router.patch("/users/:id/status", adminController.updateUserStatus);
router.put("/roles/:id/permissions", adminController.assignRolePermissions);

// Map /settings to systemSettings for backwards compatibility with PB-AD
router.get("/settings", resources.systemSettings.getAll);
router.put("/settings/:key", adminController.updateSettingByKey);

// Generic auto-CRUD
addCrudRoutes(router, "roles", resources.roles);
addCrudRoutes(router, "permissions", resources.permissions);
addCrudRoutes(router, "role-permissions", resources.rolePermissions);
addCrudRoutes(router, "users", resources.users);
addCrudRoutes(router, "branches", resources.branches);
addCrudRoutes(router, "order-statuses", resources.orderStatuses);
addCrudRoutes(router, "payment-methods", resources.paymentMethods);
addCrudRoutes(router, "delivery-fee-rules", resources.deliveryFeeRules);
addCrudRoutes(router, "return-policies", resources.returnPolicies);
addCrudRoutes(router, "system-settings", resources.systemSettings);
addReadOnlyRoutes(router, "user-activity-logs", resources.userActivityLogs);

module.exports = router;
