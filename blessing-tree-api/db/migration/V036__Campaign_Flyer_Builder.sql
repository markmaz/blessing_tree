CREATE TABLE IF NOT EXISTS campaign_flyer (
  id BINARY(16) NOT NULL,
  campaign_id BINARY(16) NOT NULL,
  flyer_key VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  flyer_type ENUM('SPONSOR_RECRUITMENT', 'CUSTOM') NOT NULL DEFAULT 'SPONSOR_RECRUITMENT',
  headline VARCHAR(255) NOT NULL,
  subheadline VARCHAR(500) NULL,
  body_text TEXT NOT NULL,
  call_to_action VARCHAR(255) NOT NULL,
  contact_info VARCHAR(500) NULL,
  qr_target_type ENUM('PUBLIC_SPONSOR_SIGNUP', 'CUSTOM_URL', 'NONE') NOT NULL DEFAULT 'PUBLIC_SPONSOR_SIGNUP',
  qr_custom_url VARCHAR(1024) NULL,
  theme_mode ENUM('CAMPAIGN_PURPOSE', 'BLESSING_TREE', 'CUSTOM', 'NONE') NOT NULL DEFAULT 'CAMPAIGN_PURPOSE',
  image_prompt VARCHAR(500) NULL,
  layout_json JSON NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id BINARY(16) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_campaign_flyer_campaign_key (campaign_id, flyer_key),
  KEY idx_campaign_flyer_campaign (campaign_id),
  KEY idx_campaign_flyer_type (campaign_id, flyer_type),
  KEY idx_campaign_flyer_active (campaign_id, is_active),
  KEY idx_campaign_flyer_created_by (created_by_user_id),
  CONSTRAINT fk_campaign_flyer_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_flyer_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);
