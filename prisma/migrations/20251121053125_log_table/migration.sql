/*
  Warnings:

  - You are about to drop the column `contact_id` on the `contact` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[item_id,category]` on the table `item` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `contact_contact_id_idx` ON `contact`;

-- DropIndex
DROP INDEX `contact_contact_id_key` ON `contact`;

-- AlterTable
ALTER TABLE `contact` DROP COLUMN `contact_id`;

-- AlterTable
ALTER TABLE `item` ADD COLUMN `supplier_product_link` LONGTEXT NULL,
    ADD COLUMN `supplier_reference` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `logs` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NULL,
    `entity_type` VARCHAR(191) NOT NULL,
    `entity_id` VARCHAR(191) NOT NULL,
    `action` ENUM('CREATE', 'UPDATE', 'DELETE', 'STATUS_CHANGE', 'ASSIGN', 'UPLOAD', 'OTHER') NOT NULL,
    `description` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `logs_createdAt_idx`(`createdAt` DESC),
    INDEX `logs_user_id_idx`(`user_id`),
    INDEX `logs_entity_type_idx`(`entity_type`),
    INDEX `logs_entity_id_idx`(`entity_id`),
    INDEX `logs_action_idx`(`action`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `item_item_id_category_key` ON `item`(`item_id`, `category`);

-- CreateIndex
CREATE INDEX `lot_file_createdAt_idx` ON `lot_file`(`createdAt` DESC);

-- CreateIndex
CREATE INDEX `material_selection_versions_createdAt_idx` ON `material_selection_versions`(`createdAt` DESC);

-- CreateIndex
CREATE INDEX `purchase_order_item_createdAt_idx` ON `purchase_order_item`(`createdAt` DESC);

-- CreateIndex
CREATE INDEX `stock_transaction_createdAt_idx` ON `stock_transaction`(`createdAt` DESC);

-- AddForeignKey
ALTER TABLE `logs` ADD CONSTRAINT `logs_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
