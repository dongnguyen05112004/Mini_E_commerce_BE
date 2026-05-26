const express = require("express");
const {
  getUsers,
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require("../controllers/userController");
const { protect, adminOnly } = require("../middleware/authMiddleware");

const router = express.Router();

router.use(protect, adminOnly);

router.route("/").get(getUsers).post(createUser);
router.route("/:id").get(getUserById).put(updateUser).patch(updateUser).delete(deleteUser);

module.exports = router;
