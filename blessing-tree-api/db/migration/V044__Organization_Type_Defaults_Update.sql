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
  (UUID_TO_BIN(UUID(), TRUE), 'MH_CLIENTS', 'MH Clients', 'ADULT', 1, 20, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (UUID_TO_BIN(UUID(), TRUE), 'FOSTER_CARE', 'Foster Care', 'FAMILY', 1, 30, UTC_TIMESTAMP(), UTC_TIMESTAMP()),
  (UUID_TO_BIN(UUID(), TRUE), 'FAMILY_SERVICES', 'Family Services', 'FAMILY', 1, 40, UTC_TIMESTAMP(), UTC_TIMESTAMP())
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  recipient_category = VALUES(recipient_category),
  is_active = VALUES(is_active),
  sort_order = VALUES(sort_order),
  updated_at = UTC_TIMESTAMP();

UPDATE organization_type
SET sort_order = 10,
    recipient_category = 'ADULT',
    is_active = 1,
    updated_at = UTC_TIMESTAMP()
WHERE code = 'NURSING_HOME';

UPDATE organization_type
SET sort_order = 50,
    recipient_category = 'CHILD',
    is_active = 1,
    updated_at = UTC_TIMESTAMP()
WHERE code = 'CHILDRENS_HOME';

UPDATE organization_type
SET sort_order = 100,
    recipient_category = 'ADULT',
    is_active = 1,
    updated_at = UTC_TIMESTAMP()
WHERE code = 'OTHER';

UPDATE organization_type
SET is_active = 0,
    updated_at = UTC_TIMESTAMP()
WHERE code IN ('ORPHANAGE', 'PARTNER_ORG', 'SENIOR_PROGRAM');
