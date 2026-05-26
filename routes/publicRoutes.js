const express = require("express");
const resources = require("../controllers/v2ResourceControllers");
const { addReadOnlyRoutes } = require("./routeBuilder");

const router = express.Router();

addReadOnlyRoutes(router, "categories", resources.categories);
addReadOnlyRoutes(router, "brands", resources.brands);
addReadOnlyRoutes(router, "units", resources.units);
addReadOnlyRoutes(router, "products", resources.products);
addReadOnlyRoutes(router, "product-images", resources.productImages);
addReadOnlyRoutes(router, "promotions", resources.promotions);
addReadOnlyRoutes(router, "order-statuses", resources.orderStatuses);

module.exports = router;
