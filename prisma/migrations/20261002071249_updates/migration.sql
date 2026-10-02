-- CreateTable
CREATE TABLE `update_event` (
    `id` VARCHAR(191) NOT NULL,
    `type` ENUM('CALENDAR_EVENT_CREATED', 'CALENDAR_EVENT_UPDATED', 'PROJECT_CREATED', 'PROJECT_UPDATED', 'STAGE_UPDATED', 'LOT_NOTES_UPDATED', 'LOT_FILE_UPLOADED', 'MTO_CREATED', 'MTO_ORDERED', 'SUPPLIER_STATEMENT_ADDED') NOT NULL,
    `actor_id` VARCHAR(191) NULL,
    `title` VARCHAR(191) NOT NULL,
    `message` TEXT NOT NULL,
    `url` VARCHAR(1024) NOT NULL,
    `dedupe_key` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `update_event_createdAt_idx`(`createdAt`),
    INDEX `update_event_updatedAt_idx`(`updatedAt`),
    INDEX `update_event_type_idx`(`type`),
    INDEX `update_event_dedupe_key_actor_id_idx`(`dedupe_key`, `actor_id`),
    INDEX `update_event_actor_id_idx`(`actor_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `update_recipient` (
    `id` VARCHAR(191) NOT NULL,
    `update_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `read_at` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `update_recipient_user_id_read_at_idx`(`user_id`, `read_at`),
    INDEX `update_recipient_update_id_idx`(`update_id`),
    UNIQUE INDEX `update_recipient_update_id_user_id_key`(`update_id`, `user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `update_event` ADD CONSTRAINT `update_event_actor_id_fkey` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `update_recipient` ADD CONSTRAINT `update_recipient_update_id_fkey` FOREIGN KEY (`update_id`) REFERENCES `update_event`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `update_recipient` ADD CONSTRAINT `update_recipient_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
