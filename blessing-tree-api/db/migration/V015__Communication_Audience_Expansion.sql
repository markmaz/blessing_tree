ALTER TABLE communication_template
    MODIFY COLUMN audience ENUM(
        'SPONSOR',
        'VOLUNTEER',
        'MANAGER',
        'FAMILY',
        'HOUSEHOLD_CONTACT',
        'CARE_FACILITY_CONTACT',
        'GROUP_PRIMARY_CONTACT',
        'ADULT_RECIPIENT_DIRECT',
        'GENERAL'
    ) NOT NULL DEFAULT 'GENERAL';

UPDATE communication_template
SET audience = 'HOUSEHOLD_CONTACT'
WHERE audience = 'FAMILY';

ALTER TABLE communication_template
    MODIFY COLUMN audience ENUM(
        'SPONSOR',
        'VOLUNTEER',
        'MANAGER',
        'HOUSEHOLD_CONTACT',
        'CARE_FACILITY_CONTACT',
        'GROUP_PRIMARY_CONTACT',
        'ADULT_RECIPIENT_DIRECT',
        'GENERAL'
    ) NOT NULL DEFAULT 'GENERAL';
