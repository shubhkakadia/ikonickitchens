-- AlterTable
ALTER TABLE `item_suppliers` MODIFY `supplier_product_link` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `module_access` ADD COLUMN `site_measurements` BOOLEAN NOT NULL DEFAULT false;

-- RedefineIndex
CREATE INDEX `item_supplier_id_fkey` ON `item`(`supplier_id`);
DROP INDEX `item_supplier_id_idx` ON `item`;
