const express = require("express");
const { login, register } = require("../controllers/authController");
const {
  addCartItem,
  cancelOnlineOrder,
  checkoutOnlineOrder,
  getMyCart,
  removeCartItem,
  updateCartItem,
} = require("../controllers/workflowController");
const {
  changeMyPassword,
  createMyAddress,
  createProductReview,
  deleteMyAddress,
  getMyProfile,
  getMyAddresses,
  getMyOnlineOrderByCode,
  getMyOnlineOrderById,
  getMyOnlineOrders,
  getMyReviews,
  getPaymentMethods,
  updateMyProfile,
  updateMyAddress,
} = require("../controllers/customerController");
const { customerOnly, protect } = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/auth/register", register);
router.post("/auth/login", login);

router.use(protect, customerOnly);

router.get("/profile", getMyProfile);
router.put("/profile", updateMyProfile);
router.patch("/profile", updateMyProfile);
router.put("/profile/password", changeMyPassword);
router.patch("/profile/password", changeMyPassword);

router.get("/payment-methods", getPaymentMethods);

router.get("/cart", getMyCart);
router.post("/cart/items", addCartItem);
router.put("/cart/items/:id", updateCartItem);
router.patch("/cart/items/:id", updateCartItem);
router.delete("/cart/items/:id", removeCartItem);

router.get("/addresses", getMyAddresses);
router.post("/addresses", createMyAddress);
router.put("/addresses/:id", updateMyAddress);
router.patch("/addresses/:id", updateMyAddress);
router.delete("/addresses/:id", deleteMyAddress);

router.get("/orders", getMyOnlineOrders);
router.post("/orders", checkoutOnlineOrder);
router.get("/orders/code/:code", getMyOnlineOrderByCode);
router.get("/orders/:id", getMyOnlineOrderById);
router.put("/orders/:id/cancel", cancelOnlineOrder);
router.patch("/orders/:id/cancel", cancelOnlineOrder);

router.get("/online-orders", getMyOnlineOrders);
router.get("/online-orders/:id", getMyOnlineOrderById);
router.post("/online-orders/checkout", checkoutOnlineOrder);
router.put("/online-orders/:id/cancel", cancelOnlineOrder);
router.patch("/online-orders/:id/cancel", cancelOnlineOrder);

router.get("/reviews", getMyReviews);
router.post("/reviews", createProductReview);

module.exports = router;
