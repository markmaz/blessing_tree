ALTER TABLE recipient_group
  ADD COLUMN program_group_number INT NULL AFTER program_abbreviation,
  ADD COLUMN program_group_id VARCHAR(32) NULL AFTER program_group_number,
  ADD UNIQUE KEY uq_recipient_group_program_group_id (campaign_id, program_group_id),
  ADD KEY idx_recipient_group_program_group_id (campaign_id, program_group_id);
