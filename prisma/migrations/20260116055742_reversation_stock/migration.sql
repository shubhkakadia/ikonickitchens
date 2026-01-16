-- AlterTable
ALTER TABLE `purchase_order_item` ADD COLUMN `gst` DECIMAL(10, 2) NULL,
    ADD COLUMN `total_amount` DECIMAL(10, 2) NULL;

-- CreateTable
CREATE TABLE `reserve_item_stock` (
    `id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `used_quantity` INTEGER NOT NULL,
    `mto_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `reserve_item_stock` ADD CONSTRAINT `reserve_item_stock_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `reserve_item_stock` ADD CONSTRAINT `reserve_item_stock_mto_id_fkey` FOREIGN KEY (`mto_id`) REFERENCES `materials_to_order_item`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
