/*
  Warnings:

  - You are about to drop the column `used_material` on the `module_access` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `module_access` DROP COLUMN `used_material`,
    ADD COLUMN `usedmaterial` BOOLEAN NOT NULL DEFAULT false;
