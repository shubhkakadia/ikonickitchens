-- CreateTable
CREATE TABLE `notification_config` (
    `id` VARCHAR(191) NOT NULL,
    `material_to_order` BOOLEAN NOT NULL DEFAULT false,
    `stage_updates` BOOLEAN NOT NULL DEFAULT false,
    `stage_quote_approve` BOOLEAN NOT NULL DEFAULT false,
    `stage_material_appliances_selection` BOOLEAN NOT NULL DEFAULT false,
    `stage_drafting` BOOLEAN NOT NULL DEFAULT false,
    `stage_drafting_revision` BOOLEAN NOT NULL DEFAULT false,
    `stage_final_design_approval` BOOLEAN NOT NULL DEFAULT false,
    `stage_site_measurements` BOOLEAN NOT NULL DEFAULT false,
    `stage_final_approval_for_production` BOOLEAN NOT NULL DEFAULT false,
    `stage_machining_out` BOOLEAN NOT NULL DEFAULT false,
    `stage_material_order` BOOLEAN NOT NULL DEFAULT false,
    `stage_cnc` BOOLEAN NOT NULL DEFAULT false,
    `stage_assembly` BOOLEAN NOT NULL DEFAULT false,
    `stage_delivery` BOOLEAN NOT NULL DEFAULT false,
    `stage_installation` BOOLEAN NOT NULL DEFAULT false,
    `stage_invoice_sent` BOOLEAN NOT NULL DEFAULT false,
    `stage_maintenance` BOOLEAN NOT NULL DEFAULT false,
    `stage_job_completion` BOOLEAN NOT NULL DEFAULT false,
    `stock_transactions` BOOLEAN NOT NULL DEFAULT false,
    `supplier_statements` BOOLEAN NOT NULL DEFAULT false,
    `user_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `notification_config_user_id_key`(`user_id`),
    INDEX `notification_config_user_id_idx`(`user_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `notification_config` ADD CONSTRAINT `notification_config_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
