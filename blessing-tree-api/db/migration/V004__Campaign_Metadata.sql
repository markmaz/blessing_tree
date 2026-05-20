SET @drop_year_unique := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'campaign'
        AND index_name = 'uq_campaign_year'
        AND non_unique = 0
    ),
    'ALTER TABLE campaign DROP INDEX uq_campaign_year',
    'SELECT 1'
  )
);
PREPARE stmt FROM @drop_year_unique;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_description := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = DATABASE()
        AND table_name = 'campaign'
        AND column_name = 'description'
    ),
    'SELECT 1',
    'ALTER TABLE campaign ADD COLUMN description TEXT NULL AFTER name'
  )
);
PREPARE stmt FROM @add_description;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @add_year_index := (
  SELECT IF(
    EXISTS(
      SELECT 1
      FROM information_schema.statistics
      WHERE table_schema = DATABASE()
        AND table_name = 'campaign'
        AND index_name = 'idx_campaign_year'
    ),
    'SELECT 1',
    'ALTER TABLE campaign ADD INDEX idx_campaign_year (year)'
  )
);
PREPARE stmt FROM @add_year_index;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
