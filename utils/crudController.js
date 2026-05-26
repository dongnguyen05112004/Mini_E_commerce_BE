const prisma = require("../config/db");
const asyncHandler = require("./asyncHandler");

const MAX_LIMIT = 100;

const parseIntField = (value, field) => {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed)) {
    const error = new Error(`${field} must be an integer`);
    error.statusCode = 400;
    throw error;
  }

  return parsed;
};

const parseBooleanField = (value) => {
  if (typeof value === "boolean") return value;
  if (value === "true" || value === "1") return true;
  if (value === "false" || value === "0") return false;

  const error = new Error("Value must be a boolean");
  error.statusCode = 400;
  throw error;
};

const getPagination = (query) => {
  const page = Math.max(parseIntField(query.page || "1", "page"), 1);
  const limit = Math.min(
    Math.max(parseIntField(query.limit || "20", "limit"), 1),
    MAX_LIMIT
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
};

const normalizeValue = (value, type, field) => {
  if (value === null) return null;

  if (type === "int") return parseIntField(value, field);
  if (type === "boolean") return parseBooleanField(value);
  if (type === "decimal") return value.toString();

  return value;
};

const pickData = (body, fields, fieldTypes = {}) => {
  const data = {};

  fields.forEach((field) => {
    if (body[field] !== undefined) {
      data[field] = normalizeValue(body[field], fieldTypes[field], field);
    }
  });

  return data;
};

const buildWhere = (query, filterFields = {}, searchFields = []) => {
  const where = {};

  Object.entries(filterFields).forEach(([field, type]) => {
    if (query[field] !== undefined && query[field] !== "") {
      where[field] = normalizeValue(query[field], type, field);
    }
  });

  if (query.q && searchFields.length > 0) {
    where.OR = searchFields.map((field) => ({
      [field]: {
        contains: query.q,
      },
    }));
  }

  return where;
};

const buildOrderBy = (query, sortableFields, defaultOrderBy) => {
  if (!query.sort) return defaultOrderBy;

  const [field, direction = "asc"] = query.sort.split(":");

  if (!sortableFields.includes(field)) return defaultOrderBy;

  return {
    [field]: direction.toLowerCase() === "desc" ? "desc" : "asc",
  };
};

const applyReadShape = (options, select, include) => {
  if (select) {
    options.select = select;
    return options;
  }

  if (include) {
    options.include = include;
  }

  return options;
};

const createCrudController = ({
  model,
  createFields,
  updateFields,
  fieldTypes = {},
  filterFields = {},
  searchFields = [],
  sortableFields = ["id", "createdAt", "updatedAt"],
  defaultOrderBy = { id: "desc" },
  listSelect,
  detailSelect,
  listInclude,
  detailInclude,
  transformCreate,
  transformUpdate,
  afterCreate,
  softDeleteData,
}) => {
  const delegate = prisma[model];

  const getAll = asyncHandler(async (req, res) => {
    const { page, limit, skip } = getPagination(req.query);
    const where = buildWhere(req.query, filterFields, searchFields);
    const orderBy = buildOrderBy(req.query, sortableFields, defaultOrderBy);

    const findOptions = applyReadShape(
      {
        where,
        orderBy,
        skip,
        take: limit,
      },
      listSelect,
      listInclude
    );

    const [total, items] = await prisma.$transaction([
      delegate.count({ where }),
      delegate.findMany(findOptions),
    ]);

    res.json({
      data: items,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  });

  const getById = asyncHandler(async (req, res) => {
    const id = parseIntField(req.params.id, "id");
    const findOptions = applyReadShape(
      {
        where: { id },
      },
      detailSelect,
      detailInclude
    );

    const item = await delegate.findUnique(findOptions);

    if (!item) {
      return res.status(404).json({
        message: "Resource not found",
      });
    }

    res.json({
      data: item,
    });
  });

  const createOne = asyncHandler(async (req, res) => {
    let data = pickData(req.body, createFields, fieldTypes);

    if (transformCreate) {
      data = await transformCreate(data, req);
    }

    const createOptions = applyReadShape(
      {
        data,
      },
      detailSelect,
      detailInclude
    );

    const item = await delegate.create(createOptions);

    if (afterCreate) {
      await afterCreate(item, req);
    }

    res.status(201).json({
      data: item,
    });
  });

  const updateOne = asyncHandler(async (req, res) => {
    const id = parseIntField(req.params.id, "id");
    let data = pickData(req.body, updateFields, fieldTypes);

    if (transformUpdate) {
      data = await transformUpdate(data, req);
    }

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        message: "No valid fields provided",
      });
    }

    const updateOptions = applyReadShape(
      {
        where: { id },
        data,
      },
      detailSelect,
      detailInclude
    );

    const item = await delegate.update(updateOptions);

    res.json({
      data: item,
    });
  });

  const deleteOne = asyncHandler(async (req, res) => {
    const id = parseIntField(req.params.id, "id");

    if (softDeleteData) {
      await delegate.update({
        where: { id },
        data: softDeleteData,
      });
    } else {
      await delegate.delete({
        where: { id },
      });
    }

    res.status(204).send();
  });

  return {
    getAll,
    getById,
    createOne,
    updateOne,
    deleteOne,
  };
};

module.exports = createCrudController;
