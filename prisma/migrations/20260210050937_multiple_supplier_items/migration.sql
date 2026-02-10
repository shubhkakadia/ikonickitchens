-- CreateTable
CREATE TABLE `item_suppliers` (
    `id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NOT NULL,
    `supplier_id` VARCHAR(191) NOT NULL,
    `supplier_reference` VARCHAR(191) NULL,
    `supplier_product_link` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `item_suppliers` ADD CONSTRAINT `item_suppliers_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`supplier_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item_suppliers` ADD CONSTRAINT `item_suppliers_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RedefineIndex
CREATE INDEX `item_supplier_id_idx` ON `item`(`supplier_id`);
-- DROP INDEX `item_supplier_id_fkey` ON `item`;
