-- Diagnostic-only record of the EAS build that minted a token. Nullable because
-- rows registered by older mobile clients never reported one.
ALTER TABLE `push_tokens` ADD COLUMN `build_profile` VARCHAR(191) NULL;

-- Why a registration was disabled, e.g. 'bad_device_token', 'signed_out'.
ALTER TABLE `push_tokens` ADD COLUMN `disabled_reason` VARCHAR(191) NULL;

-- Time of the most recent permanent delivery error, paired with last_error_code.
ALTER TABLE `push_tokens` ADD COLUMN `last_error_at` DATETIME(3) NULL;

-- Backfill an error timestamp for rows that already carry an error code so the
-- freshness guard in the receipt worker has something to compare against.
UPDATE `push_tokens`
SET `last_error_at` = `updatedAt`
WHERE `last_error_code` IS NOT NULL AND `last_error_at` IS NULL;

-- Existing disabled rows predate disabled_reason; mark them as unknown rather
-- than guessing a cause.
UPDATE `push_tokens`
SET `disabled_reason` = 'unknown'
WHERE `enabled` = 0 AND `disabled_reason` IS NULL;

CREATE INDEX `push_tokens_enabled_build_profile_idx` ON `push_tokens`(`enabled`, `build_profile`);
