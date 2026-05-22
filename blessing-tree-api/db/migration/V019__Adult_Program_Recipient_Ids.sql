ALTER TABLE recipient_group
    ADD COLUMN program_abbreviation VARCHAR(16) NULL AFTER group_name;

WITH ranked_groups AS (
    SELECT
        id,
        campaign_id,
        COALESCE(
            NULLIF(LEFT(REGEXP_REPLACE(UPPER(group_name), '[^A-Z0-9]', ''), 12), ''),
            'ADULT'
        ) AS base_abbreviation,
        ROW_NUMBER() OVER (
            PARTITION BY campaign_id, COALESCE(NULLIF(LEFT(REGEXP_REPLACE(UPPER(group_name), '[^A-Z0-9]', ''), 12), ''), 'ADULT')
            ORDER BY created_at, id
        ) AS duplicate_sequence
    FROM recipient_group
    WHERE group_type = 'ADULT_PROGRAM'
)
UPDATE recipient_group AS recipient_group_table
JOIN ranked_groups ON ranked_groups.id = recipient_group_table.id
SET recipient_group_table.program_abbreviation = CASE
    WHEN ranked_groups.duplicate_sequence = 1 THEN ranked_groups.base_abbreviation
    ELSE LEFT(
        CONCAT(
            LEFT(
                ranked_groups.base_abbreviation,
                GREATEST(12 - CHAR_LENGTH(CAST(ranked_groups.duplicate_sequence AS CHAR)), 1)
            ),
            CAST(ranked_groups.duplicate_sequence AS CHAR)
        ),
        12
    )
END;

ALTER TABLE recipient_group
    ADD UNIQUE KEY uq_recipient_group_program_abbreviation (campaign_id, program_abbreviation),
    ADD KEY idx_recipient_group_program_abbreviation (campaign_id, program_abbreviation);

ALTER TABLE recipient
    ADD COLUMN program_recipient_number INT NULL AFTER display_label,
    ADD COLUMN program_recipient_id VARCHAR(32) NULL AFTER program_recipient_number;

WITH ranked_recipients AS (
    SELECT
        recipient.id,
        recipient.recipient_group_id,
        recipient_group.program_abbreviation,
        ROW_NUMBER() OVER (
            PARTITION BY recipient.recipient_group_id
            ORDER BY recipient.created_at, recipient.id
        ) AS recipient_sequence
    FROM recipient
    JOIN recipient_group ON recipient_group.id = recipient.recipient_group_id
    WHERE recipient_group.group_type = 'ADULT_PROGRAM'
      AND recipient.recipient_kind = 'ADULT'
)
UPDATE recipient AS recipient_table
JOIN ranked_recipients ON ranked_recipients.id = recipient_table.id
SET
    recipient_table.program_recipient_number = ranked_recipients.recipient_sequence,
    recipient_table.program_recipient_id = CONCAT(
        ranked_recipients.program_abbreviation,
        '-',
        LPAD(ranked_recipients.recipient_sequence, 3, '0')
    );

ALTER TABLE recipient
    ADD UNIQUE KEY uq_recipient_program_id (campaign_id, program_recipient_id),
    ADD KEY idx_recipient_program_id (campaign_id, program_recipient_id);
