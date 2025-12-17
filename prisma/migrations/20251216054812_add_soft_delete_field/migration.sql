/*
  Warnings:

  - You are about to drop the column `supplier_id` on the `supplier_file` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[supplier_file_id]` on the table `supplier_statement` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE `item` DROP FOREIGN KEY `item_image_id_fkey`;

-- DropForeignKey
ALTER TABLE `item` DROP FOREIGN KEY `item_supplier_id_fkey`;

-- DropForeignKey
ALTER TABLE `maintenance_checklist` DROP FOREIGN KEY `maintenance_checklist_lot_file_id_fkey`;

-- DropForeignKey
ALTER TABLE `material_selection` DROP FOREIGN KEY `material_selection_quote_id_fkey`;

-- DropForeignKey
ALTER TABLE `material_selection_versions` DROP FOREIGN KEY `material_selection_versions_quote_id_fkey`;

-- DropForeignKey
ALTER TABLE `project` DROP FOREIGN KEY `project_client_id_fkey`;

-- DropForeignKey
ALTER TABLE `purchase_order` DROP FOREIGN KEY `purchase_order_invoice_url_id_fkey`;

-- DropForeignKey
ALTER TABLE `purchase_order_item` DROP FOREIGN KEY `purchase_order_item_item_id_fkey`;

-- DropForeignKey
ALTER TABLE `stage_employee` DROP FOREIGN KEY `stage_employee_employee_id_fkey`;

-- DropForeignKey
ALTER TABLE `stock_transaction` DROP FOREIGN KEY `stock_transaction_item_id_fkey`;

-- AlterTable
ALTER TABLE `client` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `employees` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `item` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `lot` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `project` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `supplier` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `supplier_file` DROP COLUMN `supplier_id`;

-- AlterTable
ALTER TABLE `supplier_statement` MODIFY `supplier_file_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `supplier_statement_supplier_file_id_key` ON `supplier_statement`(`supplier_file_id`);

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `client`(`client_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_employee` ADD CONSTRAINT `stage_employee_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `maintenance_checklist` ADD CONSTRAINT `maintenance_checklist_lot_file_id_fkey` FOREIGN KEY (`lot_file_id`) REFERENCES `lot_file`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection` ADD CONSTRAINT `material_selection_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`quote_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection_versions` ADD CONSTRAINT `material_selection_versions_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`quote_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item` ADD CONSTRAINT `item_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item` ADD CONSTRAINT `item_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`supplier_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_invoice_url_id_fkey` FOREIGN KEY (`invoice_url_id`) REFERENCES `supplier_file`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_item` ADD CONSTRAINT `purchase_order_item_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transaction` ADD CONSTRAINT `stock_transaction_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE RESTRICT ON UPDATE CASCADE;
