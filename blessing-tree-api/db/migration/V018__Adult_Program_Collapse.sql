ALTER TABLE recipient_group
    MODIFY COLUMN group_type ENUM(
        'HOUSEHOLD',
        'CARE_FACILITY',
        'PARTNER_PROGRAM',
        'ADULT_PROGRAM'
    ) NOT NULL;

UPDATE recipient_group
SET group_type = 'ADULT_PROGRAM'
WHERE group_type IN ('CARE_FACILITY', 'PARTNER_PROGRAM');

ALTER TABLE recipient_group
    MODIFY COLUMN group_type ENUM(
        'HOUSEHOLD',
        'ADULT_PROGRAM'
    ) NOT NULL;

ALTER TABLE recipient
    MODIFY COLUMN program_type ENUM(
        'CHILD_FAMILY',
        'NURSING_HOME',
        'SENIOR_FACILITY',
        'SENIOR_PARTNER_PROGRAM',
        'ADULT_PROGRAM'
    ) NOT NULL;

UPDATE recipient
SET program_type = 'ADULT_PROGRAM'
WHERE program_type IN ('NURSING_HOME', 'SENIOR_FACILITY', 'SENIOR_PARTNER_PROGRAM');

ALTER TABLE recipient
    MODIFY COLUMN program_type ENUM(
        'CHILD_FAMILY',
        'ADULT_PROGRAM'
    ) NOT NULL;

ALTER TABLE communication_template
    MODIFY COLUMN audience ENUM(
        'SPONSOR',
        'VOLUNTEER',
        'MANAGER',
        'HOUSEHOLD_CONTACT',
        'CARE_FACILITY_CONTACT',
        'ADULT_PROGRAM_CONTACT',
        'GROUP_PRIMARY_CONTACT',
        'ADULT_RECIPIENT_DIRECT',
        'GENERAL'
    ) NOT NULL DEFAULT 'GENERAL';

UPDATE communication_template
SET audience = 'ADULT_PROGRAM_CONTACT'
WHERE audience = 'CARE_FACILITY_CONTACT';

ALTER TABLE communication_template
    MODIFY COLUMN audience ENUM(
        'SPONSOR',
        'VOLUNTEER',
        'MANAGER',
        'HOUSEHOLD_CONTACT',
        'ADULT_PROGRAM_CONTACT',
        'GROUP_PRIMARY_CONTACT',
        'ADULT_RECIPIENT_DIRECT',
        'GENERAL'
    ) NOT NULL DEFAULT 'GENERAL';
