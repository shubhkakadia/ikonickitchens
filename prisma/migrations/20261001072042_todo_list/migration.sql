-- DropForeignKey
ALTER TABLE `employees` DROP FOREIGN KEY `employees_image_id_fkey`;

-- AlterTable
ALTER TABLE `materials_to_order` ADD COLUMN `is_deleted` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `project` ADD COLUMN `sync_all_lots` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `todo` (
    `id` VARCHAR(191) NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `notes` LONGTEXT NULL,
    `due_date` DATETIME(3) NULL,
    `is_completed` BOOLEAN NOT NULL DEFAULT false,
    `completed_at` DATETIME(3) NULL,
    `completed_by_id` VARCHAR(191) NULL,
    `created_by_id` VARCHAR(191) NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `todo_created_by_id_idx`(`created_by_id`),
    INDEX `todo_completed_by_id_idx`(`completed_by_id`),
    INDEX `todo_is_completed_is_deleted_idx`(`is_completed`, `is_deleted`),
    INDEX `todo_due_date_idx`(`due_date`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_TodoTagged` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_TodoTagged_AB_unique`(`A`, `B`),
    INDEX `_TodoTagged_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `materials_to_order_is_deleted_idx` ON `materials_to_order`(`is_deleted`);

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `todo` ADD CONSTRAINT `todo_created_by_id_fkey` FOREIGN KEY (`created_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `todo` ADD CONSTRAINT `todo_completed_by_id_fkey` FOREIGN KEY (`completed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TodoTagged` ADD CONSTRAINT `_TodoTagged_A_fkey` FOREIGN KEY (`A`) REFERENCES `todo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_TodoTagged` ADD CONSTRAINT `_TodoTagged_B_fkey` FOREIGN KEY (`B`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
