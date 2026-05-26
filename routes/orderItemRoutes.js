const express = require("express");
const {
  getOrderItems,
  getOrderItemById,
  createOrderItem,
  updateOrderItem,
  deleteOrderItem,
} = require("../controllers/orderItemController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.route("/").get(getOrderItems).post(createOrderItem);
router.route("/:id").get(getOrderItemById).put(updateOrderItem).patch(updateOrderItem).delete(deleteOrderItem);

module.exports = router;
