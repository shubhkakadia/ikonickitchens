/*
  Warnings:

  - A unique constraint covering the columns `[employee_id,is_deleted]` on the table `employees` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX `employees_email_key` ON `employees`;

-- AlterTable
ALTER TABLE `purchase_order` ADD COLUMN `delivery_charge` DECIMAL(10, 2) NULL,
    ADD COLUMN `invoice_date` DATETIME(3) NULL;

-- CreateIndex
CREATE UNIQUE INDEX `employees_employee_id_is_deleted_key` ON `employees`(`employee_id`, `is_deleted`);
