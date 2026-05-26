const createCrudController = require("../utils/crudController");
const slugify = require("../utils/slugify");

const withSlug = (data) => {
  if (!data.slug && data.name) {
    data.slug = slugify(data.name);
  }

  return data;
};

const categoryCrud = createCrudController({
  model: "category",
  createFields: ["name", "slug", "description", "parentId", "status", "position"],
  updateFields: ["name", "slug", "description", "parentId", "status", "position"],
  fieldTypes: {
    parentId: "int",
    position: "int",
  },
  filterFields: {
    parentId: "int",
    status: "string",
  },
  searchFields: ["name", "slug", "description"],
  sortableFields: ["id", "name", "position", "status", "createdAt"],
  defaultOrderBy: { position: "asc" },
  listSelect: {
    id: true,
    name: true,
    slug: true,
    description: true,
    parentId: true,
    status: true,
    position: true,
    createdAt: true,
    updatedAt: true,
  },
  detailSelect: {
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
    children: {
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
      },
    },
  },
  transformCreate: withSlug,
  transformUpdate: withSlug,
  softDeleteData: {
    status: "INACTIVE",
  },
});

module.exports = {
  getCategories: categoryCrud.getAll,
  getCategoryById: categoryCrud.getById,
  createCategory: categoryCrud.createOne,
  updateCategory: categoryCrud.updateOne,
  deleteCategory: categoryCrud.deleteOne,
};
