const createCrudController = require("../utils/crudController");

const addressCrud = createCrudController({
  model: "address",
  createFields: [
    "userId",
    "receiverName",
    "receiverPhone",
    "line1",
    "ward",
    "district",
    "city",
    "isDefault",
  ],
  updateFields: [
    "userId",
    "receiverName",
    "receiverPhone",
    "line1",
    "ward",
    "district",
    "city",
    "isDefault",
  ],
  fieldTypes: {
    userId: "int",
    isDefault: "boolean",
  },
  filterFields: {
    userId: "int",
    isDefault: "boolean",
    city: "string",
  },
  searchFields: ["receiverName", "receiverPhone", "line1", "city"],
  sortableFields: ["id", "userId", "city", "isDefault", "createdAt"],
  defaultOrderBy: { createdAt: "desc" },
  listSelect: {
    id: true,
    userId: true,
    receiverName: true,
    receiverPhone: true,
    line1: true,
    ward: true,
    district: true,
    city: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
  },
  detailSelect: {
    id: true,
    userId: true,
    receiverName: true,
    receiverPhone: true,
    line1: true,
    ward: true,
    district: true,
    city: true,
    isDefault: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    },
  },
});

module.exports = {
  getAddresses: addressCrud.getAll,
  getAddressById: addressCrud.getById,
  createAddress: addressCrud.createOne,
  updateAddress: addressCrud.updateOne,
  deleteAddress: addressCrud.deleteOne,
};
