ALTER TABLE ask_prompt_log
    ADD COLUMN reviewed_at DATETIME NULL AFTER feedback_at,
    ADD COLUMN reviewed_by_user_id BINARY(16) NULL AFTER reviewed_at,
    ADD COLUMN review_note TEXT NULL AFTER reviewed_by_user_id,
    ADD KEY idx_ask_prompt_log_reviewed (campaign_id, reviewed_at),
    ADD KEY idx_ask_prompt_log_reviewed_by (reviewed_by_user_id),
    ADD CONSTRAINT fk_ask_prompt_log_reviewed_by
        FOREIGN KEY (reviewed_by_user_id) REFERENCES app_user(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE;
