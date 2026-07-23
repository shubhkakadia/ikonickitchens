/*
  Warnings:

  - A unique constraint covering the columns `[client_slug]` on the table `client` will be added. If there are existing duplicate values, this will fail.

*/

-- DropIndex
DROP INDEX `lot_lot_id_idx` ON `lot`;

-- AlterTable
ALTER TABLE `client` ADD COLUMN `client_slug` VARCHAR(191) NULL;


-- AlterTable
ALTER TABLE `stock_transaction` ADD COLUMN `lot_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `client_client_slug_key` ON `client`(`client_slug`);

-- CreateIndex
CREATE INDEX `stock_transaction_lot_id_idx` ON `stock_transaction`(`lot_id`);

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `client`(`client_id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transaction` ADD CONSTRAINT `stock_transaction_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`lot_id`) ON DELETE SET NULL ON UPDATE CASCADE;
