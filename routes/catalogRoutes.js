const express = require("express");
const {
  getBestSellingProducts,
  getCategories,
  getProductById,
  listProducts,
  searchProducts,
} = require("../controllers/catalogController");

const router = express.Router();

router.get("/categories", getCategories);
router.get("/products", listProducts);
router.get("/products/search", searchProducts);
router.get("/products/best-selling", getBestSellingProducts);
router.get("/products/:id", getProductById);

module.exports = router;
