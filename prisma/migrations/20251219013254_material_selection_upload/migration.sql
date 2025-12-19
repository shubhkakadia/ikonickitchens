-- AlterTable
ALTER TABLE `media` ADD COLUMN `material_selection_id` VARCHAR(191) NULL;

-- CreateIndex
CREATE INDEX `media_material_selection_id_fkey` ON `media`(`material_selection_id`);

-- AddForeignKey
ALTER TABLE `media` ADD CONSTRAINT `media_material_selection_id_fkey` FOREIGN KEY (`material_selection_id`) REFERENCES `material_selection`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
