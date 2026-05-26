# API Role Matrix

## Public

Base path: `/api/public`

No token required. Read-only catalog/config used by website visitors.

```txt
GET /categories
GET /brands
GET /units
GET /products
GET /product-images
GET /promotions
GET /order-statuses
```

## Admin

Base path: `/api/admin`

Security: `protect + adminOnly`

Admin manages system-level configuration and accounts.

```txt
CRUD /roles
CRUD /permissions
CRUD /role-permissions
CRUD /users
CRUD /branches
CRUD /order-statuses
CRUD /payment-methods
CRUD /delivery-fee-rules
CRUD /return-policies
CRUD /system-settings
GET  /user-activity-logs
```

## Manager

Base path: `/api/manager`

Security: `protect + managerOnly` where `managerOnly = ADMIN | MANAGER`

Manager manages mart operation, catalog, stock, suppliers, purchasing and promotions.

```txt
CRUD /categories
CRUD /brands
CRUD /units
CRUD /products
CRUD /product-images
CRUD /warehouses
CRUD /inventory
CRUD /inventory-transactions
CRUD /suppliers
CRUD /purchase-orders
CRUD /purchase-order-items
CRUD /promotions
CRUD /promotion-products

GET  /pos-sales
GET  /pos-sale-items
GET  /online-orders
GET  /online-order-items
GET  /order-status-logs
GET  /payments
GET  /deliveries

POST  /workflows/purchase-orders
PATCH /workflows/purchase-orders/:id/approve
PATCH /workflows/purchase-orders/:id/receive
```

## Staff

Base path: `/api/staff`

Security: `protect + staffOnly` where `staffOnly = ADMIN | MANAGER | STAFF`

Staff handles POS, online-order processing, delivery updates and product/stock lookup.

```txt
GET   /categories
GET   /brands
GET   /units
GET   /products
GET   /product-images
GET   /inventory
GET   /order-statuses
GET   /online-orders
GET   /online-order-items
GET   /pos-sales
GET   /pos-sale-items

GET   /deliveries
PUT   /deliveries/:id
PATCH /deliveries/:id

POST  /workflows/pos-sales/checkout
PATCH /workflows/online-orders/:id/status
PATCH /workflows/online-orders/:id/cancel
```

## Customer

Base path: `/api/customer`

Security: `protect + customerOnly`

Customer can only access personal cart, personal addresses and personal orders.

```txt
GET    /cart
POST   /cart/items
PATCH  /cart/items/:id
DELETE /cart/items/:id

GET    /addresses
POST   /addresses
PATCH  /addresses/:id
DELETE /addresses/:id

GET    /online-orders
GET    /online-orders/:id
POST   /online-orders/checkout
PATCH  /online-orders/:id/cancel
```
