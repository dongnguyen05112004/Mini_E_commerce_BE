const express = require("express");
const {
  getAddresses,
  getAddressById,
  createAddress,
  updateAddress,
  deleteAddress,
} = require("../controllers/addressController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.route("/").get(getAddresses).post(createAddress);
router.route("/:id").get(getAddressById).put(updateAddress).patch(updateAddress).delete(deleteAddress);

module.exports = router;
