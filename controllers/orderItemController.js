const createCrudController = require("../utils/crudController");

const orderItemCrud = createCrudController({
  model: "orderItem",
  createFields: [
    "orderId",
    "productId",
    "productName",
    "productSku",
    "unitPrice",
    "quantity",
    "totalPrice",
  ],
  updateFields: [
    "orderId",
    "productId",
    "productName",
    "productSku",
    "unitPrice",
    "quantity",
    "totalPrice",
  ],
  fieldTypes: {
    orderId: "int",
    productId: "int",
    unitPrice: "decimal",
    quantity: "int",
    totalPrice: "decimal",
  },
  filterFields: {
    orderId: "int",
    productId: "int",
  },
  searchFields: ["productName", "productSku"],
  sortableFields: ["id", "orderId", "productId", "quantity", "totalPrice", "createdAt"],
  defaultOrderBy: { createdAt: "desc" },
  listSelect: {
    id: true,
    orderId: true,
    productId: true,
    productName: true,
    productSku: true,
    unitPrice: true,
    quantity: true,
    totalPrice: true,
    createdAt: true,
  },
  detailSelect: {
    id: true,
    orderId: true,
    productId: true,
    productName: true,
    productSku: true,
    unitPrice: true,
    quantity: true,
    totalPrice: true,
    createdAt: true,
    order: {
      select: {
        id: true,
        orderCode: true,
        status: true,
      },
    },
    product: {
      select: {
        id: true,
        name: true,
        slug: true,
        sku: true,
      },
    },
  },
});

module.exports = {
  getOrderItems: orderItemCrud.getAll,
  getOrderItemById: orderItemCrud.getById,
  createOrderItem: orderItemCrud.createOne,
  updateOrderItem: orderItemCrud.updateOne,
  deleteOrderItem: orderItemCrud.deleteOne,
};
