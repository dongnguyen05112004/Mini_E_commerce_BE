const createCrudController = require("../utils/crudController");

const cartItemCrud = createCrudController({
  model: "cartItem",
  createFields: ["cartId", "productId", "quantity"],
  updateFields: ["cartId", "productId", "quantity"],
  fieldTypes: {
    cartId: "int",
    productId: "int",
    quantity: "int",
  },
  filterFields: {
    cartId: "int",
    productId: "int",
  },
  sortableFields: ["id", "cartId", "productId", "quantity", "createdAt"],
  defaultOrderBy: { updatedAt: "desc" },
  listSelect: {
    id: true,
    cartId: true,
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
        mainImageUrl: true,
      },
    },
  },
  detailSelect: {
    id: true,
    cartId: true,
    productId: true,
    quantity: true,
    createdAt: true,
    updatedAt: true,
    cart: {
      select: {
        id: true,
        userId: true,
      },
    },
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
});

module.exports = {
  getCartItems: cartItemCrud.getAll,
  getCartItemById: cartItemCrud.getById,
  createCartItem: cartItemCrud.createOne,
  updateCartItem: cartItemCrud.updateOne,
  deleteCartItem: cartItemCrud.deleteOne,
};
