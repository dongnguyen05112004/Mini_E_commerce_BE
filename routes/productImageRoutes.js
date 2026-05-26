const express = require("express");
const {
  getProductImages,
  getProductImageById,
  createProductImage,
  updateProductImage,
  deleteProductImage,
} = require("../controllers/productImageController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.route("/").get(getProductImages).post(protect, adminOnly, createProductImage);
router
  .route("/:id")
  .get(getProductImageById)
  .put(protect, adminOnly, updateProductImage)
  .patch(protect, adminOnly, updateProductImage)
  .delete(protect, adminOnly, deleteProductImage);

module.exports = router;
