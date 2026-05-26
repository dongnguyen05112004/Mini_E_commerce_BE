const bcrypt = require("bcryptjs");
const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const createHttpError = require("../utils/httpError");
const { toInt, toMoney, toPositiveInt } = require("../utils/number");

const asTrimmedString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const myProfileSelect = {
  id: true,
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
  customerProfile: true,
  addresses: {
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  },
};

const requireAddressFields = (body, isCreate = true) => {
  const data = {};

  [
    "receiverName",
    "receiverPhone",
    "line1",
    "ward",
    "district",
    "city",
  ].forEach((field) => {
    if (body[field] !== undefined) {
      data[field] = asTrimmedString(body[field]);
    }
  });

  if (isCreate) {
    ["receiverName", "receiverPhone", "line1", "city"].forEach((field) => {
      if (!data[field]) {
        throw createHttpError(400, `${field} is required`);
      }
    });
  }

  if (body.isDefault !== undefined) {
    data.isDefault = Boolean(body.isDefault);
  }

  return data;
};

const clearOtherDefaultAddresses = (tx, userId, exceptId) =>
  tx.customerAddress.updateMany({
    where: {
      userId,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { isDefault: false },
  });

const attachPaymentsToOrders = async (orders) => {
  if (orders.length === 0) return orders;

  const payments = await prisma.payment.findMany({
    where: {
      targetType: "ONLINE_ORDER",
      targetId: {
        in: orders.map((order) => order.id),
      },
    },
    include: {
      paymentMethod: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const paymentMap = payments.reduce((map, payment) => {
    if (!map.has(payment.targetId)) {
      map.set(payment.targetId, []);
    }

    map.get(payment.targetId).push(payment);
    return map;
  }, new Map());

  return orders.map((order) => ({
    ...order,
    payments: paymentMap.get(order.id) || [],
  }));
};

const recalculateProductRating = async (tx, productId) => {
  const aggregate = await tx.productReview.aggregate({
    where: {
      productId,
      status: "ACTIVE",
    },
    _avg: { rating: true },
    _count: { _all: true },
  });

  await tx.product.update({
    where: { id: productId },
    data: {
      ratingAvg: toMoney(aggregate._avg.rating || 0),
      ratingCount: aggregate._count._all,
    },
  });
};

const getMyProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: myProfileSelect,
  });

  res.json({ data: user });
});

const updateMyProfile = asyncHandler(async (req, res) => {
  const data = {};
  const profileData = {};

  if (req.body.fullName !== undefined) {
    data.fullName = asTrimmedString(req.body.fullName);
    if (!data.fullName) {
      throw createHttpError(400, "fullName is required");
    }
  }

  if (req.body.email !== undefined) {
    data.email = asTrimmedString(req.body.email).toLowerCase();
    if (!data.email) {
      throw createHttpError(400, "email is required");
    }
  }

  if (req.body.phone !== undefined) {
    data.phone = asTrimmedString(req.body.phone);
    if (!data.phone) {
      throw createHttpError(400, "phone is required");
    }
  }

  if (req.body.birthDate !== undefined) {
    const birthDate = new Date(req.body.birthDate);
    if (Number.isNaN(birthDate.getTime())) {
      throw createHttpError(400, "birthDate must be a valid date");
    }
    profileData.birthDate = birthDate;
  }

  if (req.body.gender !== undefined) {
    profileData.gender = req.body.gender
      ? asTrimmedString(req.body.gender)
      : null;
  }

  if (Object.keys(data).length === 0 && Object.keys(profileData).length === 0) {
    throw createHttpError(400, "No valid fields provided");
  }

  if (data.email || data.phone) {
    const duplicate = await prisma.user.findFirst({
      where: {
        id: { not: req.user.id },
        OR: [
          ...(data.email ? [{ email: data.email }] : []),
          ...(data.phone ? [{ phone: data.phone }] : []),
        ],
      },
      select: { email: true, phone: true },
    });

    if (duplicate) {
      throw createHttpError(
        409,
        duplicate.email === data.email
          ? "Email already exists"
          : "Phone already exists"
      );
    }
  }

  const user = await prisma.$transaction(async (tx) => {
    if (Object.keys(profileData).length > 0) {
      await tx.customerProfile.upsert({
        where: { userId: req.user.id },
        update: profileData,
        create: {
          userId: req.user.id,
          ...profileData,
        },
      });
    }

    if (Object.keys(data).length > 0) {
      await tx.user.update({
        where: { id: req.user.id },
        data,
      });
    }

    return tx.user.findUnique({
      where: { id: req.user.id },
      select: myProfileSelect,
    });
  });

  res.json({ data: user });
});

const changeMyPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  if (!oldPassword || !newPassword) {
    throw createHttpError(400, "oldPassword and newPassword are required");
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, passwordHash: true },
  });

  const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!isMatch) {
    throw createHttpError(400, "Old password is incorrect");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: req.user.id },
    data: { passwordHash },
  });

  res.json({ message: "Password changed successfully" });
});

const getMyAddresses = asyncHandler(async (req, res) => {
  const addresses = await prisma.customerAddress.findMany({
    where: { userId: req.user.id },
    orderBy: [{ isDefault: "desc" }, { updatedAt: "desc" }],
  });

  res.json({ data: addresses });
});

const createMyAddress = asyncHandler(async (req, res) => {
  const data = requireAddressFields(req.body);

  const address = await prisma.$transaction(async (tx) => {
    const addressCount = await tx.customerAddress.count({
      where: { userId: req.user.id },
    });
    const isDefault = data.isDefault === true || addressCount === 0;

    if (isDefault) {
      await clearOtherDefaultAddresses(tx, req.user.id);
    }

    return tx.customerAddress.create({
      data: {
        ...data,
        userId: req.user.id,
        isDefault,
      },
    });
  });

  res.status(201).json({ data: address });
});

const updateMyAddress = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id, "id");

  const address = await prisma.customerAddress.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!address) {
    throw createHttpError(404, "Address not found");
  }

  const data = requireAddressFields(req.body, false);

  if (Object.keys(data).length === 0) {
    throw createHttpError(400, "No valid fields provided");
  }

  const updatedAddress = await prisma.$transaction(async (tx) => {
    if (data.isDefault === true) {
      await clearOtherDefaultAddresses(tx, req.user.id, id);
    }

    return tx.customerAddress.update({
      where: { id },
      data,
    });
  });

  res.json({ data: updatedAddress });
});

const deleteMyAddress = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id, "id");

  const address = await prisma.customerAddress.findFirst({
    where: {
      id,
      userId: req.user.id,
    },
  });

  if (!address) {
    throw createHttpError(404, "Address not found");
  }

  const usedOrderCount = await prisma.onlineOrder.count({
    where: {
      customerId: req.user.id,
      addressId: id,
    },
  });

  if (usedOrderCount > 0) {
    throw createHttpError(409, "Address is used by an existing order");
  }

  await prisma.customerAddress.delete({ where: { id } });

  res.status(204).send();
});

const getMyOnlineOrders = asyncHandler(async (req, res) => {
  const page = Math.max(Number.parseInt(req.query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit || "20", 10), 1),
    100
  );
  const where = {
    customerId: req.user.id,
  };

  if (req.query.status || req.query.statusCode) {
    where.statusCode = (req.query.status || req.query.statusCode)
      .toString()
      .toUpperCase();
  }

  if (req.query.from || req.query.to) {
    where.createdAt = {};
    if (req.query.from) where.createdAt.gte = new Date(req.query.from);
    if (req.query.to) where.createdAt.lte = new Date(req.query.to);
  }

  const [orders, total] = await Promise.all([
    prisma.onlineOrder.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: {
        createdAt: "desc",
      },
      include: {
        status: true,
        items: true,
        delivery: true,
        logs: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    }),
    prisma.onlineOrder.count({ where }),
  ]);

  res.json({
    data: await attachPaymentsToOrders(orders),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

const getMyOnlineOrderById = asyncHandler(async (req, res) => {
  const id = toInt(req.params.id, "id");

  const order = await prisma.onlineOrder.findFirst({
    where: {
      id,
      customerId: req.user.id,
    },
    include: {
      status: true,
      items: true,
      delivery: true,
      logs: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!order) {
    throw createHttpError(404, "Online order not found");
  }

  const [orderWithPayments] = await attachPaymentsToOrders([order]);

  res.json({ data: orderWithPayments });
});

const getMyOnlineOrderByCode = asyncHandler(async (req, res) => {
  const order = await prisma.onlineOrder.findFirst({
    where: {
      orderCode: req.params.code,
      customerId: req.user.id,
    },
    include: {
      status: true,
      items: true,
      delivery: true,
      logs: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!order) {
    throw createHttpError(404, "Online order not found");
  }

  const [orderWithPayments] = await attachPaymentsToOrders([order]);

  res.json({ data: orderWithPayments });
});

const getPaymentMethods = asyncHandler(async (req, res) => {
  const paymentMethods = await prisma.paymentMethod.findMany({
    where: { status: "ACTIVE" },
    orderBy: { id: "asc" },
  });

  res.json({ data: paymentMethods });
});

const getMyReviews = asyncHandler(async (req, res) => {
  const reviews = await prisma.productReview.findMany({
    where: { userId: req.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      product: {
        select: {
          id: true,
          name: true,
          sku: true,
          mainImageUrl: true,
        },
      },
      onlineOrder: {
        select: {
          id: true,
          orderCode: true,
          statusCode: true,
        },
      },
    },
  });

  res.json({ data: reviews });
});

const createProductReview = asyncHandler(async (req, res) => {
  const productId = toInt(req.body.productId, "productId");
  const onlineOrderId = toInt(
    req.body.onlineOrderId || req.body.orderId,
    "onlineOrderId"
  );
  const rating = toPositiveInt(req.body.rating, "rating");
  const content = asTrimmedString(req.body.content) || null;

  if (rating > 5) {
    throw createHttpError(400, "rating must be between 1 and 5");
  }

  const review = await prisma.$transaction(async (tx) => {
    const order = await tx.onlineOrder.findFirst({
      where: {
        id: onlineOrderId,
        customerId: req.user.id,
      },
      include: {
        items: true,
      },
    });

    if (!order) {
      throw createHttpError(404, "Online order not found");
    }

    if (order.statusCode !== "COMPLETED") {
      throw createHttpError(403, "Only completed orders can be reviewed");
    }

    const orderItem = order.items.find((item) => item.productId === productId);
    if (!orderItem) {
      throw createHttpError(400, "Product is not in this order");
    }

    const existingReview = await tx.productReview.findUnique({
      where: {
        userId_productId_onlineOrderId: {
          userId: req.user.id,
          productId,
          onlineOrderId,
        },
      },
    });

    if (existingReview) {
      throw createHttpError(409, "Product already reviewed for this order");
    }

    const createdReview = await tx.productReview.create({
      data: {
        userId: req.user.id,
        productId,
        onlineOrderId,
        onlineOrderItemId: orderItem.id,
        rating,
        content,
        status: "ACTIVE",
      },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            sku: true,
            mainImageUrl: true,
          },
        },
      },
    });

    await recalculateProductRating(tx, productId);

    return createdReview;
  });

  res.status(201).json({ data: review });
});

module.exports = {
  getMyProfile,
  updateMyProfile,
  changeMyPassword,
  getMyAddresses,
  createMyAddress,
  updateMyAddress,
  deleteMyAddress,
  getMyOnlineOrders,
  getMyOnlineOrderById,
  getMyOnlineOrderByCode,
  getPaymentMethods,
  getMyReviews,
  createProductReview,
};
