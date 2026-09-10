-- AlterTable
ALTER TABLE `clock_punch` ADD COLUMN `break_over_sent_at` DATETIME(3) NULL,
    ADD COLUMN `break_warning_sent_at` DATETIME(3) NULL;

-- AlterTable
ALTER TABLE `item` ADD COLUMN `minimum_stock` DECIMAL(10, 2) NULL;

-- AlterTable
ALTER TABLE `purchase_order` ADD COLUMN `expected_delivery_date` DATETIME(3) NULL;

-- CreateIndex
CREATE INDEX `clock_punch_action_punched_at_idx` ON `clock_punch`(`action`, `punched_at`);
