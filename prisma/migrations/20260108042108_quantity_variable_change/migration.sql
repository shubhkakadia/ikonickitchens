/*
  Warnings:

  - You are about to alter the column `quantity` on the `item` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Decimal(10,2)`.

*/
-- AlterTable
ALTER TABLE `item` MODIFY `quantity` DECIMAL(10, 2) NULL DEFAULT 0;
