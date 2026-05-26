require("dotenv").config();

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
const code = (prefix) => `${prefix}-${Date.now()}`;
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
      email: i === 1 ? "customer@example.com" : `customer${i}@example.com`,
      fullName: `Customer User ${i}`,
      phone: `090000${String(i).padStart(4, '0')}`,
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
          receiverName: `Customer User ${i}`,
          receiverPhone: `090000${String(i).padStart(4, '0')}`,
          line1: `${100 + i} Test Street`,
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
  const categorySeeds = [
    {
        "name": "Electronics",
        "slug": "electronics",
        "position": 1
    },
    {
        "name": "Fresh Food",
        "slug": "fresh-food",
        "position": 2
    },
    {
        "name": "Beverages",
        "slug": "beverages",
        "position": 3
    },
    {
        "name": "Fashion",
        "slug": "fashion",
        "position": 4
    },
    {
        "name": "Home Living",
        "slug": "home-living",
        "position": 5
    },
    {
        "name": "Snacks",
        "slug": "snacks",
        "position": 6
    },
    {
        "name": "Personal Care",
        "slug": "personal-care",
        "position": 7
    },
    {
        "name": "Home Care",
        "slug": "home-care",
        "position": 8
    }
];
  
  const categoriesMap = {};
  for (const cat of categorySeeds) {
    categoriesMap[cat.slug] = await prisma.category.upsert({
      where: { slug: cat.slug },
      update: { name: cat.name, status: "ACTIVE", position: cat.position },
      create: {
        name: cat.name,
        slug: cat.slug,
        description: `${cat.name} category`,
        status: "ACTIVE",
        position: cat.position,
      },
    });
  }

  const brandSeeds = [
    {
        "name": "Mart Choice",
        "slug": "mart-choice"
    },
    {
        "name": "Samsung",
        "slug": "samsung"
    },
    {
        "name": "Apple",
        "slug": "apple"
    },
    {
        "name": "Sony",
        "slug": "sony"
    },
    {
        "name": "Coca Cola",
        "slug": "coca-cola"
    },
    {
        "name": "PepsiCo",
        "slug": "pepsico"
    },
    {
        "name": "Nestle",
        "slug": "nestle"
    },
    {
        "name": "Unilever",
        "slug": "unilever"
    },
    {
        "name": "P&G",
        "slug": "pg"
    },
    {
        "name": "Vinamilk",
        "slug": "vinamilk"
    },
    {
        "name": "Zara",
        "slug": "zara"
    },
    {
        "name": "IKEA",
        "slug": "ikea"
    }
];
  
  const brandsMap = {};
  for (const br of brandSeeds) {
    brandsMap[br.slug] = await prisma.brand.upsert({
      where: { slug: br.slug },
      update: { name: br.name, status: "ACTIVE" },
      create: {
        name: br.name,
        slug: br.slug,
        description: `${br.name} brand`,
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
  const productSeeds = [
    [
        "ELE-0001",
        "893000000001",
        "Smartphone X",
        "smartphone-x",
        "21.16",
        "30.26",
        238,
        "electronics",
        "samsung"
    ],
    [
        "ELE-0002",
        "893000000002",
        "Laptop Pro",
        "laptop-pro",
        "232.24",
        "327.46",
        77,
        "electronics",
        "apple"
    ],
    [
        "ELE-0003",
        "893000000003",
        "Wireless Earbuds",
        "wireless-earbuds",
        "82.31",
        "101.24",
        214,
        "electronics",
        "sony"
    ],
    [
        "ELE-0004",
        "893000000004",
        "Smart TV 4K",
        "smart-tv-4k",
        "417.39",
        "601.04",
        52,
        "electronics",
        "samsung"
    ],
    [
        "ELE-0005",
        "893000000005",
        "Bluetooth Speaker",
        "bluetooth-speaker",
        "407.37",
        "611.06",
        272,
        "electronics",
        "apple"
    ],
    [
        "ELE-0006",
        "893000000006",
        "Power Bank 10000mAh",
        "power-bank-10000mah",
        "180.09",
        "241.32",
        215,
        "electronics",
        "sony"
    ],
    [
        "ELE-0007",
        "893000000007",
        "Gaming Mouse",
        "gaming-mouse",
        "342.42",
        "493.08",
        91,
        "electronics",
        "samsung"
    ],
    [
        "ELE-0008",
        "893000000008",
        "Mechanical Keyboard",
        "mechanical-keyboard",
        "54.66",
        "81.44",
        84,
        "electronics",
        "apple"
    ],
    [
        "ELE-0009",
        "893000000009",
        "Tablet 10-inch",
        "tablet-10-inch",
        "383.72",
        "468.14",
        81,
        "electronics",
        "sony"
    ],
    [
        "ELE-0010",
        "893000000010",
        "Smartwatch Series 5",
        "smartwatch-series-5",
        "258.53",
        "377.45",
        77,
        "electronics",
        "samsung"
    ],
    [
        "ELE-0011",
        "893000000011",
        "Noise Cancelling Headphones",
        "noise-cancelling-headphones",
        "49.27",
        "61.09",
        205,
        "electronics",
        "apple"
    ],
    [
        "ELE-0012",
        "893000000012",
        "USB-C Hub",
        "usb-c-hub",
        "225.96",
        "338.94",
        156,
        "electronics",
        "sony"
    ],
    [
        "ELE-0013",
        "893000000013",
        "External HDD 2TB",
        "external-hdd-2tb",
        "375.17",
        "502.73",
        60,
        "electronics",
        "samsung"
    ],
    [
        "ELE-0014",
        "893000000014",
        "Monitor 27-inch",
        "monitor-27-inch",
        "104.28",
        "136.61",
        218,
        "electronics",
        "apple"
    ],
    [
        "ELE-0015",
        "893000000015",
        "Webcam 1080p",
        "webcam-1080p",
        "424.10",
        "551.33",
        192,
        "electronics",
        "sony"
    ],
    [
        "FRE-0016",
        "893000000016",
        "Fresh Milk 1L",
        "fresh-milk-1l",
        "1.56",
        "2.15",
        119,
        "fresh-food",
        "mart-choice"
    ],
    [
        "FRE-0017",
        "893000000017",
        "Yogurt 4-pack",
        "yogurt-4-pack",
        "0.52",
        "0.67",
        295,
        "fresh-food",
        "vinamilk"
    ],
    [
        "FRE-0018",
        "893000000018",
        "Beef Steak 500g",
        "beef-steak-500g",
        "2.49",
        "3.64",
        126,
        "fresh-food",
        "mart-choice"
    ],
    [
        "FRE-0019",
        "893000000019",
        "Pork Belly 500g",
        "pork-belly-500g",
        "1.71",
        "2.26",
        197,
        "fresh-food",
        "vinamilk"
    ],
    [
        "FRE-0020",
        "893000000020",
        "Chicken Breast 500g",
        "chicken-breast-500g",
        "3.17",
        "4.31",
        171,
        "fresh-food",
        "mart-choice"
    ],
    [
        "FRE-0021",
        "893000000021",
        "Salmon Fillet 300g",
        "salmon-fillet-300g",
        "3.46",
        "4.22",
        67,
        "fresh-food",
        "vinamilk"
    ],
    [
        "FRE-0022",
        "893000000022",
        "Apple 1kg",
        "apple-1kg",
        "3.17",
        "4.47",
        196,
        "fresh-food",
        "mart-choice"
    ],
    [
        "FRE-0023",
        "893000000023",
        "Banana 1kg",
        "banana-1kg",
        "1.60",
        "2.29",
        61,
        "fresh-food",
        "vinamilk"
    ],
    [
        "FRE-0024",
        "893000000024",
        "Orange 1kg",
        "orange-1kg",
        "4.02",
        "6.03",
        248,
        "fresh-food",
        "mart-choice"
    ],
    [
        "FRE-0025",
        "893000000025",
        "Cabbage 1kg",
        "cabbage-1kg",
        "3.20",
        "4.06",
        130,
        "fresh-food",
        "vinamilk"
    ],
    [
        "FRE-0026",
        "893000000026",
        "Tomato 1kg",
        "tomato-1kg",
        "2.26",
        "3.03",
        143,
        "fresh-food",
        "mart-choice"
    ],
    [
        "FRE-0027",
        "893000000027",
        "Potato 1kg",
        "potato-1kg",
        "4.59",
        "6.84",
        125,
        "fresh-food",
        "vinamilk"
    ],
    [
        "FRE-0028",
        "893000000028",
        "Carrot 1kg",
        "carrot-1kg",
        "2.95",
        "4.28",
        155,
        "fresh-food",
        "mart-choice"
    ],
    [
        "FRE-0029",
        "893000000029",
        "Onion 1kg",
        "onion-1kg",
        "4.91",
        "6.58",
        145,
        "fresh-food",
        "vinamilk"
    ],
    [
        "FRE-0030",
        "893000000030",
        "Garlic 200g",
        "garlic-200g",
        "4.39",
        "6.32",
        246,
        "fresh-food",
        "mart-choice"
    ],
    [
        "BEV-0031",
        "893000000031",
        "Coca Cola 1.5L",
        "coca-cola-1-5l",
        "4.55",
        "6.78",
        136,
        "beverages",
        "coca-cola"
    ],
    [
        "BEV-0032",
        "893000000032",
        "Sprite 1.5L",
        "sprite-1-5l",
        "2.40",
        "2.93",
        170,
        "beverages",
        "pepsico"
    ],
    [
        "BEV-0033",
        "893000000033",
        "Pepsi 1.5L",
        "pepsi-1-5l",
        "2.49",
        "3.59",
        90,
        "beverages",
        "nestle"
    ],
    [
        "BEV-0034",
        "893000000034",
        "Aquafina 500ml",
        "aquafina-500ml",
        "0.89",
        "1.15",
        202,
        "beverages",
        "coca-cola"
    ],
    [
        "BEV-0035",
        "893000000035",
        "Dasani 500ml",
        "dasani-500ml",
        "3.72",
        "4.58",
        50,
        "beverages",
        "pepsico"
    ],
    [
        "BEV-0036",
        "893000000036",
        "Orange Juice 1L",
        "orange-juice-1l",
        "2.10",
        "3.02",
        186,
        "beverages",
        "nestle"
    ],
    [
        "BEV-0037",
        "893000000037",
        "Apple Juice 1L",
        "apple-juice-1l",
        "1.74",
        "2.30",
        259,
        "beverages",
        "coca-cola"
    ],
    [
        "BEV-0038",
        "893000000038",
        "Nescafe 3in1",
        "nescafe-3in1",
        "2.81",
        "4.05",
        182,
        "beverages",
        "pepsico"
    ],
    [
        "BEV-0039",
        "893000000039",
        "Lipton Tea 20-pack",
        "lipton-tea-20-pack",
        "1.26",
        "1.57",
        93,
        "beverages",
        "nestle"
    ],
    [
        "BEV-0040",
        "893000000040",
        "Red Bull 250ml",
        "red-bull-250ml",
        "1.78",
        "2.24",
        177,
        "beverages",
        "coca-cola"
    ],
    [
        "BEV-0041",
        "893000000041",
        "Monster Energy 500ml",
        "monster-energy-500ml",
        "4.51",
        "6.22",
        129,
        "beverages",
        "pepsico"
    ],
    [
        "BEV-0042",
        "893000000042",
        "Heineken Beer 330ml",
        "heineken-beer-330ml",
        "4.46",
        "6.11",
        169,
        "beverages",
        "nestle"
    ],
    [
        "BEV-0043",
        "893000000043",
        "Tiger Beer 330ml",
        "tiger-beer-330ml",
        "3.14",
        "4.40",
        77,
        "beverages",
        "coca-cola"
    ],
    [
        "BEV-0044",
        "893000000044",
        "Green Tea 500ml",
        "green-tea-500ml",
        "0.91",
        "1.35",
        267,
        "beverages",
        "pepsico"
    ],
    [
        "BEV-0045",
        "893000000045",
        "Oolong Tea 500ml",
        "oolong-tea-500ml",
        "2.70",
        "3.24",
        196,
        "beverages",
        "nestle"
    ],
    [
        "FAS-0046",
        "893000000046",
        "Men's T-Shirt",
        "men-s-t-shirt",
        "16.19",
        "23.31",
        224,
        "fashion",
        "zara"
    ],
    [
        "FAS-0047",
        "893000000047",
        "Women's T-Shirt",
        "women-s-t-shirt",
        "30.79",
        "45.26",
        58,
        "fashion",
        "mart-choice"
    ],
    [
        "FAS-0048",
        "893000000048",
        "Jeans",
        "jeans",
        "45.06",
        "56.78",
        86,
        "fashion",
        "zara"
    ],
    [
        "FAS-0049",
        "893000000049",
        "Shorts",
        "shorts",
        "49.06",
        "68.19",
        222,
        "fashion",
        "mart-choice"
    ],
    [
        "FAS-0050",
        "893000000050",
        "Sneakers",
        "sneakers",
        "43.68",
        "63.34",
        274,
        "fashion",
        "zara"
    ],
    [
        "FAS-0051",
        "893000000051",
        "Running Shoes",
        "running-shoes",
        "31.13",
        "39.54",
        50,
        "fashion",
        "mart-choice"
    ],
    [
        "FAS-0052",
        "893000000052",
        "Socks 3-pack",
        "socks-3-pack",
        "13.85",
        "20.64",
        274,
        "fashion",
        "zara"
    ],
    [
        "FAS-0053",
        "893000000053",
        "Jacket",
        "jacket",
        "7.93",
        "11.42",
        163,
        "fashion",
        "mart-choice"
    ],
    [
        "FAS-0054",
        "893000000054",
        "Sweater",
        "sweater",
        "38.01",
        "51.31",
        187,
        "fashion",
        "zara"
    ],
    [
        "FAS-0055",
        "893000000055",
        "Cap",
        "cap",
        "32.17",
        "47.29",
        68,
        "fashion",
        "mart-choice"
    ],
    [
        "FAS-0056",
        "893000000056",
        "Sunglasses",
        "sunglasses",
        "10.04",
        "13.15",
        195,
        "fashion",
        "zara"
    ],
    [
        "FAS-0057",
        "893000000057",
        "Belt",
        "belt",
        "21.74",
        "29.35",
        264,
        "fashion",
        "mart-choice"
    ],
    [
        "FAS-0058",
        "893000000058",
        "Backpack",
        "backpack",
        "46.60",
        "61.05",
        295,
        "fashion",
        "zara"
    ],
    [
        "FAS-0059",
        "893000000059",
        "Handbag",
        "handbag",
        "33.49",
        "43.20",
        105,
        "fashion",
        "mart-choice"
    ],
    [
        "FAS-0060",
        "893000000060",
        "Wallet",
        "wallet",
        "5.03",
        "6.79",
        54,
        "fashion",
        "zara"
    ],
    [
        "HOM-0061",
        "893000000061",
        "Bed Sheet Set",
        "bed-sheet-set",
        "42.12",
        "59.81",
        268,
        "home-living",
        "ikea"
    ],
    [
        "HOM-0062",
        "893000000062",
        "Pillow",
        "pillow",
        "11.98",
        "17.37",
        157,
        "home-living",
        "mart-choice"
    ],
    [
        "HOM-0063",
        "893000000063",
        "Towel 2-pack",
        "towel-2-pack",
        "17.27",
        "24.01",
        140,
        "home-living",
        "ikea"
    ],
    [
        "HOM-0064",
        "893000000064",
        "Desk Lamp",
        "desk-lamp",
        "42.01",
        "56.29",
        225,
        "home-living",
        "mart-choice"
    ],
    [
        "HOM-0065",
        "893000000065",
        "Wall Clock",
        "wall-clock",
        "47.17",
        "69.81",
        116,
        "home-living",
        "ikea"
    ],
    [
        "HOM-0066",
        "893000000066",
        "Picture Frame",
        "picture-frame",
        "44.07",
        "63.02",
        283,
        "home-living",
        "mart-choice"
    ],
    [
        "HOM-0067",
        "893000000067",
        "Vase",
        "vase",
        "30.49",
        "39.94",
        170,
        "home-living",
        "ikea"
    ],
    [
        "HOM-0068",
        "893000000068",
        "Storage Box",
        "storage-box",
        "20.80",
        "30.58",
        81,
        "home-living",
        "mart-choice"
    ],
    [
        "HOM-0069",
        "893000000069",
        "Trash Can",
        "trash-can",
        "20.55",
        "28.15",
        207,
        "home-living",
        "ikea"
    ],
    [
        "HOM-0070",
        "893000000070",
        "Hangers 10-pack",
        "hangers-10-pack",
        "30.77",
        "46.16",
        219,
        "home-living",
        "mart-choice"
    ],
    [
        "HOM-0071",
        "893000000071",
        "Ironing Board",
        "ironing-board",
        "48.72",
        "69.67",
        98,
        "home-living",
        "ikea"
    ],
    [
        "HOM-0072",
        "893000000072",
        "Clothes Drying Rack",
        "clothes-drying-rack",
        "11.30",
        "14.80",
        157,
        "home-living",
        "mart-choice"
    ],
    [
        "HOM-0073",
        "893000000073",
        "Doormat",
        "doormat",
        "5.09",
        "6.31",
        134,
        "home-living",
        "ikea"
    ],
    [
        "HOM-0074",
        "893000000074",
        "Curtains",
        "curtains",
        "48.52",
        "69.87",
        237,
        "home-living",
        "mart-choice"
    ],
    [
        "HOM-0075",
        "893000000075",
        "Cushion Cover",
        "cushion-cover",
        "7.03",
        "9.77",
        138,
        "home-living",
        "ikea"
    ],
    [
        "SNA-0076",
        "893000000076",
        "Lay's Classic 100g",
        "lay-s-classic-100g",
        "2.93",
        "3.63",
        144,
        "snacks",
        "pepsico"
    ],
    [
        "SNA-0077",
        "893000000077",
        "Oishi Prawn Crackers",
        "oishi-prawn-crackers",
        "2.41",
        "3.21",
        137,
        "snacks",
        "nestle"
    ],
    [
        "SNA-0078",
        "893000000078",
        "KitKat 4-finger",
        "kitkat-4-finger",
        "0.72",
        "1.00",
        215,
        "snacks",
        "pepsico"
    ],
    [
        "SNA-0079",
        "893000000079",
        "Snickers 50g",
        "snickers-50g",
        "3.29",
        "4.38",
        65,
        "snacks",
        "nestle"
    ],
    [
        "SNA-0080",
        "893000000080",
        "Oreo 133g",
        "oreo-133g",
        "2.09",
        "2.74",
        205,
        "snacks",
        "pepsico"
    ],
    [
        "SNA-0081",
        "893000000081",
        "Ritz Crackers",
        "ritz-crackers",
        "1.22",
        "1.70",
        197,
        "snacks",
        "nestle"
    ],
    [
        "SNA-0082",
        "893000000082",
        "Choco Pie 12-pack",
        "choco-pie-12-pack",
        "0.61",
        "0.73",
        288,
        "snacks",
        "pepsico"
    ],
    [
        "SNA-0083",
        "893000000083",
        "Pringles Original",
        "pringles-original",
        "2.19",
        "3.11",
        240,
        "snacks",
        "nestle"
    ],
    [
        "SNA-0084",
        "893000000084",
        "Doritos Nacho Cheese",
        "doritos-nacho-cheese",
        "2.35",
        "3.17",
        245,
        "snacks",
        "pepsico"
    ],
    [
        "SNA-0085",
        "893000000085",
        "Haribo Gummy Bears",
        "haribo-gummy-bears",
        "1.55",
        "2.17",
        53,
        "snacks",
        "nestle"
    ],
    [
        "SNA-0086",
        "893000000086",
        "M&M's Peanut 100g",
        "m-m-s-peanut-100g",
        "1.48",
        "2.07",
        198,
        "snacks",
        "pepsico"
    ],
    [
        "SNA-0087",
        "893000000087",
        "Toblerone 100g",
        "toblerone-100g",
        "2.10",
        "3.02",
        230,
        "snacks",
        "nestle"
    ],
    [
        "SNA-0088",
        "893000000088",
        "Twix 50g",
        "twix-50g",
        "0.60",
        "0.80",
        57,
        "snacks",
        "pepsico"
    ],
    [
        "SNA-0089",
        "893000000089",
        "Skittles 50g",
        "skittles-50g",
        "2.84",
        "3.78",
        300,
        "snacks",
        "nestle"
    ],
    [
        "SNA-0090",
        "893000000090",
        "Popcorn Caramel",
        "popcorn-caramel",
        "2.55",
        "3.75",
        254,
        "snacks",
        "pepsico"
    ],
    [
        "PER-0091",
        "893000000091",
        "Clear Shampoo 600g",
        "clear-shampoo-600g",
        "3.62",
        "4.78",
        221,
        "personal-care",
        "unilever"
    ],
    [
        "PER-0092",
        "893000000092",
        "Dove Body Wash 500g",
        "dove-body-wash-500g",
        "2.19",
        "3.04",
        248,
        "personal-care",
        "pg"
    ],
    [
        "PER-0093",
        "893000000093",
        "Pantene Shampoo 600g",
        "pantene-shampoo-600g",
        "3.79",
        "5.42",
        51,
        "personal-care",
        "unilever"
    ],
    [
        "PER-0094",
        "893000000094",
        "Colgate Toothpaste 200g",
        "colgate-toothpaste-200g",
        "4.38",
        "5.43",
        152,
        "personal-care",
        "pg"
    ],
    [
        "PER-0095",
        "893000000095",
        "P/S Toothpaste 200g",
        "p-s-toothpaste-200g",
        "3.31",
        "4.87",
        81,
        "personal-care",
        "unilever"
    ],
    [
        "PER-0096",
        "893000000096",
        "Listerine 500ml",
        "listerine-500ml",
        "2.94",
        "3.97",
        77,
        "personal-care",
        "pg"
    ],
    [
        "PER-0097",
        "893000000097",
        "Gillette Razor",
        "gillette-razor",
        "0.66",
        "0.96",
        225,
        "personal-care",
        "unilever"
    ],
    [
        "PER-0098",
        "893000000098",
        "Nivea Deodorant",
        "nivea-deodorant",
        "1.24",
        "1.81",
        188,
        "personal-care",
        "pg"
    ],
    [
        "PER-0099",
        "893000000099",
        "Sunsilk Shampoo",
        "sunsilk-shampoo",
        "4.79",
        "6.23",
        218,
        "personal-care",
        "unilever"
    ],
    [
        "PER-0100",
        "893000000100",
        "Lifebuoy Soap",
        "lifebuoy-soap",
        "2.78",
        "3.70",
        220,
        "personal-care",
        "pg"
    ],
    [
        "PER-0101",
        "893000000101",
        "Facial Cleanser 100ml",
        "facial-cleanser-100ml",
        "0.70",
        "0.89",
        258,
        "personal-care",
        "unilever"
    ],
    [
        "PER-0102",
        "893000000102",
        "Body Lotion 200ml",
        "body-lotion-200ml",
        "2.05",
        "2.54",
        128,
        "personal-care",
        "pg"
    ],
    [
        "PER-0103",
        "893000000103",
        "Hand Sanitizer 500ml",
        "hand-sanitizer-500ml",
        "4.24",
        "5.30",
        210,
        "personal-care",
        "unilever"
    ],
    [
        "PER-0104",
        "893000000104",
        "Cotton Swabs 200-pack",
        "cotton-swabs-200-pack",
        "0.66",
        "0.92",
        181,
        "personal-care",
        "pg"
    ],
    [
        "PER-0105",
        "893000000105",
        "Wet Wipes 80-pack",
        "wet-wipes-80-pack",
        "1.93",
        "2.90",
        242,
        "personal-care",
        "unilever"
    ],
    [
        "HOM-0106",
        "893000000106",
        "Omo Laundry Liquid 2.8kg",
        "omo-laundry-liquid-2-8kg",
        "1.73",
        "2.18",
        183,
        "home-care",
        "unilever"
    ],
    [
        "HOM-0107",
        "893000000107",
        "Ariel Laundry Liquid 2.4kg",
        "ariel-laundry-liquid-2-4kg",
        "2.86",
        "3.80",
        139,
        "home-care",
        "pg"
    ],
    [
        "HOM-0108",
        "893000000108",
        "Sunlight Dish Soap 750g",
        "sunlight-dish-soap-750g",
        "2.66",
        "3.96",
        289,
        "home-care",
        "unilever"
    ],
    [
        "HOM-0109",
        "893000000109",
        "Vim Toilet Cleaner 900ml",
        "vim-toilet-cleaner-900ml",
        "1.33",
        "1.60",
        290,
        "home-care",
        "pg"
    ],
    [
        "HOM-0110",
        "893000000110",
        "Comfort Fabric Conditioner 1.8L",
        "comfort-fabric-conditioner-1-8l",
        "3.33",
        "4.93",
        243,
        "home-care",
        "unilever"
    ],
    [
        "HOM-0111",
        "893000000111",
        "Downy Fabric Conditioner 1.5L",
        "downy-fabric-conditioner-1-5l",
        "1.46",
        "1.82",
        65,
        "home-care",
        "pg"
    ],
    [
        "HOM-0112",
        "893000000112",
        "Duck Toilet Cleaner",
        "duck-toilet-cleaner",
        "2.32",
        "3.32",
        292,
        "home-care",
        "unilever"
    ],
    [
        "HOM-0113",
        "893000000113",
        "VIM Surface Cleaner",
        "vim-surface-cleaner",
        "4.30",
        "5.59",
        223,
        "home-care",
        "pg"
    ],
    [
        "HOM-0114",
        "893000000114",
        "Glade Air Freshener",
        "glade-air-freshener",
        "0.89",
        "1.31",
        216,
        "home-care",
        "unilever"
    ],
    [
        "HOM-0115",
        "893000000115",
        "Scotch-Brite Sponge",
        "scotch-brite-sponge",
        "2.79",
        "4.13",
        300,
        "home-care",
        "pg"
    ],
    [
        "HOM-0116",
        "893000000116",
        "Trash Bags 100-pack",
        "trash-bags-100-pack",
        "0.73",
        "1.09",
        290,
        "home-care",
        "unilever"
    ],
    [
        "HOM-0117",
        "893000000117",
        "Mop and Bucket Set",
        "mop-and-bucket-set",
        "3.02",
        "3.84",
        136,
        "home-care",
        "pg"
    ],
    [
        "HOM-0118",
        "893000000118",
        "Broom",
        "broom",
        "4.87",
        "6.96",
        52,
        "home-care",
        "unilever"
    ],
    [
        "HOM-0119",
        "893000000119",
        "Dustpan",
        "dustpan",
        "2.86",
        "3.63",
        206,
        "home-care",
        "pg"
    ],
    [
        "HOM-0120",
        "893000000120",
        "Glass Cleaner 500ml",
        "glass-cleaner-500ml",
        "4.06",
        "5.07",
        250,
        "home-care",
        "unilever"
    ]
];
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
    const mainImageUrl = `https://picsum.photos/seed/${sku}/600/600`;
    
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
        description: `${name} product. High quality and durable.`,
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
        code: `POS-V3-${randomDateObj.getTime()}-${i}`,
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
        orderCode: `ONL-V3-${randomDateObj.getTime()}-${i}`,
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
          paymentCode: `PAY-V3-${randomDateObj.getTime()}-${i}`,
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
