const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");
const createHttpError = require("../utils/httpError");
const { toInt } = require("../utils/number");

const productInclude = {
  category: {
    select: { id: true, name: true, slug: true, parentId: true },
  },
  brand: {
    select: { id: true, name: true, slug: true },
  },
  unit: {
    select: { id: true, name: true, code: true },
  },
  images: {
    select: { id: true, url: true, altText: true, position: true },
    orderBy: { position: "asc" },
  },
  inventory: {
    select: { warehouseId: true, quantity: true, reservedQuantity: true },
  },
};

const getPagination = (query) => {
  const page = Math.max(Number.parseInt(query.page || "1", 10), 1);
  const limit = Math.min(
    Math.max(Number.parseInt(query.limit || "20", 10), 1),
    100
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const getProductStockSummary = (product) => {
  const totalStock = product.inventory.reduce(
    (sum, item) => sum + item.quantity,
    0
  );
  const availableStock = product.inventory.reduce(
    (sum, item) => sum + Math.max(item.quantity - item.reservedQuantity, 0),
    0
  );

  return {
    ...product,
    totalStock,
    availableStock,
    inStock: availableStock > 0,
  };
};

const getDescendantCategoryIds = async (categoryId) => {
  const ids = [categoryId];
  let currentLevel = [categoryId];

  while (currentLevel.length > 0) {
    const children = await prisma.category.findMany({
      where: {
        parentId: { in: currentLevel },
        status: "ACTIVE",
      },
      select: { id: true },
    });

    currentLevel = children.map((item) => item.id);
    ids.push(...currentLevel);
  }

  return ids;
};

const buildProductWhere = async (query) => {
  const where = { status: "ACTIVE" };
  const keyword = (query.keyword || query.q || "").trim();

  if (keyword) {
    where.OR = [
      { name: { contains: keyword } },
      { sku: { contains: keyword } },
      { barcode: { contains: keyword } },
      { description: { contains: keyword } },
    ];
  }

  if (query.categoryId) {
    where.categoryId = {
      in: await getDescendantCategoryIds(toInt(query.categoryId, "categoryId")),
    };
  }

  return where;
};

const getProductOrderBy = (sort) => {
  const map = {
    price_asc: { salePrice: "asc" },
    price_desc: { salePrice: "desc" },
    newest: { createdAt: "desc" },
    best_selling: { soldCount: "desc" },
    rating: { ratingAvg: "desc" },
  };

  return map[sort] || { createdAt: "desc" };
};

const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, skip } = getPagination(req.query);
  const where = await buildProductWhere(req.query);

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: getProductOrderBy(req.query.sort),
      skip,
      take: limit,
    }),
  ]);

  res.json({
    data: products.map(getProductStockSummary),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

const searchProducts = listProducts;

const getBestSellingProducts = asyncHandler(async (req, res) => {
  const limit = Math.min(
    Math.max(Number.parseInt(req.query.limit || "10", 10), 1),
    50
  );

  const products = await prisma.product.findMany({
    where: { status: "ACTIVE" },
    include: productInclude,
    orderBy: [{ soldCount: "desc" }, { ratingAvg: "desc" }],
    take: limit,
  });

  res.json({ data: products.map(getProductStockSummary) });
});

const getProductById = asyncHandler(async (req, res) => {
  const parsedId = Number.parseInt(req.params.id, 10);
  const isNumericId = parsedId.toString() === req.params.id;
  const where = isNumericId
    ? { id: parsedId, status: "ACTIVE" }
    : { slug: req.params.id, status: "ACTIVE" };

  const product = await prisma.product.findFirst({
    where,
    include: {
      ...productInclude,
      reviews: {
        where: { status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          rating: true,
          content: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!product) {
    throw createHttpError(404, "Product not found");
  }

  res.json({ data: getProductStockSummary(product) });
});

const getCategories = asyncHandler(async (req, res) => {
  const categories = await prisma.category.findMany({
    where: { status: "ACTIVE" },
    orderBy: [{ parentId: "asc" }, { position: "asc" }, { name: "asc" }],
    include: {
      children: {
        where: { status: "ACTIVE" },
        orderBy: [{ position: "asc" }, { name: "asc" }],
      },
    },
  });

  res.json({ data: categories });
});

module.exports = {
  listProducts,
  searchProducts,
  getBestSellingProducts,
  getProductById,
  getCategories,
};
