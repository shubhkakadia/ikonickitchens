-- AlterTable
ALTER TABLE `accessory` MODIFY `name` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `edging_tape` MODIFY `brand` VARCHAR(191) NULL,
    MODIFY `color` VARCHAR(191) NULL,
    MODIFY `finish` VARCHAR(191) NULL,
    MODIFY `dimensions` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `handle` MODIFY `brand` VARCHAR(191) NULL,
    MODIFY `color` VARCHAR(191) NULL,
    MODIFY `type` VARCHAR(191) NULL,
    MODIFY `dimensions` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `hardware` MODIFY `brand` VARCHAR(191) NULL,
    MODIFY `name` VARCHAR(191) NULL,
    MODIFY `type` VARCHAR(191) NULL,
    MODIFY `dimensions` VARCHAR(191) NULL,
    MODIFY `sub_category` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `sheet` MODIFY `brand` VARCHAR(191) NULL,
    MODIFY `color` VARCHAR(191) NULL,
    MODIFY `finish` VARCHAR(191) NULL;
