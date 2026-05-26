const createCrudController = require("../utils/crudController");
const asyncHandler = require("../utils/asyncHandler");
const prisma = require("../config/db");

const createOrderCode = () =>
  `ORD${Date.now()}${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;

const withOrderCode = (data, req) => {
  if (!data.orderCode) {
    data.orderCode = createOrderCode();
  }

  if (req.user?.role !== "ADMIN") {
    data.userId = req.user.id;
  }

  return data;
};

const orderListSelect = {
  id: true,
  orderCode: true,
  userId: true,
  receiverName: true,
  receiverPhone: true,
  subtotal: true,
  shippingFee: true,
  total: true,
  status: true,
  paymentMethod: true,
  paymentStatus: true,
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
};

const orderDetailSelect = {
  ...orderListSelect,
  shippingAddress: true,
  note: true,
  items: {
    select: {
      id: true,
      productId: true,
      productName: true,
      productSku: true,
      unitPrice: true,
      quantity: true,
      totalPrice: true,
      createdAt: true,
    },
  },
};

const orderCrud = createCrudController({
  model: "order",
  createFields: [
    "orderCode",
    "userId",
    "receiverName",
    "receiverPhone",
    "shippingAddress",
    "note",
    "subtotal",
    "shippingFee",
    "total",
    "status",
    "paymentMethod",
    "paymentStatus",
  ],
  updateFields: [
    "receiverName",
    "receiverPhone",
    "shippingAddress",
    "note",
    "subtotal",
    "shippingFee",
    "total",
    "status",
    "paymentMethod",
    "paymentStatus",
  ],
  fieldTypes: {
    userId: "int",
    subtotal: "decimal",
    shippingFee: "decimal",
    total: "decimal",
  },
  filterFields: {
    userId: "int",
    status: "string",
    paymentMethod: "string",
    paymentStatus: "string",
  },
  searchFields: ["orderCode", "receiverName", "receiverPhone"],
  sortableFields: ["id", "userId", "status", "paymentStatus", "total", "createdAt"],
  defaultOrderBy: { createdAt: "desc" },
  listSelect: orderListSelect,
  detailSelect: orderDetailSelect,
  transformCreate: withOrderCode,
  softDeleteData: {
    status: "CANCELLED",
  },
});

const getMyOrders = asyncHandler(async (req, res) => {
  const orders = await prisma.order.findMany({
    where: {
      userId: req.user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
    select: orderListSelect,
  });

  res.json({
    data: orders,
  });
});

module.exports = {
  getOrders: orderCrud.getAll,
  getOrderById: orderCrud.getById,
  createOrder: orderCrud.createOne,
  updateOrder: orderCrud.updateOne,
  updateOrderStatus: orderCrud.updateOne,
  deleteOrder: orderCrud.deleteOne,
  getMyOrders,
};
