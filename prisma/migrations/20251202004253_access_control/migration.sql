/*
  Warnings:

  - You are about to drop the column `module_access` on the `users` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE `users` DROP COLUMN `module_access`;

-- CreateTable
CREATE TABLE `module_access` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `all_clients` BOOLEAN NOT NULL DEFAULT false,
    `add_clients` BOOLEAN NOT NULL DEFAULT false,
    `client_details` BOOLEAN NOT NULL DEFAULT false,
    `dashboard` BOOLEAN NOT NULL DEFAULT false,
    `delete_media` BOOLEAN NOT NULL DEFAULT false,
    `all_employees` BOOLEAN NOT NULL DEFAULT false,
    `add_employees` BOOLEAN NOT NULL DEFAULT false,
    `employee_details` BOOLEAN NOT NULL DEFAULT false,
    `all_projects` BOOLEAN NOT NULL DEFAULT false,
    `add_projects` BOOLEAN NOT NULL DEFAULT false,
    `project_details` BOOLEAN NOT NULL DEFAULT false,
    `all_suppliers` BOOLEAN NOT NULL DEFAULT false,
    `add_suppliers` BOOLEAN NOT NULL DEFAULT false,
    `supplier_details` BOOLEAN NOT NULL DEFAULT false,
    `all_items` BOOLEAN NOT NULL DEFAULT false,
    `add_items` BOOLEAN NOT NULL DEFAULT false,
    `item_details` BOOLEAN NOT NULL DEFAULT false,
    `used_material` BOOLEAN NOT NULL DEFAULT false,
    `logs` BOOLEAN NOT NULL DEFAULT false,
    `lotatglance` BOOLEAN NOT NULL DEFAULT false,
    `materialstoorder` BOOLEAN NOT NULL DEFAULT false,
    `purchaseorder` BOOLEAN NOT NULL DEFAULT false,
    `statements` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `module_access_user_id_key`(`user_id`),
    INDEX `module_access_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `module_access` ADD CONSTRAINT `module_access_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
