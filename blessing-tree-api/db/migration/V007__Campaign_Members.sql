CREATE TABLE IF NOT EXISTS campaign_member (
  id BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id BINARY(16) NOT NULL,
  display_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NULL,
  phone VARCHAR(64) NULL,
  notes TEXT NULL,
  member_type ENUM('staff', 'volunteer', 'contact', 'external') NOT NULL DEFAULT 'volunteer',
  app_user_id BINARY(16) NULL,
  app_access_status ENUM('none', 'linked', 'invited', 'active') NOT NULL DEFAULT 'none',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_campaign_member_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_campaign_member_app_user
    FOREIGN KEY (app_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  UNIQUE KEY uq_campaign_member_campaign_app_user (campaign_id, app_user_id),
  KEY idx_campaign_member_campaign (campaign_id),
  KEY idx_campaign_member_email (email),
  KEY idx_campaign_member_active (campaign_id, is_active),
  KEY idx_campaign_member_app_user (app_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
