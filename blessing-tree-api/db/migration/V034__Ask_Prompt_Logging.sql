CREATE TABLE ask_prompt_log (
    id BINARY(16) NOT NULL,
    campaign_id BINARY(16) NOT NULL,
    user_id BINARY(16) NULL,
    prompt TEXT NOT NULL,
    result_kind VARCHAR(64) NOT NULL,
    result_key VARCHAR(128) NULL,
    confidence DOUBLE NULL,
    source VARCHAR(64) NULL,
    response_summary_json JSON NULL,
    feedback_rating ENUM('POSITIVE', 'NEGATIVE') NULL,
    feedback_comment TEXT NULL,
    feedback_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    KEY idx_ask_prompt_log_campaign_created (campaign_id, created_at),
    KEY idx_ask_prompt_log_user (user_id),
    KEY idx_ask_prompt_log_result (campaign_id, result_kind, result_key),
    KEY idx_ask_prompt_log_feedback (campaign_id, feedback_rating),
    CONSTRAINT fk_ask_prompt_log_campaign
        FOREIGN KEY (campaign_id) REFERENCES campaign(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_ask_prompt_log_user
        FOREIGN KEY (user_id) REFERENCES app_user(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);
