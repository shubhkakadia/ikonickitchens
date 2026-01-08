-- AlterTable
ALTER TABLE `materials_to_order_item` ADD COLUMN `ordered_by_id` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `notification_config` ADD COLUMN `material_to_order_ordered` BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE `materials_to_order_item` ADD CONSTRAINT `materials_to_order_item_ordered_by_id_fkey` FOREIGN KEY (`ordered_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
