-- AlterTable
ALTER TABLE `module_access` ADD COLUMN `calendar` BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE `notification_config` ADD COLUMN `meeting` BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE `meeting` (
    `id` VARCHAR(191) NOT NULL,
    `date_time` DATETIME(3) NOT NULL,
    `date_time_end` DATETIME(3) NULL,
    `title` VARCHAR(191) NOT NULL,
    `notes` VARCHAR(191) NULL,
    `remainder` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_lotTomeeting` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_lotTomeeting_AB_unique`(`A`, `B`),
    INDEX `_lotTomeeting_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `_meetingTousers` (
    `A` VARCHAR(191) NOT NULL,
    `B` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `_meetingTousers_AB_unique`(`A`, `B`),
    INDEX `_meetingTousers_B_index`(`B`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `_lotTomeeting` ADD CONSTRAINT `_lotTomeeting_A_fkey` FOREIGN KEY (`A`) REFERENCES `lot`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_lotTomeeting` ADD CONSTRAINT `_lotTomeeting_B_fkey` FOREIGN KEY (`B`) REFERENCES `meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_meetingTousers` ADD CONSTRAINT `_meetingTousers_A_fkey` FOREIGN KEY (`A`) REFERENCES `meeting`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `_meetingTousers` ADD CONSTRAINT `_meetingTousers_B_fkey` FOREIGN KEY (`B`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
