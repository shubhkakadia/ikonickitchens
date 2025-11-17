-- CreateTable
CREATE TABLE `users` (
    `id` VARCHAR(191) NOT NULL,
    `username` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `user_type` VARCHAR(191) NOT NULL,
    `is_active` BOOLEAN NOT NULL DEFAULT true,
    `employee_id` VARCHAR(191) NULL,
    `module_access` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_username_key`(`username`),
    UNIQUE INDEX `users_employee_id_key`(`employee_id`),
    INDEX `users_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` VARCHAR(191) NOT NULL,
    `user_id` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `user_type` VARCHAR(191) NOT NULL,
    `expires_at` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sessions_token_key`(`token`),
    INDEX `sessions_user_id_idx`(`user_id`),
    INDEX `sessions_user_type_idx`(`user_type`),
    INDEX `sessions_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `employees` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NULL,
    `image_id` VARCHAR(191) NULL,
    `role` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `phone` VARCHAR(191) NOT NULL,
    `dob` DATETIME(3) NULL,
    `join_date` DATETIME(3) NULL,
    `address` VARCHAR(191) NULL,
    `emergency_contact_name` VARCHAR(191) NULL,
    `emergency_contact_phone` VARCHAR(191) NULL,
    `bank_account_name` VARCHAR(191) NULL,
    `bank_account_number` VARCHAR(191) NULL,
    `bank_account_bsb` VARCHAR(191) NULL,
    `supper_account_name` VARCHAR(191) NULL,
    `supper_account_number` VARCHAR(191) NULL,
    `tfn_number` VARCHAR(191) NULL,
    `education` VARCHAR(191) NULL,
    `availability` JSON NULL,
    `notes` VARCHAR(191) NULL,

    UNIQUE INDEX `employees_employee_id_key`(`employee_id`),
    UNIQUE INDEX `employees_image_id_key`(`image_id`),
    UNIQUE INDEX `employees_email_key`(`email`),
    INDEX `employees_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `media` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NULL,
    `file_type` VARCHAR(191) NULL,
    `mime_type` VARCHAR(191) NULL,
    `extension` VARCHAR(191) NULL,
    `size` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `employee_id` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `materials_to_orderId` VARCHAR(191) NULL,

    INDEX `media_employee_id_idx`(`employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `contact` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `contact_id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NULL,
    `supplier_id` VARCHAR(191) NULL,
    `first_name` VARCHAR(191) NOT NULL,
    `last_name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `preferred_contact_method` VARCHAR(191) NULL,
    `notes` LONGTEXT NULL,

    UNIQUE INDEX `contact_contact_id_key`(`contact_id`),
    INDEX `contact_contact_id_idx`(`contact_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client` (
    `client_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `client_type` VARCHAR(191) NOT NULL,
    `client_name` VARCHAR(191) NOT NULL,
    `client_address` VARCHAR(191) NULL,
    `client_phone` VARCHAR(191) NULL,
    `client_email` VARCHAR(191) NULL,
    `client_website` VARCHAR(191) NULL,
    `client_notes` LONGTEXT NULL,

    UNIQUE INDEX `client_client_name_key`(`client_name`),
    INDEX `client_client_name_idx`(`client_name`),
    INDEX `client_client_id_idx`(`client_id`),
    PRIMARY KEY (`client_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `project` (
    `id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `client_id` VARCHAR(191) NULL,

    UNIQUE INDEX `project_project_id_key`(`project_id`),
    INDEX `project_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lot` (
    `id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `lot_id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('ACTIVE', 'COMPLETED') NOT NULL DEFAULT 'ACTIVE',
    `startDate` DATETIME(3) NULL,
    `installationDueDate` DATETIME(3) NULL,
    `notes` LONGTEXT NULL,
    `materials_to_orders_id` VARCHAR(191) NULL,
    `material_selection_id` VARCHAR(191) NULL,

    UNIQUE INDEX `lot_lot_id_key`(`lot_id`),
    UNIQUE INDEX `lot_material_selection_id_key`(`material_selection_id`),
    INDEX `lot_lot_id_idx`(`lot_id`),
    INDEX `lot_project_id_idx`(`project_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage` (
    `stage_id` VARCHAR(191) NOT NULL,
    `lot_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `status` ENUM('NOT_STARTED', 'IN_PROGRESS', 'DONE', 'NA') NOT NULL,
    `notes` LONGTEXT NULL,
    `startDate` DATETIME(3) NULL,
    `endDate` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stage_stage_id_idx`(`stage_id`),
    INDEX `stage_lot_id_idx`(`lot_id`),
    INDEX `stage_name_idx`(`name`),
    INDEX `stage_status_idx`(`status`),
    PRIMARY KEY (`stage_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stage_employee` (
    `id` VARCHAR(191) NOT NULL,
    `stage_id` VARCHAR(191) NOT NULL,
    `employee_id` VARCHAR(191) NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `stage_employee_stage_id_idx`(`stage_id`),
    INDEX `stage_employee_employee_id_idx`(`employee_id`),
    UNIQUE INDEX `stage_employee_stage_id_employee_id_key`(`stage_id`, `employee_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lot_tab` (
    `id` VARCHAR(191) NOT NULL,
    `lot_id` VARCHAR(191) NOT NULL,
    `tab` ENUM('ARCHITECTURE_DRAWINGS', 'APPLIANCES_SPECIFICATIONS', 'MATERIAL_SELECTION', 'CABINETRY_DRAWINGS', 'CHANGES_TO_DO', 'SITE_MEASUREMENTS') NOT NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lot_tab_lot_id_tab_idx`(`lot_id`, `tab`),
    UNIQUE INDEX `lot_tab_lot_id_tab_key`(`lot_id`, `tab`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lot_file` (
    `id` VARCHAR(191) NOT NULL,
    `tab_id` VARCHAR(191) NOT NULL,
    `file_kind` ENUM('PHOTO', 'VIDEO', 'PDF', 'OTHER') NOT NULL DEFAULT 'PHOTO',
    `url` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `extension` VARCHAR(191) NULL,
    `size` INTEGER NULL,
    `site_group` ENUM('SITE_PHOTOS', 'MEASUREMENT_PHOTOS') NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lot_file_tab_id_idx`(`tab_id`),
    INDEX `lot_file_file_kind_idx`(`file_kind`),
    INDEX `lot_file_site_group_idx`(`site_group`),
    INDEX `lot_file_is_deleted_idx`(`is_deleted`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `quote` (
    `id` VARCHAR(191) NOT NULL,
    `quote_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `quote_quote_id_key`(`quote_id`),
    INDEX `quote_quote_id_idx`(`quote_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_selection` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NULL,
    `quote_id` VARCHAR(191) NULL,
    `createdBy_id` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `current_version_id` VARCHAR(191) NULL,
    `lot_id` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `material_selection_current_version_id_key`(`current_version_id`),
    UNIQUE INDEX `material_selection_lot_id_key`(`lot_id`),
    INDEX `material_selection_project_id_idx`(`project_id`),
    INDEX `material_selection_id_idx`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_selection_versions` (
    `id` VARCHAR(191) NOT NULL,
    `material_selection_id` VARCHAR(191) NOT NULL,
    `version_number` INTEGER NOT NULL DEFAULT 1,
    `is_current` BOOLEAN NOT NULL DEFAULT false,
    `quote_id` VARCHAR(191) NULL,
    `ceiling_height` DECIMAL(10, 2) NULL,
    `bulkhead_height` DECIMAL(10, 2) NULL,
    `kicker_height` DECIMAL(10, 2) NULL,
    `cabinetry_height` DECIMAL(10, 2) NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `material_selection_versions_material_selection_id_idx`(`material_selection_id`),
    INDEX `material_selection_versions_quote_id_idx`(`quote_id`),
    UNIQUE INDEX `material_selection_versions_material_selection_id_version_nu_key`(`material_selection_id`, `version_number`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_selection_version_area` (
    `id` VARCHAR(191) NOT NULL,
    `version_id` VARCHAR(191) NOT NULL,
    `area_name` VARCHAR(191) NOT NULL,
    `area_instance_id` INTEGER NOT NULL DEFAULT 1,
    `bed_option` VARCHAR(191) NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `material_selection_version_area_id_idx`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `material_selection_version_area_item` (
    `id` VARCHAR(191) NOT NULL,
    `version_area_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `category` VARCHAR(191) NULL,
    `is_applicable` BOOLEAN NOT NULL DEFAULT false,
    `item_notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `material_selection_version_area_item_id_idx`(`id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `item` (
    `item_id` VARCHAR(191) NOT NULL,
    `category` ENUM('SHEET', 'HANDLE', 'HARDWARE', 'ACCESSORY', 'EDGING_TAPE') NOT NULL,
    `description` VARCHAR(191) NULL,
    `image` VARCHAR(191) NULL,
    `price` DECIMAL(10, 2) NULL,
    `quantity` INTEGER NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `measurement_unit` VARCHAR(191) NULL,
    `supplier_id` VARCHAR(191) NULL,

    INDEX `item_category_idx`(`category`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sheet` (
    `item_id` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `finish` VARCHAR(191) NOT NULL,
    `face` VARCHAR(191) NULL,
    `dimensions` VARCHAR(191) NOT NULL,
    `is_sunmica` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `sheet_item_id_key`(`item_id`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `handle` (
    `item_id` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `dimensions` VARCHAR(191) NOT NULL,
    `material` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `handle_item_id_key`(`item_id`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hardware` (
    `item_id` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `type` VARCHAR(191) NOT NULL,
    `dimensions` VARCHAR(191) NOT NULL,
    `sub_category` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hardware_item_id_key`(`item_id`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `accessory` (
    `item_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `accessory_item_id_key`(`item_id`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `edging_tape` (
    `item_id` VARCHAR(191) NOT NULL,
    `brand` VARCHAR(191) NOT NULL,
    `color` VARCHAR(191) NOT NULL,
    `finish` VARCHAR(191) NOT NULL,
    `dimensions` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `edging_tape_item_id_key`(`item_id`),
    PRIMARY KEY (`item_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier` (
    `supplier_id` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `address` VARCHAR(191) NULL,
    `phone` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `website` VARCHAR(191) NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `supplier_name_key`(`name`),
    INDEX `supplier_supplier_id_idx`(`supplier_id`),
    PRIMARY KEY (`supplier_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_statement` (
    `id` VARCHAR(191) NOT NULL,
    `month_year` VARCHAR(191) NOT NULL,
    `notes` LONGTEXT NULL,
    `payment_status` ENUM('PENDING', 'PAID') NOT NULL DEFAULT 'PENDING',
    `amount` DECIMAL(10, 2) NULL,
    `due_date` DATETIME(3) NOT NULL,
    `supplier_file_id` VARCHAR(191) NOT NULL,
    `supplier_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `supplier_statement_supplier_file_id_idx`(`supplier_file_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `supplier_file` (
    `id` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `filename` VARCHAR(191) NOT NULL,
    `file_type` VARCHAR(191) NOT NULL,
    `mime_type` VARCHAR(191) NULL,
    `extension` VARCHAR(191) NULL,
    `size` INTEGER NULL,
    `is_deleted` BOOLEAN NOT NULL DEFAULT false,
    `supplier_id` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials_to_order` (
    `id` VARCHAR(191) NOT NULL,
    `project_id` VARCHAR(191) NOT NULL,
    `status` ENUM('DRAFT', 'PARTIALLY_ORDERED', 'FULLY_ORDERED', 'CLOSED') NOT NULL DEFAULT 'DRAFT',
    `notes` LONGTEXT NULL,
    `createdBy_id` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `materials_to_order_project_id_idx`(`project_id`),
    INDEX `materials_to_order_status_idx`(`status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `materials_to_order_item` (
    `id` VARCHAR(191) NOT NULL,
    `mto_id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `notes` LONGTEXT NULL,
    `quantity_ordered` INTEGER NOT NULL DEFAULT 0,
    `quantity_used` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `materials_to_order_item_mto_id_idx`(`mto_id`),
    INDEX `materials_to_order_item_item_id_idx`(`item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order` (
    `id` VARCHAR(191) NOT NULL,
    `order_no` VARCHAR(191) NOT NULL,
    `supplier_id` VARCHAR(191) NOT NULL,
    `mto_id` VARCHAR(191) NULL,
    `ordered_at` DATETIME(3) NULL,
    `orderedBy_id` VARCHAR(191) NULL,
    `invoice_url_id` VARCHAR(191) NULL,
    `total_amount` DECIMAL(10, 2) NULL,
    `notes` LONGTEXT NULL,
    `status` ENUM('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'FULLY_RECEIVED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `purchase_order_order_no_key`(`order_no`),
    UNIQUE INDEX `purchase_order_invoice_url_id_key`(`invoice_url_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `purchase_order_item` (
    `id` VARCHAR(191) NOT NULL,
    `order_id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NOT NULL,
    `mto_item_id` VARCHAR(191) NULL,
    `quantity` INTEGER NOT NULL,
    `quantity_received` INTEGER NULL DEFAULT 0,
    `unit_price` DECIMAL(10, 2) NULL,
    `notes` LONGTEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `stock_transaction` (
    `id` VARCHAR(191) NOT NULL,
    `item_id` VARCHAR(191) NOT NULL,
    `quantity` INTEGER NOT NULL,
    `type` ENUM('ADDED', 'USED', 'WASTED') NOT NULL,
    `notes` LONGTEXT NULL,
    `materials_to_order_id` VARCHAR(191) NULL,
    `purchase_order_id` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `stock_transaction_item_id_idx`(`item_id`),
    INDEX `stock_transaction_purchase_order_id_idx`(`purchase_order_id`),
    INDEX `stock_transaction_materials_to_order_id_idx`(`materials_to_order_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `users` ADD CONSTRAINT `users_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_fkey` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `employees` ADD CONSTRAINT `employees_image_id_fkey` FOREIGN KEY (`image_id`) REFERENCES `media`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_materials_to_orderId_fkey` FOREIGN KEY (`materials_to_orderId`) REFERENCES `materials_to_order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact` ADD CONSTRAINT `contact_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `client`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `contact` ADD CONSTRAINT `contact_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`supplier_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `project` ADD CONSTRAINT `project_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `client`(`client_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lot` ADD CONSTRAINT `lot_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lot` ADD CONSTRAINT `lot_materials_to_orders_id_fkey` FOREIGN KEY (`materials_to_orders_id`) REFERENCES `materials_to_order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage` ADD CONSTRAINT `stage_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`lot_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_employee` ADD CONSTRAINT `stage_employee_stage_id_fkey` FOREIGN KEY (`stage_id`) REFERENCES `stage`(`stage_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stage_employee` ADD CONSTRAINT `stage_employee_employee_id_fkey` FOREIGN KEY (`employee_id`) REFERENCES `employees`(`employee_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lot_tab` ADD CONSTRAINT `lot_tab_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`lot_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lot_file` ADD CONSTRAINT `lot_file_tab_id_fkey` FOREIGN KEY (`tab_id`) REFERENCES `lot_tab`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection` ADD CONSTRAINT `material_selection_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection` ADD CONSTRAINT `material_selection_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`quote_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection` ADD CONSTRAINT `material_selection_createdBy_id_fkey` FOREIGN KEY (`createdBy_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection` ADD CONSTRAINT `material_selection_current_version_id_fkey` FOREIGN KEY (`current_version_id`) REFERENCES `material_selection_versions`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection` ADD CONSTRAINT `material_selection_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`lot_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection_versions` ADD CONSTRAINT `material_selection_versions_quote_id_fkey` FOREIGN KEY (`quote_id`) REFERENCES `quote`(`quote_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection_versions` ADD CONSTRAINT `material_selection_versions_material_selection_id_fkey` FOREIGN KEY (`material_selection_id`) REFERENCES `material_selection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection_version_area` ADD CONSTRAINT `material_selection_version_area_version_id_fkey` FOREIGN KEY (`version_id`) REFERENCES `material_selection_versions`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `material_selection_version_area_item` ADD CONSTRAINT `material_selection_version_area_item_version_area_id_fkey` FOREIGN KEY (`version_area_id`) REFERENCES `material_selection_version_area`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `item` ADD CONSTRAINT `item_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`supplier_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sheet` ADD CONSTRAINT `sheet_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `handle` ADD CONSTRAINT `handle_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hardware` ADD CONSTRAINT `hardware_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `accessory` ADD CONSTRAINT `accessory_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `edging_tape` ADD CONSTRAINT `edging_tape_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_statement` ADD CONSTRAINT `supplier_statement_supplier_file_id_fkey` FOREIGN KEY (`supplier_file_id`) REFERENCES `supplier_file`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `supplier_statement` ADD CONSTRAINT `supplier_statement_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`supplier_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials_to_order` ADD CONSTRAINT `materials_to_order_project_id_fkey` FOREIGN KEY (`project_id`) REFERENCES `project`(`project_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials_to_order` ADD CONSTRAINT `materials_to_order_createdBy_id_fkey` FOREIGN KEY (`createdBy_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials_to_order_item` ADD CONSTRAINT `materials_to_order_item_mto_id_fkey` FOREIGN KEY (`mto_id`) REFERENCES `materials_to_order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materials_to_order_item` ADD CONSTRAINT `materials_to_order_item_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_mto_id_fkey` FOREIGN KEY (`mto_id`) REFERENCES `materials_to_order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_supplier_id_fkey` FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`supplier_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_orderedBy_id_fkey` FOREIGN KEY (`orderedBy_id`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order` ADD CONSTRAINT `purchase_order_invoice_url_id_fkey` FOREIGN KEY (`invoice_url_id`) REFERENCES `supplier_file`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_item` ADD CONSTRAINT `purchase_order_item_order_id_fkey` FOREIGN KEY (`order_id`) REFERENCES `purchase_order`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_item` ADD CONSTRAINT `purchase_order_item_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `purchase_order_item` ADD CONSTRAINT `purchase_order_item_mto_item_id_fkey` FOREIGN KEY (`mto_item_id`) REFERENCES `materials_to_order_item`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transaction` ADD CONSTRAINT `stock_transaction_item_id_fkey` FOREIGN KEY (`item_id`) REFERENCES `item`(`item_id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transaction` ADD CONSTRAINT `stock_transaction_materials_to_order_id_fkey` FOREIGN KEY (`materials_to_order_id`) REFERENCES `materials_to_order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `stock_transaction` ADD CONSTRAINT `stock_transaction_purchase_order_id_fkey` FOREIGN KEY (`purchase_order_id`) REFERENCES `purchase_order`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
