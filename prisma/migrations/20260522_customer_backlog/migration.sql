-- Customer backlog additions: profiles, saved address usage, and product reviews.

-- CreateIndex
CREATE UNIQUE INDEX `users_phone_key` ON `users`(`phone`);

-- AlterTable
ALTER TABLE `online_orders` ADD COLUMN `addressId` INTEGER NULL;

-- CreateTable
CREATE TABLE `customer_profiles` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `birthDate` DATETIME(3) NULL,
    `gender` VARCHAR(20) NULL,
    `totalOrders` INTEGER NOT NULL DEFAULT 0,
    `totalSpent` DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    `loyaltyPoints` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `customer_profiles_userId_key`(`userId`),
    INDEX `customer_profiles_totalOrders_idx`(`totalOrders`),
    INDEX `customer_profiles_loyaltyPoints_idx`(`loyaltyPoints`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `product_reviews` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `productId` INTEGER NOT NULL,
    `onlineOrderId` INTEGER NOT NULL,
    `onlineOrderItemId` INTEGER NULL,
    `rating` INTEGER NOT NULL,
    `content` TEXT NULL,
    `status` ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `product_reviews_onlineOrderItemId_key`(`onlineOrderItemId`),
    UNIQUE INDEX `product_reviews_userId_productId_onlineOrderId_key`(`userId`, `productId`, `onlineOrderId`),
    INDEX `product_reviews_productId_status_createdAt_idx`(`productId`, `status`, `createdAt`),
    INDEX `product_reviews_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `product_reviews_onlineOrderId_idx`(`onlineOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `online_orders_addressId_idx` ON `online_orders`(`addressId`);

-- AddForeignKey
ALTER TABLE `customer_profiles` ADD CONSTRAINT `customer_profiles_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `online_orders` ADD CONSTRAINT `online_orders_addressId_fkey` FOREIGN KEY (`addressId`) REFERENCES `customer_addresses`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reviews` ADD CONSTRAINT `product_reviews_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reviews` ADD CONSTRAINT `product_reviews_productId_fkey` FOREIGN KEY (`productId`) REFERENCES `products`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reviews` ADD CONSTRAINT `product_reviews_onlineOrderId_fkey` FOREIGN KEY (`onlineOrderId`) REFERENCES `online_orders`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `product_reviews` ADD CONSTRAINT `product_reviews_onlineOrderItemId_fkey` FOREIGN KEY (`onlineOrderItemId`) REFERENCES `online_order_items`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
