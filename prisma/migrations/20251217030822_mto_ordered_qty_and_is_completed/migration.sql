-- AlterTable
ALTER TABLE `materials_to_order` ADD COLUMN `used_material_completed` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `materials_to_order_item` ADD COLUMN `quantity_ordered_po` INTEGER NOT NULL DEFAULT 0;
