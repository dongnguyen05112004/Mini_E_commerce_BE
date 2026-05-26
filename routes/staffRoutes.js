/**
 * staffRoutes.js
 * All routes accessible by STAFF (+ ADMIN + MANAGER).
 * Mapped to /api/staff/*
 *
 * Covers:
 *  US-STF-01..05  – POS bán hàng
 *  US-STF-06..10  – Xử lý đơn online
 *  US-STF-11      – Tồn kho cơ bản
 *  US-STF-12      – Tra cứu sản phẩm
 *  US-STF-13      – Tra cứu khách hàng
 *  US-STF-14      – Đổi/trả hàng
 *  US-STF-15      – Báo cáo ca làm việc
 *  US-STF-16      – Ghi chú đơn hàng
 */

const express = require("express");
const { protect, staffOnly } = require("../middleware/authMiddleware");
const { checkoutPosSale } = require("../controllers/workflowController");

const {
  // POS
  searchPosProducts,
  getPosSaleDetail,
  getMyPosSales,

  // Online Orders
  getOnlineOrders,
  getOnlineOrderDetail,
  confirmOnlineOrder,
  getPickList,
  updateOnlineOrderStatus,
  cancelOnlineOrder,

  // Inventory
  getInventory,

  // Products
  searchProducts,

  // Customers
  searchCustomers,
  getCustomerOrders,

  // Returns
  createReturn,

  // Reports
  getMyShiftReport,

  // Notes
  addOrderNote,
} = require("../controllers/staffController");

const router = express.Router();

// ── Global guard ─────────────────────────────────────────────
router.use(protect, staffOnly);

/* ═══════════════════════════════════════════
   POS – BÁNHÀNG TẠI QUẦY
   US-STF-01, 02, 03, 04, 05
   ═══════════════════════════════════════════ */

// Tìm sản phẩm (barcode / SKU / tên) cho POS
// GET /api/staff/pos/products?keyword=&warehouseId=
router.get("/pos/products", searchPosProducts);

// Tạo hóa đơn POS (gồm thanh toán + trừ tồn kho)
// POST /api/staff/pos/sales
router.post("/pos/sales", checkoutPosSale);

// Xem chi tiết hóa đơn POS (để in hóa đơn)
// GET /api/staff/pos/sales/:id
router.get("/pos/sales/:id", getPosSaleDetail);

// Xem danh sách hóa đơn do staff hiện tại tạo
// GET /api/staff/pos/my-sales?startDate=&endDate=&page=&limit=
router.get("/pos/my-sales", getMyPosSales);

/* ═══════════════════════════════════════════
   ĐƠN HÀNG ONLINE
   US-STF-06, 07, 08, 09, 10, 16
   ═══════════════════════════════════════════ */

// Danh sách đơn hàng online (có lọc trạng thái, tìm kiếm)
// GET /api/staff/orders?status=PENDING&page=1&limit=20&search=
router.get("/orders", getOnlineOrders);

// Chi tiết đơn hàng online
// GET /api/staff/orders/:id
router.get("/orders/:id", getOnlineOrderDetail);

// Xác nhận đơn (PENDING → CONFIRMED), kiểm tra tồn kho
// PUT /api/staff/orders/:id/confirm
router.put("/orders/:id/confirm", confirmOnlineOrder);

// Phiếu chuẩn bị hàng (pick list)
// GET /api/staff/orders/:id/pick-list
router.get("/orders/:id/pick-list", getPickList);

// Cập nhật trạng thái đơn: CONFIRMED→PROCESSING→SHIPPING→COMPLETED
// PUT /api/staff/orders/:id/status
router.put("/orders/:id/status", updateOnlineOrderStatus);
router.patch("/orders/:id/status", updateOnlineOrderStatus);

// Cập nhật trạng thái/thông tin giao hàng nội bộ
// PATCH /api/staff/orders/:id/delivery
router.put("/orders/:id/delivery", updateOnlineOrderStatus);
router.patch("/orders/:id/delivery", updateOnlineOrderStatus);

// Hủy đơn hàng (trong phạm vi quyền staff)
// PUT /api/staff/orders/:id/cancel
router.put("/orders/:id/cancel", cancelOnlineOrder);

// Thêm ghi chú xử lý đơn hàng (không thay đổi trạng thái)
// POST /api/staff/orders/:id/notes
router.post("/orders/:id/notes", addOrderNote);

/* ═══════════════════════════════════════════
   TỒN KHO
   US-STF-11
   ═══════════════════════════════════════════ */

// Xem tồn kho cơ bản (có cảnh báo hết hàng)
// GET /api/staff/inventory?warehouseId=&productId=&lowStock=true
router.get("/inventory", getInventory);

/* ═══════════════════════════════════════════
   SẢN PHẨM
   US-STF-12
   ═══════════════════════════════════════════ */

// Tra cứu sản phẩm (tên, SKU, barcode, danh mục)
// GET /api/staff/products?keyword=&categoryId=&page=&limit=
router.get("/products", searchProducts);

/* ═══════════════════════════════════════════
   KHÁCH HÀNG
   US-STF-13
   ═══════════════════════════════════════════ */

// Tra cứu khách hàng (tên, SĐT, email)
// GET /api/staff/customers?keyword=&page=&limit=
router.get("/customers", searchCustomers);

// Xem lịch sử đơn hàng của khách
// GET /api/staff/customers/:id/orders
router.get("/customers/:id/orders", getCustomerOrders);

/* ═══════════════════════════════════════════
   ĐỔI/TRẢ HÀNG
   US-STF-14
   ═══════════════════════════════════════════ */

// Ghi nhận đổi/trả hàng (POS hoặc online order)
// POST /api/staff/returns
router.post("/returns", createReturn);

/* ═══════════════════════════════════════════
   BÁO CÁO CA LÀM VIỆC
   US-STF-15
   ═══════════════════════════════════════════ */

// Báo cáo ca làm việc cá nhân (doanh thu, số hóa đơn)
// GET /api/staff/reports/my-shift?date=2025-01-20
router.get("/reports/my-shift", getMyShiftReport);

module.exports = router;
