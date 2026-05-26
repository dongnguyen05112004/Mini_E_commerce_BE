const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const createCrudController = require("../utils/crudController");
const slugify = require("../utils/slugify");

const nowCode = (prefix) =>
  `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)
    .toString()
    .padStart(3, "0")}`;

const withSlug = (data) => {
  if (!data.slug && data.name) {
    data.slug = slugify(data.name);
  }

  return data;
};

const withCode = (field, prefix) => (data) => {
  if (!data[field]) {
    data[field] = nowCode(prefix);
  }

  return data;
};

const hashPassword = async (data) => {
  if (data.password) {
    data.passwordHash = await bcrypt.hash(data.password, 10);
    delete data.password;
  }

  return data;
};

const userSelect = {
  id: true,
  roleId: true,
  branchId: true,
  email: true,
  fullName: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  customerProfile: true,
};

const categorySelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  parentId: true,
  status: true,
  position: true,
  createdAt: true,
  updatedAt: true,
  parent: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  _count: {
    select: {
      products: true,
      children: true,
    },
  },
};

const categoryDetailSelect = {
  ...categorySelect,
  children: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      position: true,
    },
    orderBy: [{ position: "asc" }, { name: "asc" }],
  },
};

const supplierSelect = {
  id: true,
  code: true,
  name: true,
  phone: true,
  email: true,
  address: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      purchaseOrders: true,
    },
  },
};

const purchaseOrderInclude = {
  supplier: {
    select: {
      id: true,
      code: true,
      name: true,
      phone: true,
      email: true,
    },
  },
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  createdBy: {
    select: {
      id: true,
      email: true,
      fullName: true,
    },
  },
  approvedBy: {
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

const purchaseOrderDetailInclude = {
  ...purchaseOrderInclude,
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
    orderBy: { id: "asc" },
  },
};

const promotionSelect = {
  id: true,
  code: true,
  name: true,
  description: true,
  discountType: true,
  discountValue: true,
  minOrderAmount: true,
  maxDiscountAmount: true,
  startAt: true,
  endAt: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  _count: {
    select: {
      products: true,
    },
  },
};

const promotionDetailSelect = {
  ...promotionSelect,
  products: {
    select: {
      productId: true,
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
        },
      },
    },
  },
};

const productInclude = {
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  brand: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
  unit: {
    select: {
      id: true,
      name: true,
      code: true,
    },
  },
};

const inventoryInclude = {
  product: {
    select: {
      id: true,
      name: true,
      sku: true,
      minStock: true,
      status: true,
    },
  },
  warehouse: {
    select: {
      id: true,
      code: true,
      name: true,
      branchId: true,
    },
  },
};

const decimalFields = [
  "costPrice",
  "salePrice",
  "comparePrice",
  "subtotal",
  "shippingFee",
  "discountTotal",
  "taxTotal",
  "total",
  "paidAmount",
  "changeAmount",
  "unitCost",
  "totalCost",
  "unitPrice",
  "discountAmount",
  "totalPrice",
  "amount",
  "fee",
  "discountValue",
  "minOrderAmount",
  "maxOrderAmount",
  "maxDiscountAmount",
  "ratingAvg",
  "totalSpent",
];

const intFields = [
  "roleId",
  "permissionId",
  "branchId",
  "userId",
  "parentId",
  "categoryId",
  "brandId",
  "unitId",
  "productId",
  "warehouseId",
  "supplierId",
  "createdById",
  "approvedById",
  "purchaseOrderId",
  "receivedQuantity",
  "staffId",
  "customerId",
  "posSaleId",
  "cartId",
  "onlineOrderId",
  "changedById",
  "targetId",
  "paymentMethodId",
  "promotionId",
  "entityId",
  "quantity",
  "reservedQuantity",
  "beforeQuantity",
  "afterQuantity",
  "referenceId",
  "position",
  "minStock",
  "soldCount",
  "ratingCount",
  "rating",
  "totalOrders",
  "loyaltyPoints",
  "allowReturnDays",
  "onlineOrderItemId",
];

const boolFields = [
  "isSystem",
  "isDefault",
  "isFinal",
  "allowCancelByCustomer",
];

const types = Object.fromEntries([
  ...decimalFields.map((field) => [field, "decimal"]),
  ...intFields.map((field) => [field, "int"]),
  ...boolFields.map((field) => [field, "boolean"]),
]);

const make = (config) =>
  createCrudController({
    sortableFields: ["id"],
    defaultOrderBy: { id: "desc" },
    fieldTypes: types,
    ...config,
  });

const resources = {
  roles: make({
    model: "role",
    createFields: ["code", "name", "description", "isSystem"],
    updateFields: ["code", "name", "description", "isSystem"],
    filterFields: { code: "string", isSystem: "boolean" },
    searchFields: ["code", "name", "description"],
  }),
  permissions: make({
    model: "permission",
    createFields: ["code", "name", "group", "description"],
    updateFields: ["code", "name", "group", "description"],
    filterFields: { group: "string" },
    searchFields: ["code", "name", "group", "description"],
  }),
  rolePermissions: make({
    model: "rolePermission",
    createFields: ["roleId", "permissionId"],
    updateFields: ["roleId", "permissionId"],
    filterFields: { roleId: "int", permissionId: "int" },
  }),
  branches: make({
    model: "branch",
    createFields: ["code", "name", "phone", "address", "city", "status"],
    updateFields: ["code", "name", "phone", "address", "city", "status"],
    filterFields: { status: "string", city: "string" },
    searchFields: ["code", "name", "phone", "address", "city"],
  }),
  users: make({
    model: "user",
    createFields: ["roleId", "branchId", "email", "password", "fullName", "phone", "status"],
    updateFields: ["roleId", "branchId", "email", "password", "fullName", "phone", "status"],
    filterFields: { roleId: "int", branchId: "int", status: "string" },
    searchFields: ["email", "fullName", "phone"],
    listSelect: userSelect,
    detailSelect: {
      ...userSelect,
      addresses: true,
    },
    transformCreate: hashPassword,
    transformUpdate: hashPassword,
    afterCreate: async (user) => {
      await prisma.cart.upsert({
        where: { userId: user.id },
        update: {},
        create: { userId: user.id },
      });
    },
    softDeleteData: { status: "BLOCKED" },
  }),
  customerAddresses: make({
    model: "customerAddress",
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
    filterFields: { userId: "int", isDefault: "boolean", city: "string" },
    searchFields: ["receiverName", "receiverPhone", "line1", "city"],
  }),
  customerProfiles: make({
    model: "customerProfile",
    createFields: [
      "userId",
      "birthDate",
      "gender",
      "totalOrders",
      "totalSpent",
      "loyaltyPoints",
    ],
    updateFields: [
      "birthDate",
      "gender",
      "totalOrders",
      "totalSpent",
      "loyaltyPoints",
    ],
    filterFields: { userId: "int", gender: "string" },
    searchFields: ["gender"],
  }),
  categories: make({
    model: "category",
    createFields: ["name", "slug", "description", "parentId", "status", "position"],
    updateFields: ["name", "slug", "description", "parentId", "status", "position"],
    filterFields: { parentId: "int", status: "string" },
    searchFields: ["name", "slug", "description"],
    defaultOrderBy: { position: "asc" },
    listSelect: categorySelect,
    detailSelect: categoryDetailSelect,
    transformCreate: withSlug,
    transformUpdate: withSlug,
    softDeleteData: { status: "INACTIVE" },
  }),
  brands: make({
    model: "brand",
    createFields: ["name", "slug", "description", "status"],
    updateFields: ["name", "slug", "description", "status"],
    filterFields: { status: "string" },
    searchFields: ["name", "slug", "description"],
    transformCreate: withSlug,
    transformUpdate: withSlug,
    softDeleteData: { status: "INACTIVE" },
  }),
  units: make({
    model: "unit",
    createFields: ["name", "code", "status"],
    updateFields: ["name", "code", "status"],
    filterFields: { status: "string" },
    searchFields: ["name", "code"],
    softDeleteData: { status: "INACTIVE" },
  }),
  products: make({
    model: "product",
    createFields: [
      "categoryId",
      "brandId",
      "unitId",
      "name",
      "slug",
      "sku",
      "barcode",
      "description",
      "costPrice",
      "salePrice",
      "comparePrice",
      "mainImageUrl",
      "status",
      "minStock",
      "soldCount",
      "ratingAvg",
      "ratingCount",
    ],
    updateFields: [
      "categoryId",
      "brandId",
      "unitId",
      "name",
      "slug",
      "sku",
      "barcode",
      "description",
      "costPrice",
      "salePrice",
      "comparePrice",
      "mainImageUrl",
      "status",
      "minStock",
      "soldCount",
      "ratingAvg",
      "ratingCount",
    ],
    filterFields: {
      categoryId: "int",
      brandId: "int",
      unitId: "int",
      status: "string",
    },
    searchFields: ["name", "slug", "sku", "barcode", "description"],
    sortableFields: ["id", "name", "salePrice", "soldCount", "ratingAvg", "createdAt", "updatedAt"],
    listInclude: productInclude,
    detailInclude: productInclude,
    transformCreate: withSlug,
    transformUpdate: withSlug,
    softDeleteData: { status: "INACTIVE" },
  }),
  productImages: make({
    model: "productImage",
    createFields: ["productId", "url", "altText", "position"],
    updateFields: ["productId", "url", "altText", "position"],
    filterFields: { productId: "int" },
    searchFields: ["url", "altText"],
    defaultOrderBy: { position: "asc" },
  }),
  productReviews: make({
    model: "productReview",
    createFields: [
      "userId",
      "productId",
      "onlineOrderId",
      "onlineOrderItemId",
      "rating",
      "content",
      "status",
    ],
    updateFields: ["rating", "content", "status"],
    filterFields: {
      userId: "int",
      productId: "int",
      onlineOrderId: "int",
      status: "string",
    },
    searchFields: ["content"],
    defaultOrderBy: { createdAt: "desc" },
  }),
  warehouses: make({
    model: "warehouse",
    createFields: ["branchId", "code", "name", "address", "status"],
    updateFields: ["branchId", "code", "name", "address", "status"],
    filterFields: { branchId: "int", status: "string" },
    searchFields: ["code", "name", "address"],
  }),
  inventory: make({
    model: "inventory",
    createFields: ["warehouseId", "productId", "quantity", "reservedQuantity"],
    updateFields: ["warehouseId", "productId", "quantity", "reservedQuantity"],
    filterFields: { warehouseId: "int", productId: "int" },
    listInclude: inventoryInclude,
    detailInclude: inventoryInclude,
  }),
  inventoryTransactions: make({
    model: "inventoryTransaction",
    createFields: [
      "warehouseId",
      "productId",
      "userId",
      "type",
      "quantity",
      "beforeQuantity",
      "afterQuantity",
      "referenceType",
      "referenceId",
      "note",
    ],
    updateFields: [
      "warehouseId",
      "productId",
      "userId",
      "type",
      "quantity",
      "beforeQuantity",
      "afterQuantity",
      "referenceType",
      "referenceId",
      "note",
    ],
    filterFields: {
      warehouseId: "int",
      productId: "int",
      userId: "int",
      type: "string",
      referenceType: "string",
      referenceId: "int",
    },
    searchFields: ["referenceType", "note"],
  }),
  suppliers: make({
    model: "supplier",
    createFields: ["code", "name", "phone", "email", "address", "status"],
    updateFields: ["code", "name", "phone", "email", "address", "status"],
    filterFields: { status: "string" },
    searchFields: ["code", "name", "phone", "email", "address"],
    listSelect: supplierSelect,
    detailSelect: supplierSelect,
  }),
  purchaseOrders: make({
    model: "purchaseOrder",
    createFields: [
      "code",
      "supplierId",
      "branchId",
      "warehouseId",
      "createdById",
      "approvedById",
      "status",
      "subtotal",
      "total",
      "note",
      "approvedAt",
      "receivedAt",
    ],
    updateFields: [
      "code",
      "supplierId",
      "branchId",
      "warehouseId",
      "createdById",
      "approvedById",
      "status",
      "subtotal",
      "total",
      "note",
      "approvedAt",
      "receivedAt",
    ],
    filterFields: {
      supplierId: "int",
      branchId: "int",
      warehouseId: "int",
      createdById: "int",
      approvedById: "int",
      status: "string",
    },
    searchFields: ["code", "note"],
    transformCreate: withCode("code", "PO"),
    listInclude: purchaseOrderInclude,
    detailInclude: purchaseOrderDetailInclude,
  }),
  purchaseOrderItems: make({
    model: "purchaseOrderItem",
    createFields: ["purchaseOrderId", "productId", "quantity", "receivedQuantity", "unitCost", "totalCost"],
    updateFields: ["purchaseOrderId", "productId", "quantity", "receivedQuantity", "unitCost", "totalCost"],
    filterFields: { purchaseOrderId: "int", productId: "int" },
  }),
  posSales: make({
    model: "posSale",
    createFields: [
      "code",
      "branchId",
      "staffId",
      "customerId",
      "subtotal",
      "discountTotal",
      "taxTotal",
      "total",
      "paidAmount",
      "changeAmount",
      "status",
      "paymentStatus",
      "soldAt",
    ],
    updateFields: [
      "code",
      "branchId",
      "staffId",
      "customerId",
      "subtotal",
      "discountTotal",
      "taxTotal",
      "total",
      "paidAmount",
      "changeAmount",
      "status",
      "paymentStatus",
      "soldAt",
    ],
    filterFields: { branchId: "int", staffId: "int", customerId: "int", status: "string", paymentStatus: "string" },
    searchFields: ["code"],
    transformCreate: withCode("code", "POS"),
  }),
  posSaleItems: make({
    model: "posSaleItem",
    createFields: [
      "posSaleId",
      "productId",
      "productName",
      "productSku",
      "productBarcode",
      "unitPrice",
      "costPrice",
      "quantity",
      "discountAmount",
      "totalPrice",
    ],
    updateFields: [
      "posSaleId",
      "productId",
      "productName",
      "productSku",
      "productBarcode",
      "unitPrice",
      "costPrice",
      "quantity",
      "discountAmount",
      "totalPrice",
    ],
    filterFields: { posSaleId: "int", productId: "int" },
    searchFields: ["productName", "productSku", "productBarcode"],
  }),
  carts: make({
    model: "cart",
    createFields: ["userId"],
    updateFields: ["userId"],
    filterFields: { userId: "int" },
  }),
  cartItems: make({
    model: "cartItem",
    createFields: ["cartId", "productId", "quantity"],
    updateFields: ["cartId", "productId", "quantity"],
    filterFields: { cartId: "int", productId: "int" },
  }),
  orderStatuses: make({
    model: "orderStatus",
    createFields: ["code", "name", "position", "isDefault", "isFinal", "allowCancelByCustomer", "status"],
    updateFields: ["code", "name", "position", "isDefault", "isFinal", "allowCancelByCustomer", "status"],
    filterFields: { status: "string", isDefault: "boolean", isFinal: "boolean" },
    searchFields: ["code", "name"],
    defaultOrderBy: { position: "asc" },
  }),
  onlineOrders: make({
    model: "onlineOrder",
    createFields: [
      "orderCode",
      "customerId",
      "branchId",
      "warehouseId",
      "statusCode",
      "receiverName",
      "receiverPhone",
      "shippingAddress",
      "note",
      "subtotal",
      "shippingFee",
      "discountTotal",
      "total",
      "paymentStatus",
    ],
    updateFields: [
      "orderCode",
      "customerId",
      "branchId",
      "warehouseId",
      "statusCode",
      "receiverName",
      "receiverPhone",
      "shippingAddress",
      "note",
      "subtotal",
      "shippingFee",
      "discountTotal",
      "total",
      "paymentStatus",
    ],
    filterFields: {
      customerId: "int",
      branchId: "int",
      warehouseId: "int",
      statusCode: "string",
      paymentStatus: "string",
    },
    searchFields: ["orderCode", "receiverName", "receiverPhone"],
    transformCreate: withCode("orderCode", "ONL"),
  }),
  onlineOrderItems: make({
    model: "onlineOrderItem",
    createFields: [
      "onlineOrderId",
      "productId",
      "productName",
      "productSku",
      "productBarcode",
      "unitPrice",
      "costPrice",
      "quantity",
      "discountAmount",
      "totalPrice",
    ],
    updateFields: [
      "onlineOrderId",
      "productId",
      "productName",
      "productSku",
      "productBarcode",
      "unitPrice",
      "costPrice",
      "quantity",
      "discountAmount",
      "totalPrice",
    ],
    filterFields: { onlineOrderId: "int", productId: "int" },
    searchFields: ["productName", "productSku", "productBarcode"],
  }),
  orderStatusLogs: make({
    model: "orderStatusLog",
    createFields: ["onlineOrderId", "fromStatusCode", "toStatusCode", "changedById", "note"],
    updateFields: ["onlineOrderId", "fromStatusCode", "toStatusCode", "changedById", "note"],
    filterFields: { onlineOrderId: "int", toStatusCode: "string", changedById: "int" },
    searchFields: ["fromStatusCode", "toStatusCode", "note"],
  }),
  paymentMethods: make({
    model: "paymentMethod",
    createFields: ["code", "name", "status", "config"],
    updateFields: ["code", "name", "status", "config"],
    filterFields: { status: "string" },
    searchFields: ["code", "name"],
  }),
  payments: make({
    model: "payment",
    createFields: [
      "paymentCode",
      "targetType",
      "targetId",
      "paymentMethodId",
      "amount",
      "status",
      "transactionCode",
      "note",
      "paidAt",
    ],
    updateFields: [
      "paymentCode",
      "targetType",
      "targetId",
      "paymentMethodId",
      "amount",
      "status",
      "transactionCode",
      "note",
      "paidAt",
    ],
    filterFields: { targetType: "string", targetId: "int", paymentMethodId: "int", status: "string" },
    searchFields: ["paymentCode", "targetType", "transactionCode", "note"],
    transformCreate: withCode("paymentCode", "PAY"),
  }),
  deliveries: make({
    model: "delivery",
    createFields: [
      "onlineOrderId",
      "trackingCode",
      "carrierName",
      "receiverName",
      "receiverPhone",
      "shippingAddress",
      "fee",
      "status",
      "shippedAt",
      "deliveredAt",
    ],
    updateFields: [
      "onlineOrderId",
      "trackingCode",
      "carrierName",
      "receiverName",
      "receiverPhone",
      "shippingAddress",
      "fee",
      "status",
      "shippedAt",
      "deliveredAt",
    ],
    filterFields: { onlineOrderId: "int", status: "string" },
    searchFields: ["trackingCode", "carrierName", "receiverName", "receiverPhone"],
  }),
  promotions: make({
    model: "promotion",
    createFields: [
      "code",
      "name",
      "description",
      "discountType",
      "discountValue",
      "minOrderAmount",
      "maxDiscountAmount",
      "startAt",
      "endAt",
      "status",
    ],
    updateFields: [
      "code",
      "name",
      "description",
      "discountType",
      "discountValue",
      "minOrderAmount",
      "maxDiscountAmount",
      "startAt",
      "endAt",
      "status",
    ],
    filterFields: { status: "string", discountType: "string" },
    searchFields: ["code", "name", "description"],
    listSelect: promotionSelect,
    detailSelect: promotionDetailSelect,
  }),
  promotionProducts: make({
    model: "promotionProduct",
    createFields: ["promotionId", "productId"],
    updateFields: ["promotionId", "productId"],
    filterFields: { promotionId: "int", productId: "int" },
  }),
  deliveryFeeRules: make({
    model: "deliveryFeeRule",
    createFields: ["name", "city", "minOrderAmount", "maxOrderAmount", "fee", "status"],
    updateFields: ["name", "city", "minOrderAmount", "maxOrderAmount", "fee", "status"],
    filterFields: { city: "string", status: "string" },
    searchFields: ["name", "city"],
  }),
  returnPolicies: make({
    model: "returnPolicy",
    createFields: ["title", "content", "allowReturnDays", "status"],
    updateFields: ["title", "content", "allowReturnDays", "status"],
    filterFields: { status: "string" },
    searchFields: ["title", "content"],
  }),
  systemSettings: make({
    model: "systemSetting",
    createFields: ["key", "value", "group", "description"],
    updateFields: ["key", "value", "group", "description"],
    filterFields: { group: "string" },
    searchFields: ["key", "value", "group", "description"],
  }),
  userActivityLogs: make({
    model: "userActivityLog",
    createFields: ["userId", "action", "entityType", "entityId", "ipAddress", "userAgent", "metadata"],
    updateFields: ["userId", "action", "entityType", "entityId", "ipAddress", "userAgent", "metadata"],
    filterFields: { userId: "int", action: "string", entityType: "string", entityId: "int" },
    searchFields: ["action", "entityType", "ipAddress", "userAgent"],
  }),
};

module.exports = resources;
