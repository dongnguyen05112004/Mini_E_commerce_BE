const createCrudController = require("../utils/crudController");
const slugify = require("../utils/slugify");

const withSlug = (data) => {
  if (!data.slug && data.name) {
    data.slug = slugify(data.name);
  }

  return data;
};

const productListSelect = {
  id: true,
  categoryId: true,
  name: true,
  slug: true,
  sku: true,
  price: true,
  salePrice: true,
  stock: true,
  mainImageUrl: true,
  status: true,
  soldCount: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
    },
  },
};

const productDetailSelect = {
  ...productListSelect,
  description: true,
  images: {
    select: {
      id: true,
      url: true,
      altText: true,
      position: true,
      createdAt: true,
    },
    orderBy: {
      position: "asc",
    },
  },
};

const productCrud = createCrudController({
  model: "product",
  createFields: [
    "categoryId",
    "name",
    "slug",
    "sku",
    "description",
    "price",
    "salePrice",
    "stock",
    "mainImageUrl",
    "status",
    "soldCount",
    "ratingAvg",
    "ratingCount",
  ],
  updateFields: [
    "categoryId",
    "name",
    "slug",
    "sku",
    "description",
    "price",
    "salePrice",
    "stock",
    "mainImageUrl",
    "status",
    "soldCount",
    "ratingAvg",
    "ratingCount",
  ],
  fieldTypes: {
    categoryId: "int",
    price: "decimal",
    salePrice: "decimal",
    stock: "int",
    soldCount: "int",
    ratingAvg: "decimal",
    ratingCount: "int",
  },
  filterFields: {
    categoryId: "int",
    status: "string",
  },
  searchFields: ["name", "slug", "sku", "description"],
  sortableFields: [
    "id",
    "name",
    "price",
    "stock",
    "soldCount",
    "ratingAvg",
    "createdAt",
    "updatedAt",
  ],
  defaultOrderBy: { createdAt: "desc" },
  listSelect: productListSelect,
  detailSelect: productDetailSelect,
  transformCreate: withSlug,
  transformUpdate: withSlug,
  softDeleteData: {
    status: "INACTIVE",
  },
});

module.exports = {
  getProducts: productCrud.getAll,
  getProductById: productCrud.getById,
  createProduct: productCrud.createOne,
  updateProduct: productCrud.updateOne,
  deleteProduct: productCrud.deleteOne,
};
