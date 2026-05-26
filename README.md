# Mini E-commerce BE

Backend API cho hệ thống mini e-commerce kết hợp bán hàng online, POS, quản lý kho và quản trị người dùng theo vai trò.

## Tính năng chính

- Xác thực JWT, phân quyền theo role: `ADMIN`, `MANAGER`, `STAFF`, `CUSTOMER`.
- Public catalog cho website: danh mục, thương hiệu, đơn vị, sản phẩm, hình ảnh, khuyến mãi.
- Customer API: hồ sơ cá nhân, giỏ hàng, địa chỉ giao hàng, đặt hàng online, hủy đơn, đánh giá sản phẩm.
- Staff API: POS checkout, xử lý đơn online, cập nhật giao hàng, tra cứu khách hàng/sản phẩm/tồn kho.
- Manager API: quản lý catalog, tồn kho, nhà cung cấp, nhập hàng, khuyến mãi, báo cáo doanh thu/lợi nhuận.
- Admin API: quản lý user, role, permission, branch, cấu hình hệ thống, log hoạt động.
- Prisma schema và migrations cho MySQL.
- Postman collection có sẵn để test các luồng chính.

## Công nghệ

- Node.js
- Express 5
- Prisma ORM
- MySQL
- JWT
- bcryptjs
- express-validator
- nodemon

## Yêu cầu

- Node.js 18 trở lên
- MySQL 8 trở lên
- npm

## Cài đặt

```bash
npm install
```

Tạo file `.env` từ mẫu:

```bash
cp .env.example .env
```

Cập nhật các biến môi trường:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/mini_e_commerce"
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"
PORT=3000
```

Chạy Prisma migration và seed dữ liệu mẫu:

```bash
npx prisma migrate dev
npx prisma generate
npm run seed
```

Chạy server development:

```bash
npm run dev
```

Server mặc định chạy tại:

```txt
http://localhost:3000
```

## Scripts

```bash
npm run dev      # chạy server bằng nodemon
npm start        # chạy server bằng node
npm run seed     # seed dữ liệu mẫu
```

## Biến môi trường

| Biến | Mô tả |
| --- | --- |
| `DATABASE_URL` | Chuỗi kết nối MySQL dùng bởi Prisma |
| `JWT_SECRET` | Secret để ký và verify JWT |
| `JWT_EXPIRES_IN` | Thời gian hết hạn token, mặc định trong code là `7d` |
| `PORT` | Port chạy API, mặc định là `3000` |

## API groups

Endpoint health/root:

```txt
GET /
```

Các nhóm API chính:

```txt
/api
/api/public
/api/auth
/api/admin
/api/manager
/api/reports
/api/staff
/api/customer
```

Tài liệu phân quyền chi tiết nằm tại:

```txt
docs/API_ROLE_MATRIX.md
```

## Postman

Postman collection và environment nằm trong thư mục `postman`:

```txt
postman/Mini_Ecommerce_API.postman_collection.json
postman/Mini_Ecommerce.local.postman_environment.json
```

Cách chạy nhanh:

1. Chạy backend bằng `npm run dev`.
2. Seed dữ liệu bằng `npm run seed`.
3. Import collection và environment vào Postman.
4. Chọn environment `Mini E-commerce Local`.
5. Chạy collection từ trên xuống.

Tài khoản test trong seed:

```txt
Admin: admin@example.com / Admin@123456
Customer: customer@example.com / User@123456
```

## Cấu trúc thư mục

```txt
config/        Prisma client/database config
controllers/   Request handlers
docs/          API/role documentation
middleware/    Auth và error middleware
postman/       Postman collection/environment
prisma/        Prisma schema, migrations, seed
routes/        Express routes
services/      Business workflows
utils/         Helper functions
server.js      Application entrypoint
```

## Ghi chú bảo mật

- Không commit file `.env`.
- Không commit `node_modules`, Prisma generated client hoặc log runtime.
- Đổi `JWT_SECRET` trước khi deploy production.
