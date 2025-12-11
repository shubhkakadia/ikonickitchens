-- CreateTable
CREATE TABLE `maintenance_checklist` (
    `id` VARCHAR(191) NOT NULL,
    `prepared_by_office` BOOLEAN NOT NULL DEFAULT false,
    `prepared_by_production` BOOLEAN NOT NULL DEFAULT false,
    `delivered_to_site` BOOLEAN NOT NULL DEFAULT false,
    `installed` BOOLEAN NOT NULL DEFAULT false,
    `lot_file_id` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `maintenance_checklist_lot_file_id_key`(`lot_file_id`),
    INDEX `maintenance_checklist_lot_file_id_idx`(`lot_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `maintenance_checklist` ADD CONSTRAINT `maintenance_checklist_lot_file_id_fkey` FOREIGN KEY (`lot_file_id`) REFERENCES `lot_file`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
