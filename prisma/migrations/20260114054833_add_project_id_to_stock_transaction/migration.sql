-- AlterTable
ALTER TABLE `stock_transaction` ADD COLUMN `project_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `stock_transaction_project_id_idx` ON `stock_transaction`(`project_id`);

-- AddForeignKey
ALTER TABLE `stock_transaction` ADD CONSTRAINT `stock_transaction_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON DELETE SET NULL ON UPDATE CASCADE;
