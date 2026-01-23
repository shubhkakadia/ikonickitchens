-- AlterTable
ALTER TABLE `meeting` ADD COLUMN `remainder_1d_sent` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `remainder_1h_sent` BOOLEAN NOT NULL DEFAULT false;
