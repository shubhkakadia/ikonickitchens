-- DropIndex
DROP INDEX `logs_createdAt_idx` ON `logs`;

-- DropIndex
DROP INDEX `lot_file_createdAt_idx` ON `lot_file`;

-- DropIndex
DROP INDEX `material_selection_versions_createdAt_idx` ON `material_selection_versions`;

-- DropIndex
DROP INDEX `purchase_order_item_createdAt_idx` ON `purchase_order_item`;

-- DropIndex
DROP INDEX `stock_transaction_createdAt_idx` ON `stock_transaction`;

-- AlterTable
ALTER TABLE `employees` MODIFY `availability` LONGTEXT NULL;

-- AlterTable
ALTER TABLE `logs` MODIFY `description` LONGTEXT NULL;

-- CreateTable
CREATE TABLE `push_tokens` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `session_id` VARCHAR(191) NULL,
    `expo_push_token` VARCHAR(191) NOT NULL,
    `platform` VARCHAR(191) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `last_registered_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `last_error` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `push_tokens_expo_push_token_key`(`expo_push_token`),
    INDEX `push_tokens_user_id_idx`(`user_id`),
    INDEX `push_tokens_session_id_idx`(`session_id`),
    INDEX `push_tokens_enabled_idx`(`enabled`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `push_notification_tickets` (
    `id` VARCHAR(191) NOT NULL,
    `expo_ticket_id` VARCHAR(191) NOT NULL,
    `push_token_id` VARCHAR(191) NOT NULL,
    `lot_id` VARCHAR(191) NULL,
    `status` VARCHAR(191) NOT NULL DEFAULT 'PENDING',
    `error_code` VARCHAR(191) NULL,
    `error_message` LONGTEXT NULL,
    `receipt_checked_at` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `push_notification_tickets_expo_ticket_id_key`(`expo_ticket_id`),
    INDEX `push_notification_tickets_push_token_id_idx`(`push_token_id`),
    INDEX `push_notification_tickets_lot_id_idx`(`lot_id`),
    INDEX `push_notification_tickets_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `logs_createdAt_idx` ON `logs`(`createdAt`);

-- CreateIndex
CREATE INDEX `lot_file_createdAt_idx` ON `lot_file`(`createdAt`);

-- CreateIndex
CREATE INDEX `material_selection_versions_createdAt_idx` ON `material_selection_versions`(`createdAt`);

-- CreateIndex
CREATE INDEX `purchase_order_item_createdAt_idx` ON `purchase_order_item`(`createdAt`);

-- CreateIndex
CREATE INDEX `stock_transaction_createdAt_idx` ON `stock_transaction`(`createdAt`);

-- AddForeignKey
ALTER TABLE `push_tokens` ADD CONSTRAINT `push_tokens_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_tokens` ADD CONSTRAINT `push_tokens_session_id_fkey` FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_notification_tickets` ADD CONSTRAINT `push_notification_tickets_push_token_id_fkey` FOREIGN KEY (`push_token_id`) REFERENCES `push_tokens`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `push_notification_tickets` ADD CONSTRAINT `push_notification_tickets_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`lot_id`) ON DELETE SET NULL ON UPDATE CASCADE;
