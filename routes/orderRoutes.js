const express = require("express");
const {
  getOrders,
  getOrderById,
  createOrder,
  updateOrder,
  deleteOrder,
  getMyOrders,
} = require("../controllers/orderController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.get("/my-orders", protect, getMyOrders);
router.route("/").get(protect, adminOnly, getOrders).post(protect, createOrder);
router
  .route("/:id")
  .get(protect, adminOnly, getOrderById)
  .put(protect, adminOnly, updateOrder)
  .patch(protect, adminOnly, updateOrder)
  .delete(protect, adminOnly, deleteOrder);

module.exports = router;
