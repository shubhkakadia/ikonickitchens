/*
  Warnings:

  - You are about to drop the column `price` on the `item` table. All the data in the column will be lost.
  - You are about to drop the column `supplier_id` on the `item` table. All the data in the column will be lost.
  - You are about to drop the column `supplier_product_link` on the `item` table. All the data in the column will be lost.
  - You are about to drop the column `supplier_reference` on the `item` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE `item` DROP FOREIGN KEY `item_supplier_id_fkey`;

-- DropIndex
DROP INDEX `item_supplier_id_fkey` ON `item`;

-- AlterTable
ALTER TABLE `item` DROP COLUMN `price`,
    DROP COLUMN `supplier_id`,
    DROP COLUMN `supplier_product_link`,
    DROP COLUMN `supplier_reference`;
