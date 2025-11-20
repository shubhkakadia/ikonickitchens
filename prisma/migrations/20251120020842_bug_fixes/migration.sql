/*
  Warnings:

  - You are about to drop the column `image` on the `item` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[image_id]` on the table `item` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `employees` DROP FOREIGN KEY `employees_image_id_fkey`;

-- DropForeignKey
ALTER TABLE `media` DROP FOREIGN KEY `media_materials_to_orderId_fkey`;

-- AlterTable
ALTER TABLE `contact` ADD COLUMN `role` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `abn_number` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `item` DROP COLUMN `image`,
    ADD COLUMN `image_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `materials_to_order` ADD COLUMN `media_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `media` ADD COLUMN `item_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `supplier` ADD COLUMN `abn_number` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `item_image_id_key` ON `item`(`image_id`);

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_materials_to_orderId_fkey` FOREIGN KEY (`materials_to_orderId`) REFERENCES `materials_to_order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item` ADD CONSTRAINT `item_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
