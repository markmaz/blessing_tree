ALTER TABLE organization_type
  MODIFY COLUMN recipient_category ENUM('CHILD', 'ADULT', 'FAMILY') NOT NULL DEFAULT 'ADULT';
