const prisma = require("../config/db");
const createHttpError = require("../utils/httpError");
const { toInt, toPositiveInt } = require("../utils/number");

const productForCartInclude = {
  category: {
    select: { id: true, name: true, slug: true },
  },
  brand: {
    select: { id: true, name: true, slug: true },
  },
  unit: {
    select: { id: true, name: true, code: true },
  },
  inventory: {
    select: {
      warehouseId: true,
      quantity: true,
      reservedQuantity: true,
    },
  },
};

const getAvailableStock = (product) =>
  product.inventory.reduce(
    (sum, item) => sum + Math.max(item.quantity - item.reservedQuantity, 0),
    0
  );

const addStockSummary = (product) => ({
  ...product,
  totalStock: product.inventory.reduce((sum, item) => sum + item.quantity, 0),
  availableStock: getAvailableStock(product),
  inStock: getAvailableStock(product) > 0,
});

const enrichCart = (cart) => ({
  ...cart,
  items: cart.items.map((item) => {
    const product = addStockSummary(item.product);
    const unitPrice = Number(product.salePrice || 0);

    return {
      ...item,
      product,
      lineTotal: unitPrice * item.quantity,
    };
  }),
  subtotal: cart.items.reduce(
    (sum, item) => sum + Number(item.product.salePrice || 0) * item.quantity,
    0
  ),
});

const assertCartQuantityAvailable = (product, quantity) => {
  const availableStock = getAvailableStock(product);

  if (availableStock < quantity) {
    throw createHttpError(409, "Insufficient inventory", {
      productId: product.id,
      availableQuantity: availableStock,
      requestedQuantity: quantity,
    });
  }
};

const getOrCreateCart = async (userId) =>
  prisma.cart
    .upsert({
      where: { userId },
      update: {},
      create: { userId },
      include: {
        items: {
          include: {
            product: {
              include: productForCartInclude,
            },
          },
          orderBy: {
            updatedAt: "desc",
          },
        },
      },
    })
    .then(enrichCart);

const addCartItem = async (userId, payload) => {
  const productId = toInt(payload.productId, "productId");
  const quantity = toPositiveInt(payload.quantity || 1, "quantity");

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({
      where: { id: productId },
      include: productForCartInclude,
    });

    if (!product || product.status !== "ACTIVE") {
      throw createHttpError(400, "Product is not available");
    }

    const cart = await tx.cart.upsert({
      where: { userId },
      update: {},
      create: { userId },
    });

    const existingItem = await tx.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      select: { quantity: true },
    });
    const nextQuantity = (existingItem?.quantity || 0) + quantity;

    assertCartQuantityAvailable(product, nextQuantity);

    const cartItem = await tx.cartItem.upsert({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId,
        },
      },
      update: {
        quantity: {
          increment: quantity,
        },
      },
      create: {
        cartId: cart.id,
        productId,
        quantity,
      },
      include: {
        product: {
          include: productForCartInclude,
        },
      },
    });

    return {
      ...cartItem,
      product: addStockSummary(cartItem.product),
      lineTotal: Number(cartItem.product.salePrice || 0) * cartItem.quantity,
    };
  });
};

const updateCartItem = async (userId, cartItemId, payload) => {
  const quantity = toPositiveInt(payload.quantity, "quantity");

  return prisma.$transaction(async (tx) => {
    const cartItem = await tx.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
        product: {
          include: productForCartInclude,
        },
      },
    });

    if (!cartItem || cartItem.cart.userId !== userId) {
      throw createHttpError(404, "Cart item not found");
    }

    if (!cartItem.product || cartItem.product.status !== "ACTIVE") {
      throw createHttpError(400, "Product is not available");
    }

    assertCartQuantityAvailable(cartItem.product, quantity);

    const updatedItem = await tx.cartItem.update({
      where: { id: cartItemId },
      data: { quantity },
      include: {
        product: {
          include: productForCartInclude,
        },
      },
    });

    return {
      ...updatedItem,
      product: addStockSummary(updatedItem.product),
      lineTotal: Number(updatedItem.product.salePrice || 0) * updatedItem.quantity,
    };
  });
};

const removeCartItem = async (userId, cartItemId) =>
  prisma.$transaction(async (tx) => {
    const cartItem = await tx.cartItem.findUnique({
      where: { id: cartItemId },
      include: {
        cart: true,
      },
    });

    if (!cartItem || cartItem.cart.userId !== userId) {
      throw createHttpError(404, "Cart item not found");
    }

    await tx.cartItem.delete({
      where: { id: cartItemId },
    });
  });

module.exports = {
  getOrCreateCart,
  addCartItem,
  updateCartItem,
  removeCartItem,
};
