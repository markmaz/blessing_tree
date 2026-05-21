CREATE TABLE IF NOT EXISTS campaign_event (
  id BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id BINARY(16) NOT NULL,
  title VARCHAR(255) NOT NULL,
  event_type ENUM(
    'GENERAL',
    'VOLUNTEER',
    'SPONSOR',
    'DONATION',
    'RECIPIENT',
    'GIFT',
    'PICKUP',
    'COMMUNICATION',
    'MILESTONE'
  ) NOT NULL DEFAULT 'GENERAL',
  start_at DATETIME NOT NULL,
  end_at DATETIME NULL,
  all_day TINYINT(1) NOT NULL DEFAULT 0,
  notes TEXT NULL,
  source_type ENUM('manual','milestone','communication') NOT NULL DEFAULT 'manual',
  source_id BINARY(16) NULL,
  created_by_user_id BINARY(16) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaign_event_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_event_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  KEY idx_campaign_event_campaign_start (campaign_id, start_at),
  KEY idx_campaign_event_campaign_type (campaign_id, event_type),
  KEY idx_campaign_event_campaign_source_type (campaign_id, source_type)
);
