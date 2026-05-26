const express = require("express");
const { managerOnly, protect } = require("../middleware/authMiddleware");
const managerController = require("../controllers/managerController");

const router = express.Router();

router.use(protect, managerOnly);

router.get("/sales", managerController.getRevenueReport);
router.get("/revenue", managerController.getRevenueReport);
router.get("/profit", managerController.getProfitReport);
router.get("/inventory", managerController.getInventoryReport);
router.get("/top-products", managerController.getTopProducts);
router.get("/slow-moving-products", managerController.getSlowMovingProducts);

module.exports = router;
