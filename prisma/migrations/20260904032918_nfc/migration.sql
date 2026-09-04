/*
  Warnings:

  - A unique constraint covering the columns `[idempotency_key]` on the table `clock_punch` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE `clock_punch` ADD COLUMN `idempotency_key` VARCHAR(128) NULL,
    ADD COLUMN `nfc_tag_id` VARCHAR(191) NULL,
    MODIFY `punch_type` ENUM('EMPLOYEE', 'MANUAL', 'NFC') NOT NULL DEFAULT 'EMPLOYEE';

-- CreateTable
CREATE TABLE `nfc_punch_tag` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `location` VARCHAR(191) NOT NULL,
    `token_hash` CHAR(64) NULL,
    `pending_token_hash` CHAR(64) NULL,
    `provisioning_expires_at` DATETIME(3) NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT false,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `nfc_punch_tag_token_hash_key`(`token_hash`),
    UNIQUE INDEX `nfc_punch_tag_pending_token_hash_key`(`pending_token_hash`),
    INDEX `nfc_punch_tag_is_active_is_deleted_idx`(`is_active`, `is_deleted`),
    INDEX `nfc_punch_tag_provisioning_expires_at_idx`(`provisioning_expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE UNIQUE INDEX `clock_punch_idempotency_key_key` ON `clock_punch`(`idempotency_key`);

-- CreateIndex
CREATE INDEX `clock_punch_nfc_tag_id_idx` ON `clock_punch`(`nfc_tag_id`);

-- AddForeignKey
ALTER TABLE `clock_punch` ADD CONSTRAINT `clock_punch_nfc_tag_id_fkey` FOREIGN KEY (`nfc_tag_id`) REFERENCES `nfc_punch_tag`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
