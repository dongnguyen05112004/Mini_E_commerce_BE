const createCrudController = require("../utils/crudController");

const productImageCrud = createCrudController({
  model: "productImage",
  createFields: ["productId", "url", "altText", "position"],
  updateFields: ["productId", "url", "altText", "position"],
  fieldTypes: {
    productId: "int",
    position: "int",
  },
  filterFields: {
    productId: "int",
  },
  searchFields: ["url", "altText"],
  sortableFields: ["id", "productId", "position", "createdAt"],
  defaultOrderBy: { position: "asc" },
  listSelect: {
    id: true,
    productId: true,
    url: true,
    altText: true,
    position: true,
    createdAt: true,
  },
  detailSelect: {
    id: true,
    productId: true,
    url: true,
    altText: true,
    position: true,
    createdAt: true,
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
  getProductImages: productImageCrud.getAll,
  getProductImageById: productImageCrud.getById,
  createProductImage: productImageCrud.createOne,
  updateProductImage: productImageCrud.updateOne,
  deleteProductImage: productImageCrud.deleteOne,
};
