ALTER TABLE recipient_group
    MODIFY COLUMN group_type ENUM('HOUSEHOLD', 'CARE_FACILITY', 'PARTNER_PROGRAM') NOT NULL;

ALTER TABLE recipient
    MODIFY COLUMN program_type ENUM(
        'CHILD_FAMILY',
        'NURSING_HOME',
        'SENIOR_FACILITY',
        'SENIOR_PARTNER_PROGRAM'
    ) NOT NULL;

UPDATE recipient
SET program_type = 'SENIOR_FACILITY'
WHERE program_type = 'NURSING_HOME';

ALTER TABLE recipient
    MODIFY COLUMN program_type ENUM(
        'CHILD_FAMILY',
        'SENIOR_FACILITY',
        'SENIOR_PARTNER_PROGRAM'
    ) NOT NULL;

ALTER TABLE recipient
    ADD COLUMN address_line1 VARCHAR(255) NULL AFTER gender,
    ADD COLUMN address_line2 VARCHAR(255) NULL AFTER address_line1,
    ADD COLUMN city VARCHAR(128) NULL AFTER address_line2,
    ADD COLUMN state VARCHAR(64) NULL AFTER city,
    ADD COLUMN postal_code VARCHAR(32) NULL AFTER state;
