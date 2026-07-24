-- Repair environments where the original lot relation migration was recorded
-- without fully creating the stock_transaction lot relation.

SELECT COUNT(*) INTO @lot_column_exists
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stock_transaction'
  AND COLUMN_NAME = 'lot_id';

SET @add_lot_column_sql = IF(
  @lot_column_exists = 0,
  'ALTER TABLE `stock_transaction` ADD COLUMN `lot_id` VARCHAR(191) NULL',
  'SELECT 1'
);
PREPARE add_lot_column_statement FROM @add_lot_column_sql;
EXECUTE add_lot_column_statement;
DEALLOCATE PREPARE add_lot_column_statement;

SELECT COUNT(*) INTO @lot_index_exists
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stock_transaction'
  AND INDEX_NAME = 'stock_transaction_lot_id_idx';

SET @add_lot_index_sql = IF(
  @lot_index_exists = 0,
  'CREATE INDEX `stock_transaction_lot_id_idx` ON `stock_transaction`(`lot_id`)',
  'SELECT 1'
);
PREPARE add_lot_index_statement FROM @add_lot_index_sql;
EXECUTE add_lot_index_statement;
DEALLOCATE PREPARE add_lot_index_statement;

SELECT COUNT(*) INTO @lot_foreign_key_exists
FROM information_schema.TABLE_CONSTRAINTS
WHERE CONSTRAINT_SCHEMA = DATABASE()
  AND TABLE_NAME = 'stock_transaction'
  AND CONSTRAINT_NAME = 'stock_transaction_lot_id_fkey'
  AND CONSTRAINT_TYPE = 'FOREIGN KEY';

SET @add_lot_foreign_key_sql = IF(
  @lot_foreign_key_exists = 0,
  'ALTER TABLE `stock_transaction` ADD CONSTRAINT `stock_transaction_lot_id_fkey` FOREIGN KEY (`lot_id`) REFERENCES `lot`(`lot_id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1'
);
PREPARE add_lot_foreign_key_statement FROM @add_lot_foreign_key_sql;
EXECUTE add_lot_foreign_key_statement;
DEALLOCATE PREPARE add_lot_foreign_key_statement;
