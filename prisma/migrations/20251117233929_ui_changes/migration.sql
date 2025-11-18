/*
  Warnings:

  - Added the required column `updatedAt` to the `material_selection` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `stage_employee` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE `material_selection` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `stage_employee` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `updatedAt` DATETIME(3) NOT NULL;
