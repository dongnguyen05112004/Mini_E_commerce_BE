const express = require("express");
const {
  getCartItems,
  getCartItemById,
  createCartItem,
  updateCartItem,
  deleteCartItem,
} = require("../controllers/cartItemController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.route("/").get(getCartItems).post(createCartItem);
router.route("/:id").get(getCartItemById).put(updateCartItem).patch(updateCartItem).delete(deleteCartItem);

module.exports = router;
