const asyncHandler = require("../utils/asyncHandler");
const { toInt } = require("../utils/number");
const cartWorkflowService = require("../services/cartWorkflowService");
const onlineOrderService = require("../services/onlineOrderService");
const posService = require("../services/posService");
const purchaseOrderService = require("../services/purchaseOrderService");

const getMyCart = asyncHandler(async (req, res) => {
  const cart = await cartWorkflowService.getOrCreateCart(req.user.id);

  res.json({
    data: cart,
  });
});

const addCartItem = asyncHandler(async (req, res) => {
  const cartItem = await cartWorkflowService.addCartItem(req.user.id, req.body);

  res.status(201).json({
    data: cartItem,
  });
});

const updateCartItem = asyncHandler(async (req, res) => {
  const cartItem = await cartWorkflowService.updateCartItem(
    req.user.id,
    toInt(req.params.id, "id"),
    req.body
  );

  res.json({
    data: cartItem,
  });
});

const removeCartItem = asyncHandler(async (req, res) => {
  await cartWorkflowService.removeCartItem(req.user.id, toInt(req.params.id, "id"));

  res.status(204).send();
});

const checkoutOnlineOrder = asyncHandler(async (req, res) => {
  const order = await onlineOrderService.createOnlineOrderFromCart(
    req.body,
    req.user
  );

  res.status(201).json({
    data: order,
  });
});

const updateOnlineOrderStatus = asyncHandler(async (req, res) => {
  const order = await onlineOrderService.updateOnlineOrderStatus(
    toInt(req.params.id, "id"),
    req.body,
    req.user
  );

  res.json({
    data: order,
  });
});

const cancelOnlineOrder = asyncHandler(async (req, res) => {
  const order = await onlineOrderService.cancelOnlineOrder(
    toInt(req.params.id, "id"),
    req.body,
    req.user
  );

  res.json({
    data: order,
  });
});

const checkoutPosSale = asyncHandler(async (req, res) => {
  const sale = await posService.createPosSale(req.body, req.user);

  res.status(201).json({
    data: sale,
  });
});

const createPurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await purchaseOrderService.createPurchaseOrder(
    req.body,
    req.user
  );

  res.status(201).json({
    data: purchaseOrder,
  });
});

const approvePurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await purchaseOrderService.approvePurchaseOrder(
    toInt(req.params.id, "id"),
    req.user
  );

  res.json({
    data: purchaseOrder,
  });
});

const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const purchaseOrder = await purchaseOrderService.receivePurchaseOrder(
    toInt(req.params.id, "id"),
    req.user
  );

  res.json({
    data: purchaseOrder,
  });
});

module.exports = {
  getMyCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
  checkoutOnlineOrder,
  updateOnlineOrderStatus,
  cancelOnlineOrder,
  checkoutPosSale,
  createPurchaseOrder,
  approvePurchaseOrder,
  receivePurchaseOrder,
};
