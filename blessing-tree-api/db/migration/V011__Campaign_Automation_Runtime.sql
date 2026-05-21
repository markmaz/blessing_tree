ALTER TABLE campaign_communication_schedule
  ADD COLUMN last_attempted_at DATETIME NULL AFTER notes,
  ADD COLUMN last_dispatched_at DATETIME NULL AFTER last_attempted_at,
  ADD COLUMN delivery_attempt_count INT NOT NULL DEFAULT 0 AFTER last_dispatched_at,
  ADD COLUMN last_delivery_status ENUM('SENT', 'FAILED', 'SKIPPED') NULL AFTER delivery_attempt_count,
  ADD COLUMN last_delivery_error TEXT NULL AFTER last_delivery_status,
  ADD KEY idx_campaign_communication_schedule_last_delivery_status (last_delivery_status);

CREATE TABLE IF NOT EXISTS campaign_automation_execution (
  id BINARY(16) NOT NULL,
  campaign_id BINARY(16) NOT NULL,
  schedule_id BINARY(16) NULL,
  execution_type ENUM('COMMUNICATION_DISPATCH', 'LIFECYCLE_TRANSITION') NOT NULL,
  action_key VARCHAR(64) NOT NULL,
  status ENUM('STARTED', 'SUCCEEDED', 'FAILED', 'SKIPPED', 'BLOCKED') NOT NULL DEFAULT 'STARTED',
  recipient_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  details_json TEXT NULL,
  error_message TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at DATETIME NULL,
  PRIMARY KEY (id),
  CONSTRAINT fk_campaign_automation_execution_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_automation_execution_schedule
    FOREIGN KEY (schedule_id) REFERENCES campaign_communication_schedule(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_campaign_automation_execution_campaign (campaign_id),
  KEY idx_campaign_automation_execution_schedule (schedule_id),
  KEY idx_campaign_automation_execution_type (execution_type),
  KEY idx_campaign_automation_execution_status (status),
  KEY idx_campaign_automation_execution_created (created_at)
);
