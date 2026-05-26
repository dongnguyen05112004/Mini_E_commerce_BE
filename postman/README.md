# Mini E-commerce Postman Scenarios

## Files

- `Mini_Ecommerce_API.postman_collection.json`
- `Mini_Ecommerce.local.postman_environment.json`

## Before Running

Start backend:

```bash
npm run dev
```

Seed test data:

```bash
node prisma/seed.js
```

## Import To Postman

1. Import both JSON files.
2. Select environment `Mini E-commerce Local`.
3. Run collection from top to bottom.

## Test Accounts

```txt
Admin: admin@example.com / Admin@123456
Customer: customer@example.com / User@123456
```

## Scenario Order

1. Health check.
2. Login customer and admin, store JWT tokens.
3. Public catalog: categories, products, product detail, product images.
4. Admin CRUD users and addresses.
5. Admin CRUD categories, products, product images.
6. Admin CRUD carts and cart items.
7. Customer creates order, admin manages order and order items.
8. Cleanup test resources.
