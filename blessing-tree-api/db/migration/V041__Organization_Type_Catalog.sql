CREATE TABLE organization_type (
  id BINARY(16) NOT NULL,
  code VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  recipient_category ENUM('CHILD', 'ADULT', 'FAMILY') NOT NULL DEFAULT 'ADULT',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 100,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT uq_organization_type_code UNIQUE (code),
  INDEX idx_organization_type_active_sort (is_active, sort_order, label)
);

INSERT INTO organization_type (
  id,
  code,
  label,
  recipient_category,
  is_active,
  sort_order,
  created_at,
  updated_at
) VALUES
  (UUID_TO_BIN(UUID(), TRUE), 'NURSING_HOME', 'Nursing Home', 'ADULT', 1, 10, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (UUID_TO_BIN(UUID(), TRUE), 'MH_CLIENTS', 'MH Clients', 'ADULT', 1, 20, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (UUID_TO_BIN(UUID(), TRUE), 'FOSTER_CARE', 'Foster Care', 'FAMILY', 1, 30, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (UUID_TO_BIN(UUID(), TRUE), 'FAMILY_SERVICES', 'Family Services', 'FAMILY', 1, 40, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (UUID_TO_BIN(UUID(), TRUE), 'CHILDRENS_HOME', 'Children''s Home', 'CHILD', 1, 50, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (UUID_TO_BIN(UUID(), TRUE), 'OTHER', 'Other', 'ADULT', 1, 100, UTC_TIMESTAMP(), UTC_TIMESTAMP());

ALTER TABLE recipient_group
  MODIFY COLUMN organization_type VARCHAR(64) NULL;
