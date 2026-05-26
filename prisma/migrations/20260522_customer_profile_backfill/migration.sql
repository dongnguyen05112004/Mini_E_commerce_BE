-- Backfill profiles for existing customer accounts created before customer_profiles existed.
INSERT INTO `customer_profiles` (
    `userId`,
    `totalOrders`,
    `totalSpent`,
    `loyaltyPoints`,
    `createdAt`,
    `updatedAt`
)
SELECT
    `users`.`id`,
    0,
    0.00,
    0,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
FROM `users`
INNER JOIN `roles` ON `roles`.`id` = `users`.`roleId`
WHERE `roles`.`code` = 'CUSTOMER'
  AND NOT EXISTS (
      SELECT 1
      FROM `customer_profiles`
      WHERE `customer_profiles`.`userId` = `users`.`id`
  );
