ALTER TABLE recipient_group
    MODIFY COLUMN group_type ENUM('HOUSEHOLD', 'INSTITUTION', 'CARE_FACILITY') NOT NULL;

UPDATE recipient_group
SET group_type = 'CARE_FACILITY'
WHERE group_type = 'INSTITUTION';

ALTER TABLE recipient_group
    MODIFY COLUMN group_type ENUM('HOUSEHOLD', 'CARE_FACILITY') NOT NULL;

ALTER TABLE recipient_group
    ADD COLUMN external_reference VARCHAR(255) NULL AFTER intake_source,
    ADD COLUMN status ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE' AFTER notes;

CREATE INDEX idx_recipient_group_status
    ON recipient_group (campaign_id, status);

ALTER TABLE group_contact
    ADD COLUMN relationship_label VARCHAR(255) NULL AFTER contact_role,
    ADD COLUMN can_pick_up TINYINT(1) NOT NULL DEFAULT 0 AFTER is_primary,
    ADD COLUMN is_emergency_contact TINYINT(1) NOT NULL DEFAULT 0 AFTER can_pick_up;

ALTER TABLE recipient
    CHANGE COLUMN recipient_type recipient_kind ENUM('CHILD', 'ADULT', 'SENIOR') NOT NULL;

ALTER TABLE recipient
    ADD COLUMN program_type ENUM('CHILD_FAMILY', 'NURSING_HOME') NULL AFTER recipient_kind,
    ADD COLUMN birth_year INT NULL AFTER last_name,
    ADD COLUMN direct_email VARCHAR(255) NULL AFTER gender,
    ADD COLUMN direct_phone VARCHAR(64) NULL AFTER direct_email,
    ADD COLUMN facility_room VARCHAR(64) NULL AFTER direct_phone,
    ADD COLUMN mobility_notes TEXT NULL AFTER subgroup_label;

UPDATE recipient
SET recipient_kind = 'ADULT'
WHERE recipient_kind = 'SENIOR';

UPDATE recipient
SET program_type = 'CHILD_FAMILY'
WHERE recipient_kind = 'CHILD'
  AND program_type IS NULL;

UPDATE recipient recipient_row
JOIN recipient_group group_row ON group_row.id = recipient_row.recipient_group_id
SET recipient_row.program_type = 'NURSING_HOME'
WHERE recipient_row.recipient_kind = 'ADULT'
  AND group_row.group_type = 'CARE_FACILITY'
  AND recipient_row.program_type IS NULL;

UPDATE recipient recipient_row
JOIN recipient_group group_row ON group_row.id = recipient_row.recipient_group_id
SET recipient_row.program_type = 'CHILD_FAMILY'
WHERE recipient_row.program_type IS NULL;

ALTER TABLE recipient
    MODIFY COLUMN recipient_kind ENUM('CHILD', 'ADULT') NOT NULL,
    MODIFY COLUMN program_type ENUM('CHILD_FAMILY', 'NURSING_HOME') NOT NULL;

DROP INDEX idx_recipient_type ON recipient;

CREATE INDEX idx_recipient_kind
    ON recipient (campaign_id, recipient_kind);

CREATE INDEX idx_recipient_program_type
    ON recipient (campaign_id, program_type);

ALTER TABLE wishlist
    ADD COLUMN wishlist_status ENUM('DRAFT', 'READY', 'LOCKED') NOT NULL DEFAULT 'DRAFT' AFTER recipient_id,
    ADD COLUMN intake_method ENUM('PHONE', 'FORM', 'STAFF_ENTRY', 'IMPORT', 'OTHER') NULL AFTER wishlist_status,
    ADD COLUMN submitted_at DATETIME NULL AFTER intake_method,
    ADD COLUMN intake_completed_by_contact_id BINARY(16) NULL AFTER submitted_at;

UPDATE wishlist
SET wishlist_status = 'READY';

ALTER TABLE wishlist
    ADD CONSTRAINT fk_wishlist_intake_completed_by_contact
        FOREIGN KEY (intake_completed_by_contact_id) REFERENCES group_contact(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;

CREATE INDEX idx_wishlist_status
    ON wishlist (campaign_id, wishlist_status);

ALTER TABLE wishlist_item
    ADD COLUMN item_type ENUM('GIFT', 'CLOTHING', 'ESSENTIAL', 'GIFT_CARD', 'EXPERIENCE', 'OTHER') NULL AFTER category,
    ADD COLUMN do_not_substitute_reason TEXT NULL AFTER allow_substitute,
    ADD COLUMN recipient_note TEXT NULL AFTER do_not_substitute_reason;

UPDATE wishlist_item
SET item_type = 'GIFT'
WHERE item_type IS NULL;

ALTER TABLE wishlist_item
    MODIFY COLUMN item_type ENUM('GIFT', 'CLOTHING', 'ESSENTIAL', 'GIFT_CARD', 'EXPERIENCE', 'OTHER') NOT NULL DEFAULT 'GIFT';
