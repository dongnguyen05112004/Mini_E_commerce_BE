const prisma = require("../config/db");
const asyncHandler = require("../utils/asyncHandler");

// 1. Update User Status
const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status, reason } = req.body;

  if (!status || !reason) {
    const error = new Error("Status and reason are required");
    error.statusCode = 400;
    throw error;
  }

  const userId = parseInt(id, 10);
  if (isNaN(userId)) {
    const error = new Error("Invalid user ID");
    error.statusCode = 400;
    throw error;
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    const error = new Error("User not found");
    error.statusCode = 404;
    throw error;
  }

  const updatedUser = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        fullName: true,
        status: true,
        roleId: true,
        branchId: true
      }
    });

    await tx.userActivityLog.create({
      data: {
        userId: req.user.id, // ID of the admin making the change
        action: status === "BLOCKED" ? "LOCK_USER" : "UNLOCK_USER",
        entityType: "user",
        entityId: userId,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
        metadata: {
          reason,
          oldStatus: user.status,
          newStatus: status
        }
      }
    });

    return updated;
  });

  res.json({
    message: `User status updated to ${status}`,
    data: updatedUser
  });
});

// 2. Assign Role Permissions
const assignRolePermissions = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { permissionIds } = req.body;

  if (!Array.isArray(permissionIds)) {
    const error = new Error("permissionIds must be an array");
    error.statusCode = 400;
    throw error;
  }

  const roleId = parseInt(id, 10);
  if (isNaN(roleId)) {
    const error = new Error("Invalid role ID");
    error.statusCode = 400;
    throw error;
  }

  const role = await prisma.role.findUnique({ where: { id: roleId } });
  if (!role) {
    const error = new Error("Role not found");
    error.statusCode = 404;
    throw error;
  }

  await prisma.$transaction(async (tx) => {
    // Delete existing permissions for this role
    await tx.rolePermission.deleteMany({
      where: { roleId }
    });

    // Insert new permissions
    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map(permissionId => ({
          roleId,
          permissionId
        }))
      });
    }
    
    await tx.userActivityLog.create({
      data: {
        userId: req.user.id,
        action: "UPDATE_ROLE_PERMISSIONS",
        entityType: "role",
        entityId: roleId,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"],
        metadata: { permissionIds }
      }
    });
  });

  res.json({
    message: "Role permissions updated successfully"
  });
});

// 3. Update Setting By Key
const updateSettingByKey = asyncHandler(async (req, res) => {
  const { key } = req.params;
  const { value } = req.body;

  if (value === undefined) {
    const error = new Error("Value is required");
    error.statusCode = 400;
    throw error;
  }

  const setting = await prisma.systemSetting.findUnique({
    where: { key }
  });

  if (!setting) {
    const error = new Error(`Setting with key '${key}' not found`);
    error.statusCode = 404;
    throw error;
  }

  const updatedSetting = await prisma.systemSetting.update({
    where: { key },
    data: { value: String(value) }
  });

  await prisma.userActivityLog.create({
    data: {
      userId: req.user.id,
      action: "UPDATE_SYSTEM_SETTING",
      entityType: "systemSetting",
      entityId: updatedSetting.id,
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers["user-agent"],
      metadata: { key, oldValue: setting.value, newValue: String(value) }
    }
  });

  res.json({
    message: "System setting updated",
    data: updatedSetting
  });
});

// 4. Get Dashboard Stats
const getDashboardStats = asyncHandler(async (req, res) => {
  // Parallel fetch stats to speed up response
  const [
    totalUsers,
    activeUsers,
    totalBranches,
    pendingOrders,
    completedOrders,
    recentLogs
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "ACTIVE" } }),
    prisma.branch.count({ where: { status: "ACTIVE" } }),
    prisma.onlineOrder.count({ where: { statusCode: "PENDING" } }),
    prisma.onlineOrder.count({ where: { statusCode: "COMPLETED" } }),
    prisma.userActivityLog.findMany({
      take: 10,
      orderBy: { createdAt: "desc" },
      include: {
        user: { select: { fullName: true, email: true } }
      }
    })
  ]);

  res.json({
    data: {
      users: {
        total: totalUsers,
        active: activeUsers,
        blocked: totalUsers - activeUsers
      },
      branches: {
        active: totalBranches
      },
      orders: {
        pending: pendingOrders,
        completed: completedOrders
      },
      recentActivity: recentLogs
    }
  });
});

// 5. Export Activity Logs
const exportActivityLogs = asyncHandler(async (req, res) => {
  // Optional filters
  const { userId, action, fromDate, toDate } = req.query;
  
  const where = {};
  if (userId) where.userId = parseInt(userId, 10);
  if (action) where.action = action;
  
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const logs = await prisma.userActivityLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { email: true } }
    }
  });

  // Construct CSV
  const header = ["ID", "Time", "User Email", "Action", "Entity Type", "Entity ID", "IP Address", "Metadata"];
  
  // A helper function to escape CSV fields
  const escapeCsv = (field) => {
    if (field === null || field === undefined) return "";
    let str = String(field);
    if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
      str = '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };

  const rows = logs.map(log => [
    log.id,
    log.createdAt.toISOString(),
    log.user?.email || "System",
    log.action,
    log.entityType || "",
    log.entityId || "",
    log.ipAddress || "",
    log.metadata ? JSON.stringify(log.metadata) : ""
  ]);

  const csvContent = [header, ...rows].map(row => row.map(escapeCsv).join(",")).join("\n");

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=activity-logs.csv");
  // Prepend BOM to ensure Excel opens UTF-8 properly
  res.status(200).send("\uFEFF" + csvContent);
});

module.exports = {
  updateUserStatus,
  assignRolePermissions,
  updateSettingByKey,
  getDashboardStats,
  exportActivityLogs
};
