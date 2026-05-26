const fs = require('fs');

const categories = [
  { name: "Electronics", slug: "electronics", position: 1 },
  { name: "Fresh Food", slug: "fresh-food", position: 2 },
  { name: "Beverages", slug: "beverages", position: 3 },
  { name: "Fashion", slug: "fashion", position: 4 },
  { name: "Home Living", slug: "home-living", position: 5 },
  { name: "Snacks", slug: "snacks", position: 6 },
  { name: "Personal Care", slug: "personal-care", position: 7 },
  { name: "Home Care", slug: "home-care", position: 8 }
];

const brands = [
  { name: "Mart Choice", slug: "mart-choice" },
  { name: "Samsung", slug: "samsung" },
  { name: "Apple", slug: "apple" },
  { name: "Sony", slug: "sony" },
  { name: "Coca Cola", slug: "coca-cola" },
  { name: "PepsiCo", slug: "pepsico" },
  { name: "Nestle", slug: "nestle" },
  { name: "Unilever", slug: "unilever" },
  { name: "P&G", slug: "pg" },
  { name: "Vinamilk", slug: "vinamilk" },
  { name: "Zara", slug: "zara" },
  { name: "IKEA", slug: "ikea" }
];

const products = [];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomPrice = (min, max) => (Math.random() * (max - min) + min).toFixed(2);

const productNames = {
  "electronics": ["Smartphone X", "Laptop Pro", "Wireless Earbuds", "Smart TV 4K", "Bluetooth Speaker", "Power Bank 10000mAh", "Gaming Mouse", "Mechanical Keyboard", "Tablet 10-inch", "Smartwatch Series 5", "Noise Cancelling Headphones", "USB-C Hub", "External HDD 2TB", "Monitor 27-inch", "Webcam 1080p"],
  "fresh-food": ["Fresh Milk 1L", "Yogurt 4-pack", "Beef Steak 500g", "Pork Belly 500g", "Chicken Breast 500g", "Salmon Fillet 300g", "Apple 1kg", "Banana 1kg", "Orange 1kg", "Cabbage 1kg", "Tomato 1kg", "Potato 1kg", "Carrot 1kg", "Onion 1kg", "Garlic 200g"],
  "beverages": ["Coca Cola 1.5L", "Sprite 1.5L", "Pepsi 1.5L", "Aquafina 500ml", "Dasani 500ml", "Orange Juice 1L", "Apple Juice 1L", "Nescafe 3in1", "Lipton Tea 20-pack", "Red Bull 250ml", "Monster Energy 500ml", "Heineken Beer 330ml", "Tiger Beer 330ml", "Green Tea 500ml", "Oolong Tea 500ml"],
  "fashion": ["Men's T-Shirt", "Women's T-Shirt", "Jeans", "Shorts", "Sneakers", "Running Shoes", "Socks 3-pack", "Jacket", "Sweater", "Cap", "Sunglasses", "Belt", "Backpack", "Handbag", "Wallet"],
  "home-living": ["Bed Sheet Set", "Pillow", "Towel 2-pack", "Desk Lamp", "Wall Clock", "Picture Frame", "Vase", "Storage Box", "Trash Can", "Hangers 10-pack", "Ironing Board", "Clothes Drying Rack", "Doormat", "Curtains", "Cushion Cover"],
  "snacks": ["Lay's Classic 100g", "Oishi Prawn Crackers", "KitKat 4-finger", "Snickers 50g", "Oreo 133g", "Ritz Crackers", "Choco Pie 12-pack", "Pringles Original", "Doritos Nacho Cheese", "Haribo Gummy Bears", "M&M's Peanut 100g", "Toblerone 100g", "Twix 50g", "Skittles 50g", "Popcorn Caramel"],
  "personal-care": ["Clear Shampoo 600g", "Dove Body Wash 500g", "Pantene Shampoo 600g", "Colgate Toothpaste 200g", "P/S Toothpaste 200g", "Listerine 500ml", "Gillette Razor", "Nivea Deodorant", "Sunsilk Shampoo", "Lifebuoy Soap", "Facial Cleanser 100ml", "Body Lotion 200ml", "Hand Sanitizer 500ml", "Cotton Swabs 200-pack", "Wet Wipes 80-pack"],
  "home-care": ["Omo Laundry Liquid 2.8kg", "Ariel Laundry Liquid 2.4kg", "Sunlight Dish Soap 750g", "Vim Toilet Cleaner 900ml", "Comfort Fabric Conditioner 1.8L", "Downy Fabric Conditioner 1.5L", "Duck Toilet Cleaner", "VIM Surface Cleaner", "Glade Air Freshener", "Scotch-Brite Sponge", "Trash Bags 100-pack", "Mop and Bucket Set", "Broom", "Dustpan", "Glass Cleaner 500ml"]
};

const categoryBrandMap = {
  "electronics": ["samsung", "apple", "sony"],
  "fresh-food": ["mart-choice", "vinamilk"],
  "beverages": ["coca-cola", "pepsico", "nestle"],
  "fashion": ["zara", "mart-choice"],
  "home-living": ["ikea", "mart-choice"],
  "snacks": ["pepsico", "nestle"],
  "personal-care": ["unilever", "pg"],
  "home-care": ["unilever", "pg"]
};

let productIndex = 1;
for (const cat of categories) {
  const names = productNames[cat.slug];
  const possibleBrands = categoryBrandMap[cat.slug];
  
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const brand = possibleBrands[i % possibleBrands.length];
    
    let minCost = 0.5, maxCost = 5.0;
    if (cat.slug === "electronics") { minCost = 20; maxCost = 500; }
    else if (cat.slug === "fashion" || cat.slug === "home-living") { minCost = 5; maxCost = 50; }
    
    const cost = parseFloat(randomPrice(minCost, maxCost));
    const sale = (cost * (1 + randomInt(20, 50) / 100)).toFixed(2);
    
    const skuPrefix = cat.slug.substring(0, 3).toUpperCase();
    const sku = `${skuPrefix}-${String(productIndex).padStart(4, '0')}`;
    const barcode = `893${String(productIndex).padStart(9, '0')}`;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    
    products.push([
      sku, barcode, name, slug, cost.toFixed(2), sale, randomInt(50, 300), cat.slug, brand
    ]);
    
    productIndex++;
  }
}

const seedContent = `require("dotenv").config();

const bcrypt = require("bcryptjs");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const passwords = {
  admin: "Admin@123456",
  manager: "Manager@123456",
  staff: "Staff@123456",
  customer: "User@123456",
};

const money = (value) => Number(value).toFixed(2);
const code = (prefix) => \`\${prefix}-\${Date.now()}\`;
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomElement = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomDate = (start, end) => new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));

async function seedRolesAndPermissions() {
  const roles = {};
  const roleSeeds = [
    ["ADMIN", "Admin"],
    ["MANAGER", "Manager"],
    ["STAFF", "Staff"],
    ["CUSTOMER", "Customer"],
  ];

  for (const [roleCode, name] of roleSeeds) {
    roles[roleCode] = await prisma.role.upsert({
      where: { code: roleCode },
      update: { name, isSystem: true },
      create: { code: roleCode, name, isSystem: true },
    });
  }

  const permissionSeeds = [
    ["users.manage", "Manage users", "system"],
    ["products.manage", "Manage products", "catalog"],
    ["inventory.manage", "Manage inventory", "inventory"],
    ["purchase_orders.manage", "Manage purchase orders", "purchase"],
    ["pos.sell", "Sell by POS", "pos"],
    ["online_orders.manage", "Manage online orders", "orders"],
    ["reports.view", "View reports", "reports"],
    ["settings.manage", "Manage settings", "system"],
  ];

  const permissions = [];
  for (const [permissionCode, name, group] of permissionSeeds) {
    const permission = await prisma.permission.upsert({
      where: { code: permissionCode },
      update: { name, group },
      create: { code: permissionCode, name, group },
    });
    permissions.push(permission);
  }

  const rolePermissionMap = {
    ADMIN: permissions.map((item) => item.id),
    MANAGER: permissions
      .filter((item) => item.code !== "settings.manage")
      .map((item) => item.id),
    STAFF: permissions
      .filter((item) => ["pos.sell", "online_orders.manage"].includes(item.code))
      .map((item) => item.id),
    CUSTOMER: [],
  };

  for (const [roleCode, permissionIds] of Object.entries(rolePermissionMap)) {
    for (const permissionId of permissionIds) {
      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: roles[roleCode].id,
            permissionId,
          },
        },
        update: {},
        create: {
          roleId: roles[roleCode].id,
          permissionId,
        },
      });
    }
  }

  return roles;
}

async function seedBranch() {
  const branch = await prisma.branch.upsert({
    where: { code: "MAIN" },
    update: {
      name: "Main Mart",
      phone: "0900000000",
      address: "123 Main Street",
      city: "Ho Chi Minh City",
      status: "ACTIVE",
    },
    create: {
      code: "MAIN",
      name: "Main Mart",
      phone: "0900000000",
      address: "123 Main Street",
      city: "Ho Chi Minh City",
      status: "ACTIVE",
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { code: "MAIN-WH" },
    update: {
      branchId: branch.id,
      name: "Main Warehouse",
      status: "ACTIVE",
    },
    create: {
      branchId: branch.id,
      code: "MAIN-WH",
      name: "Main Warehouse",
      status: "ACTIVE",
    },
  });

  return { branch, warehouse };
}

async function seedUser({ email, fullName, phone, roleId, branchId, rawPassword }) {
  const passwordHash = await bcrypt.hash(rawPassword, 10);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      fullName,
      phone,
      roleId,
      branchId,
      status: "ACTIVE",
      passwordHash,
    },
    create: {
      email,
      passwordHash,
      fullName,
      phone,
      roleId,
      branchId,
      status: "ACTIVE",
    },
  });

  await prisma.cart.upsert({
    where: { userId: user.id },
    update: {},
    create: { userId: user.id },
  });

  return user;
}

async function seedUsers(roles, branch) {
  const admin = await seedUser({
    email: "admin@example.com",
    fullName: "Admin User",
    phone: "0900000001",
    roleId: roles.ADMIN.id,
    branchId: branch.id,
    rawPassword: passwords.admin,
  });

  const manager = await seedUser({
    email: "manager@example.com",
    fullName: "Manager User",
    phone: "0900000002",
    roleId: roles.MANAGER.id,
    branchId: branch.id,
    rawPassword: passwords.manager,
  });

  const staff = await seedUser({
    email: "staff@example.com",
    fullName: "Staff User",
    phone: "0900000003",
    roleId: roles.STAFF.id,
    branchId: branch.id,
    rawPassword: passwords.staff,
  });

  const customers = [];
  for (let i = 1; i <= 20; i++) {
    const customer = await seedUser({
      email: i === 1 ? "customer@example.com" : \`customer\${i}@example.com\`,
      fullName: \`Customer User \${i}\`,
      phone: \`090000\${String(i).padStart(4, '0')}\`,
      roleId: roles.CUSTOMER.id,
      branchId: null,
      rawPassword: passwords.customer,
    });
    
    await prisma.customerProfile.upsert({
      where: { userId: customer.id },
      update: {},
      create: { userId: customer.id },
    });

    await prisma.customerAddress.deleteMany({
      where: { userId: customer.id },
    });

    await prisma.customerAddress.createMany({
      data: [
        {
          userId: customer.id,
          receiverName: \`Customer User \${i}\`,
          receiverPhone: \`090000\${String(i).padStart(4, '0')}\`,
          line1: \`\${100 + i} Test Street\`,
          ward: "Ward 1",
          district: "District 1",
          city: "Ho Chi Minh City",
          isDefault: true,
        }
      ],
    });
    
    customers.push(customer);
  }
  
  const customer = customers[0];

  const carts = await prisma.cart.findMany({
    where: {
      userId: {
        in: [admin.id, manager.id, staff.id, ...customers.map(c => c.id)],
      },
    },
    select: { id: true },
  });

  await prisma.cartItem.deleteMany({
    where: {
      cartId: {
        in: carts.map((cart) => cart.id),
      },
    },
  });

  return { admin, manager, staff, customer, customers };
}

async function seedCatalog() {
  const categorySeeds = ${JSON.stringify(categories, null, 4)};
  
  const categoriesMap = {};
  for (const cat of categorySeeds) {
    categoriesMap[cat.slug] = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, status: "ACTIVE", position: cat.position },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: \`\${cat.name} category\`,
        status: "ACTIVE",
        position: cat.position,
      },
    });
  }

  const brandSeeds = ${JSON.stringify(brands, null, 4)};
  
  const brandsMap = {};
  for (const br of brandSeeds) {
    brandsMap[br.slug] = await prisma.brand.upsert({
      where: { slug: br.slug },
      update: { name: br.name, status: "ACTIVE" },
      create: {
        name: br.name,
        slug: br.slug,
        description: \`\${br.name} brand\`,
        status: "ACTIVE",
      },
    });
  }

  const unit = await prisma.unit.upsert({
    where: { code: "PCS" },
    update: { name: "Piece", status: "ACTIVE" },
    create: { code: "PCS", name: "Piece", status: "ACTIVE" },
  });

  const products = [];
  const productSeeds = ${JSON.stringify(products, null, 4)};
  const seedSkus = productSeeds.map(([sku]) => sku);

  await prisma.product.updateMany({
    where: {
      sku: {
        notIn: seedSkus,
      },
    },
    data: {
      status: "INACTIVE",
    },
  });

  for (const [sku, barcode, name, slug, costPrice, salePrice, stock, catSlug, brandSlug] of productSeeds) {
    const categoryId = categoriesMap[catSlug].id;
    const brandId = brandsMap[brandSlug].id;
    const mainImageUrl = \`https://picsum.photos/seed/\${sku}/600/600\`;
    
    const product = await prisma.product.upsert({
      where: { sku },
      update: {
        categoryId,
        brandId,
        unitId: unit.id,
        barcode,
        name,
        slug,
        costPrice: money(costPrice),
        salePrice: money(salePrice),
        mainImageUrl,
        status: "ACTIVE",
        minStock: 10,
      },
      create: {
        categoryId,
        brandId,
        unitId: unit.id,
        barcode,
        sku,
        name,
        slug,
        description: \`\${name} product. High quality and durable.\`,
        costPrice: money(costPrice),
        salePrice: money(salePrice),
        mainImageUrl,
        status: "ACTIVE",
        minStock: 10,
        soldCount: randomInt(10, 500),
      },
    });

    product.seedStock = stock;
    products.push(product);
  }

  await prisma.productImage.deleteMany({
    where: { productId: { in: products.map((item) => item.id) } },
  });

  await prisma.productImage.createMany({
    data: products.map((product, index) => ({
      productId: product.id,
      url: product.mainImageUrl,
      altText: product.name,
      position: index + 1,
    })),
  });

  return { categories: categoriesMap, brands: brandsMap, unit, products };
}

async function seedInventory(warehouse, products, user) {
  for (const product of products) {
    await prisma.inventory.upsert({
      where: {
        warehouseId_productId: {
          warehouseId: warehouse.id,
          productId: product.id,
        },
      },
      update: {
        quantity: product.seedStock * 5,
        reservedQuantity: 0,
      },
      create: {
        warehouseId: warehouse.id,
        productId: product.id,
        quantity: product.seedStock * 5,
        reservedQuantity: 0,
      },
    });

    await prisma.inventoryTransaction.create({
      data: {
        warehouseId: warehouse.id,
        productId: product.id,
        userId: user.id,
        type: "ADJUSTMENT_IN",
        quantity: product.seedStock * 5,
        beforeQuantity: 0,
        afterQuantity: product.seedStock * 5,
        referenceType: "SEED",
        note: "Seed opening stock",
        createdAt: new Date("2025-12-01T00:00:00Z")
      },
    });
  }
}

async function seedSystemSettings() {
  const statuses = [
    ["PENDING", "Pending", 1, true, false, true],
    ["CONFIRMED", "Confirmed", 2, false, false, false],
    ["PREPARING", "Preparing", 3, false, false, false],
    ["PROCESSING", "Processing", 4, false, false, false],
    ["SHIPPING", "Shipping", 5, false, false, false],
    ["COMPLETED", "Completed", 6, false, true, false],
    ["CANCELLED", "Cancelled", 7, false, true, false],
    ["RETURNED", "Returned", 8, false, true, false],
  ];

  for (const [statusCode, name, position, isDefault, isFinal, allowCancelByCustomer] of statuses) {
    await prisma.orderStatus.upsert({
      where: { code: statusCode },
      update: { name, position, isDefault, isFinal, allowCancelByCustomer, status: "ACTIVE" },
      create: { code: statusCode, name, position, isDefault, isFinal, allowCancelByCustomer, status: "ACTIVE" },
    });
  }

  const cod = await prisma.paymentMethod.upsert({
    where: { code: "COD" },
    update: { name: "Cash on Delivery", status: "ACTIVE" },
    create: { code: "COD", name: "Cash on Delivery", status: "ACTIVE" },
  });

  await prisma.paymentMethod.upsert({
    where: { code: "BANK_TRANSFER" },
    update: { name: "Bank Transfer", status: "ACTIVE" },
    create: { code: "BANK_TRANSFER", name: "Bank Transfer", status: "ACTIVE" },
  });

  await prisma.deliveryFeeRule.upsert({
    where: { id: 1 },
    update: { name: "Default delivery fee", fee: money(2.0), status: "ACTIVE" },
    create: { name: "Default delivery fee", fee: money(2.0), status: "ACTIVE" },
  });

  await prisma.returnPolicy.upsert({
    where: { id: 1 },
    update: {
      title: "Default return policy",
      content: "Products can be returned within 7 days if eligible.",
      allowReturnDays: 7,
      status: "ACTIVE",
    },
    create: {
      title: "Default return policy",
      content: "Products can be returned within 7 days if eligible.",
      allowReturnDays: 7,
      status: "ACTIVE",
    },
  });

  await prisma.systemSetting.upsert({
    where: { key: "store.name" },
    update: { value: "Main Mart", group: "store" },
    create: { key: "store.name", value: "Main Mart", group: "store" },
  });

  return { cod };
}

async function seedPurchaseAndSales({ branch, warehouse, users, products, paymentMethod }) {
  const supplier = await prisma.supplier.upsert({
    where: { code: "SUP-DEFAULT" },
    update: { name: "Default Supplier", status: "ACTIVE" },
    create: {
      code: "SUP-DEFAULT",
      name: "Default Supplier",
      phone: "0911111111",
      email: "supplier@example.com",
      address: "Supplier Address",
      status: "ACTIVE",
    },
  });

  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 5);

  console.log("Generating 300 POS Sales history (5 months)...");
  for (let i = 0; i < 300; i++) {
    const randomDateObj = randomDate(startDate, endDate);
    const saleProducts = Array.from({ length: randomInt(1, 5) }).map(() => randomElement(products));
    const uniqueSaleProducts = [...new Set(saleProducts)];
    
    let subtotal = 0;
    const items = uniqueSaleProducts.map(p => {
      const qty = randomInt(1, 4);
      const total = Number(p.salePrice) * qty;
      subtotal += total;
      return {
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        productBarcode: p.barcode,
        unitPrice: p.salePrice,
        costPrice: p.costPrice,
        quantity: qty,
        totalPrice: money(total),
      };
    });

    const total = subtotal;
    const randomCustomer = randomElement(users.customers);

    await prisma.posSale.create({
      data: {
        code: \`POS-V3-\${randomDateObj.getTime()}-\${i}\`,
        branchId: branch.id,
        staffId: users.staff.id,
        customerId: randomCustomer.id,
        subtotal: money(subtotal),
        total: money(total),
        paidAmount: money(total),
        changeAmount: money(0),
        status: "COMPLETED",
        paymentStatus: "PAID",
        createdAt: randomDateObj,
        updatedAt: randomDateObj,
        items: {
          create: items
        }
      }
    });
  }

  console.log("Generating 200 Online Orders history (5 months)...");
  for (let i = 0; i < 200; i++) {
    const randomDateObj = randomDate(startDate, endDate);
    const orderProducts = Array.from({ length: randomInt(1, 6) }).map(() => randomElement(products));
    const uniqueOrderProducts = [...new Set(orderProducts)];
    
    let subtotal = 0;
    const items = uniqueOrderProducts.map(p => {
      const qty = randomInt(1, 3);
      const total = Number(p.salePrice) * qty;
      subtotal += total;
      return {
        productId: p.id,
        productName: p.name,
        productSku: p.sku,
        productBarcode: p.barcode,
        unitPrice: p.salePrice,
        costPrice: p.costPrice,
        quantity: qty,
        totalPrice: money(total),
      };
    });

    const shippingFee = 2.0;
    const total = subtotal + shippingFee;
    const randomCustomer = randomElement(users.customers);
    
    const isCompleted = randomDateObj < new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    const status = isCompleted ? "COMPLETED" : "PREPARING";

    const onlineOrder = await prisma.onlineOrder.create({
      data: {
        orderCode: \`ONL-V3-\${randomDateObj.getTime()}-\${i}\`,
        customerId: randomCustomer.id,
        branchId: branch.id,
        warehouseId: warehouse.id,
        statusCode: status,
        receiverName: randomCustomer.fullName,
        receiverPhone: randomCustomer.phone,
        shippingAddress: "123 Random Street, Ho Chi Minh City",
        subtotal: money(subtotal),
        shippingFee: money(shippingFee),
        total: money(total),
        paymentStatus: isCompleted ? "PAID" : "UNPAID",
        createdAt: randomDateObj,
        updatedAt: randomDateObj,
        items: {
          create: items
        }
      }
    });

    await prisma.delivery.create({
      data: {
        onlineOrderId: onlineOrder.id,
        receiverName: randomCustomer.fullName,
        receiverPhone: randomCustomer.phone,
        shippingAddress: "123 Random Street, Ho Chi Minh City",
        fee: money(shippingFee),
        status: isCompleted ? "DELIVERED" : "PREPARING",
        createdAt: randomDateObj,
        updatedAt: randomDateObj,
      }
    });

    if (isCompleted) {
      await prisma.payment.create({
        data: {
          paymentCode: \`PAY-V3-\${randomDateObj.getTime()}-\${i}\`,
          targetType: "ONLINE_ORDER",
          targetId: onlineOrder.id,
          paymentMethodId: paymentMethod.id,
          amount: onlineOrder.total,
          status: "PAID",
          paidAt: randomDateObj,
          createdAt: randomDateObj,
          updatedAt: randomDateObj,
        }
      });
    }
  }

  // Update customer profiles
  for (const customer of users.customers) {
    const posSales = await prisma.posSale.findMany({ where: { customerId: customer.id } });
    const onlineOrders = await prisma.onlineOrder.findMany({ where: { customerId: customer.id } });
    
    const totalOrders = posSales.length + onlineOrders.length;
    const totalSpent = posSales.reduce((sum, sale) => sum + Number(sale.total), 0) + 
                       onlineOrders.reduce((sum, order) => sum + Number(order.total), 0);
                       
    await prisma.customerProfile.update({
      where: { userId: customer.id },
      data: {
        totalOrders,
        totalSpent: money(totalSpent),
        loyaltyPoints: Math.floor(totalSpent),
      }
    });
  }

  return { supplier };
}

async function seedPromotion(products) {
  const promotion = await prisma.promotion.upsert({
    where: { code: "PROMO-SEED-10" },
    update: {
      name: "Seed 10 Percent",
      discountType: "PERCENT",
      discountValue: money(10),
      startAt: new Date("2026-01-01T00:00:00.000Z"),
      endAt: new Date("2026-12-31T23:59:59.000Z"),
      status: "ACTIVE",
    },
    create: {
      code: "PROMO-SEED-10",
      name: "Seed 10 Percent",
      description: "Seed promotion for testing",
      discountType: "PERCENT",
      discountValue: money(10),
      startAt: new Date("2026-01-01T00:00:00.000Z"),
      endAt: new Date("2026-12-31T23:59:59.000Z"),
      status: "ACTIVE",
    },
  });

  await prisma.promotionProduct.upsert({
    where: {
      promotionId_productId: {
        promotionId: promotion.id,
        productId: products[0].id,
      },
    },
    update: {},
    create: {
      promotionId: promotion.id,
      productId: products[0].id,
    },
  });
}

async function main() {
  const roles = await seedRolesAndPermissions();
  const { branch, warehouse } = await seedBranch();
  const users = await seedUsers(roles, branch);
  const catalog = await seedCatalog();
  await seedInventory(warehouse, catalog.products, users.manager);
  const system = await seedSystemSettings();
  const transactions = await seedPurchaseAndSales({
    branch,
    warehouse,
    users,
    products: catalog.products,
    paymentMethod: system.cod,
  });
  await seedPromotion(catalog.products);

  console.log("Seed v3 massive completed successfully");
  console.log({
    admin: { email: "admin@example.com", password: passwords.admin },
    manager: { email: "manager@example.com", password: passwords.manager },
    staff: { email: "staff@example.com", password: passwords.staff },
    customer: { email: "customer@example.com", password: passwords.customer },
    branch: branch.code,
    warehouse: warehouse.code,
    products: catalog.products.length,
    customers: users.customers.length,
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
`;

fs.writeFileSync('prisma/seed.js', seedContent);
console.log('Successfully wrote new seed.js!');
