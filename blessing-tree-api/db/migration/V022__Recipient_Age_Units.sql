ALTER TABLE recipient
  ADD COLUMN age_unit ENUM('MONTHS', 'YEARS') NULL AFTER age;

UPDATE recipient
SET age_unit = 'YEARS'
WHERE age IS NOT NULL
  AND age_unit IS NULL;
