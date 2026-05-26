const jwt = require("jsonwebtoken");
const prisma = require("../config/db");

const protect = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Not authorized, token missing",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        roleId: true,
        branchId: true,
        email: true,
        fullName: true,
        status: true,
        role: {
          select: {
            id: true,
            code: true,
            name: true,
            rolePermissions: {
              select: {
                permission: {
                  select: {
                    code: true,
                    group: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({
        message: "Not authorized",
      });
    }

    req.user = {
      ...user,
      roleCode: user.role?.code,
      permissions:
        user.role?.rolePermissions.map((item) => item.permission.code) || [],
    };

    next();
  } catch (error) {
    return res.status(401).json({
      message: "Not authorized, token invalid",
    });
  }
};

const authorizeRoles =
  (...roleCodes) =>
  (req, res, next) => {
    if (!req.user || !roleCodes.includes(req.user.roleCode)) {
      return res.status(403).json({
        message: "Permission denied",
      });
    }

    next();
  };

const adminOnly = authorizeRoles("ADMIN");
const backOfficeOnly = authorizeRoles("ADMIN", "MANAGER", "STAFF");
const managerOnly = authorizeRoles("ADMIN", "MANAGER");
const staffOnly = authorizeRoles("ADMIN", "MANAGER", "STAFF");
const customerOnly = authorizeRoles("CUSTOMER");

module.exports = {
  protect,
  authorizeRoles,
  adminOnly,
  backOfficeOnly,
  managerOnly,
  staffOnly,
  customerOnly,
};
