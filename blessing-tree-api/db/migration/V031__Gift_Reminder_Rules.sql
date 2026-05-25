CREATE TABLE campaign_gift_reminder_rule (
    id BINARY(16) NOT NULL,
    campaign_id BINARY(16) NOT NULL,
    rule_key VARCHAR(100) NOT NULL,
    label VARCHAR(255) NOT NULL,
    is_enabled TINYINT(1) NOT NULL DEFAULT 1,
    audience ENUM(
        'SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS',
        'SPONSORS_WITH_OVERDUE_GIFTS',
        'SPONSORS_WITH_RECEIVED_GIFTS'
    ) NOT NULL,
    milestone_key VARCHAR(100) NULL,
    offset_days INT NOT NULL DEFAULT 0,
    send_time_local VARCHAR(5) NOT NULL DEFAULT '09:00',
    template_id BINARY(16) NULL,
    channel ENUM('EMAIL') NOT NULL DEFAULT 'EMAIL',
    suppress_if_all_received TINYINT(1) NOT NULL DEFAULT 1,
    last_evaluated_at DATETIME NULL,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_campaign_gift_reminder_rule_key (campaign_id, rule_key),
    KEY idx_campaign_gift_reminder_campaign (campaign_id),
    KEY idx_campaign_gift_reminder_enabled (campaign_id, is_enabled),
    KEY idx_campaign_gift_reminder_template (template_id),
    CONSTRAINT fk_campaign_gift_reminder_campaign
        FOREIGN KEY (campaign_id) REFERENCES campaign(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE,
    CONSTRAINT fk_campaign_gift_reminder_template
        FOREIGN KEY (template_id) REFERENCES communication_template(id)
        ON DELETE SET NULL
        ON UPDATE CASCADE
);
