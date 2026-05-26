const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const createCrudController = require("../utils/crudController");

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  phone: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
};

const hashPassword = async (data) => {
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 10);
    delete data.password;
  }

  return data;
};

const userCrud = createCrudController({
  model: "user",
  createFields: ["email", "password", "fullName", "phone", "role", "status"],
  updateFields: ["email", "password", "fullName", "phone", "role", "status"],
  filterFields: {
    role: "string",
    status: "string",
  },
  searchFields: ["email", "fullName", "phone"],
  sortableFields: ["id", "email", "fullName", "role", "status", "createdAt"],
  defaultOrderBy: { createdAt: "desc" },
  listSelect: userSelect,
  detailSelect: userSelect,
  transformCreate: hashPassword,
  transformUpdate: hashPassword,
  afterCreate: async (user) => {
    await prisma.cart.create({
      data: {
        userId: user.id,
      },
    });
  },
  softDeleteData: {
    status: "BLOCKED",
  },
});

module.exports = {
  getUsers: userCrud.getAll,
  getUserById: userCrud.getById,
  createUser: userCrud.createOne,
  updateUser: userCrud.updateOne,
  deleteUser: userCrud.deleteOne,
};
