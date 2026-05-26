const createCrudController = require("../utils/crudController");

const cartCrud = createCrudController({
  model: "cart",
  createFields: ["userId"],
  updateFields: ["userId"],
  fieldTypes: {
    userId: "int",
  },
  filterFields: {
    userId: "int",
  },
  sortableFields: ["id", "userId", "createdAt", "updatedAt"],
  defaultOrderBy: { updatedAt: "desc" },
  listSelect: {
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    },
    _count: {
      select: {
        items: true,
      },
    },
  },
  detailSelect: {
    id: true,
    userId: true,
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        email: true,
        fullName: true,
      },
    },
    items: {
      select: {
        id: true,
        productId: true,
        quantity: true,
        createdAt: true,
        updatedAt: true,
        product: {
          select: {
            id: true,
            name: true,
            slug: true,
            sku: true,
            price: true,
            salePrice: true,
            stock: true,
            mainImageUrl: true,
          },
        },
      },
    },
  },
});

module.exports = {
  getCarts: cartCrud.getAll,
  getCartById: cartCrud.getById,
  createCart: cartCrud.createOne,
  updateCart: cartCrud.updateOne,
  deleteCart: cartCrud.deleteOne,
};
