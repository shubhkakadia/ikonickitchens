/*
  Warnings:

  - Added the required column `event_id` to the `push_notification_tickets` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `push_notification_tickets` ADD COLUMN `attempt_count` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `event_id` VARCHAR(191) NOT NULL,
    ADD COLUMN `next_attempt_at` DATETIME(3) NULL,
    ADD COLUMN `receipt_result` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `push_tokens` ADD COLUMN `consented_at` DATETIME(3) NULL,
    ADD COLUMN `disabled_at` DATETIME(3) NULL,
    ADD COLUMN `last_error_code` VARCHAR(191) NULL,
    ADD COLUMN `revocation_handle_hash` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `push_notification_tickets_event_id_idx` ON `push_notification_tickets`(`event_id`);

-- CreateIndex
CREATE INDEX `push_notification_tickets_status_next_attempt_at_idx` ON `push_notification_tickets`(`status`, `next_attempt_at`);
