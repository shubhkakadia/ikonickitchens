-- AlterTable
ALTER TABLE `module_access` ADD COLUMN `add_clock_punch` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `all_clock_punches` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `clock_punch_details` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `clock_punch` (
    `id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `action` ENUM('CLOCK_IN', 'BREAK_IN', 'BREAK_OUT', 'CLOCK_OUT') NOT NULL,
    `punch_type` ENUM('EMPLOYEE', 'MANUAL') NOT NULL DEFAULT 'EMPLOYEE',
    `punched_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `review_status` ENUM('PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `reviewed_by_id` VARCHAR(191) NULL,
    `reviewed_at` DATETIME(3) NULL,
    `review_notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `clock_punch_employee_id_punched_at_idx`(`employee_id`, `punched_at`),
    INDEX `clock_punch_user_id_idx`(`user_id`),
    INDEX `clock_punch_review_status_punched_at_idx`(`review_status`, `punched_at`),
    INDEX `clock_punch_reviewed_by_id_idx`(`reviewed_by_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `clock_punch` ADD CONSTRAINT `clock_punch_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_punch` ADD CONSTRAINT `clock_punch_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clock_punch` ADD CONSTRAINT `clock_punch_reviewed_by_id_fkey` FOREIGN KEY (`reviewed_by_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
