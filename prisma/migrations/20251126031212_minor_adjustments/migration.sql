-- DropForeignKey
ALTER TABLE `users` DROP FOREIGN KEY `users_employee_id_fkey`;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE SET NULL ON UPDATE CASCADE;
