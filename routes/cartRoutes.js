const express = require("express");
const {
  getCarts,
  getCartById,
  createCart,
  updateCart,
  deleteCart,
} = require("../controllers/cartController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.route("/").get(getCarts).post(createCart);
router.route("/:id").get(getCartById).put(updateCart).patch(updateCart).delete(deleteCart);

module.exports = router;
