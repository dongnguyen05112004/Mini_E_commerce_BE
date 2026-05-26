const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

const userSelect = {
  id: true,
  roleId: true,
  branchId: true,
  email: true,
  fullName: true,
  phone: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  role: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  branch: {
    select: {
      id: true,
      code: true,
      name: true,
    },
  },
  customerProfile: true,
};

const createToken = (user) => {
  if (!process.env.JWT_SECRET) {
    const error = new Error("JWT_SECRET is not configured");
    error.statusCode = 500;
    throw error;
  }

  return jwt.sign(
    {
      id: user.id,
      roleCode: user.role?.code,
      branchId: user.branchId,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    }
  );
};

const getOrCreateCustomerRole = () =>
  prisma.role.upsert({
    where: { code: "CUSTOMER" },
    update: {},
    create: {
      code: "CUSTOMER",
      name: "Customer",
      description: "Online customer account",
      isSystem: true,
    },
  });

const asTrimmedString = (value) =>
  value === undefined || value === null ? "" : String(value).trim();

const register = asyncHandler(async (req, res) => {
  const email = asTrimmedString(req.body.email).toLowerCase();
  const phone = asTrimmedString(req.body.phone);
  const fullName = asTrimmedString(req.body.fullName);
  const { password } = req.body;

  if (!email || !phone || !password || !fullName) {
    return res.status(400).json({
      message: "email, phone, password and fullName are required",
    });
  }

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone }],
    },
    select: { id: true, email: true, phone: true },
  });

  if (existingUser) {
    return res.status(409).json({
      message:
        existingUser.email === email
          ? "Email already exists"
          : "Phone already exists",
    });
  }

  const [customerRole, passwordHash] = await Promise.all([
    getOrCreateCustomerRole(),
    bcrypt.hash(password, 10),
  ]);

  const user = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        email,
        passwordHash,
        fullName,
        phone,
        roleId: customerRole.id,
        customerProfile: {
          create: {},
        },
      },
      select: userSelect,
    });

    await tx.cart.create({
      data: {
        userId: createdUser.id,
      },
    });

    await tx.userActivityLog.create({
      data: {
        userId: createdUser.id,
        action: "REGISTER",
        entityType: "user",
        entityId: createdUser.id,
        ipAddress: req.ip || req.connection?.remoteAddress || "",
        userAgent: req.headers["user-agent"] || "",
        metadata: { email: createdUser.email }
      }
    });

    return createdUser;
  });

  res.status(201).json({
    data: user,
    token: createToken(user),
  });
});

const login = asyncHandler(async (req, res) => {
  const identifier = asTrimmedString(
    req.body.identifier ||
      req.body.email ||
      req.body.phone
  ).toLowerCase();
  const { password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({
      message: "email/phone and password are required",
    });
  }

  const user = await prisma.user.findFirst({
    where: {
      OR: [{ email: identifier }, { phone: identifier }],
    },
    include: {
      role: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
      branch: {
        select: {
          id: true,
          code: true,
          name: true,
        },
      },
    },
  });

  if (!user) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  if (user.status !== "ACTIVE") {
    return res.status(403).json({
      message: "Account is blocked",
    });
  }

  const isMatch = await bcrypt.compare(password, user.passwordHash);

  if (!isMatch) {
    return res.status(401).json({
      message: "Invalid credentials",
    });
  }

  const { passwordHash, ...safeUser } = user;

  await prisma.userActivityLog.create({
    data: {
      userId: user.id,
      action: "LOGIN",
      entityType: "user",
      entityId: user.id,
      ipAddress: req.ip || req.connection?.remoteAddress || "",
      userAgent: req.headers["user-agent"] || "",
      metadata: { email: user.email }
    }
  }).catch(err => console.error("Error creating login activity log:", err));

  res.json({
    data: safeUser,
    token: createToken(user),
  });
});

const getProfile = asyncHandler(async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      ...userSelect,
      addresses: true,
      cart: {
        select: {
          id: true,
          items: {
            select: {
              id: true,
              productId: true,
              quantity: true,
            },
          },
        },
      },
    },
  });

  res.json({
    data: user,
  });
});

module.exports = {
  register,
  login,
  getProfile,
};
