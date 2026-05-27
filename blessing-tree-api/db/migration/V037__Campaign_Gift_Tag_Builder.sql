CREATE TABLE IF NOT EXISTS campaign_gift_tag_template (
  id BINARY(16) NOT NULL,
  campaign_id BINARY(16) NOT NULL,
  template_key VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  tag_width_in DECIMAL(4,2) NOT NULL DEFAULT 3.00,
  tag_height_in DECIMAL(4,2) NOT NULL DEFAULT 2.00,
  orientation ENUM('PORTRAIT', 'LANDSCAPE') NOT NULL DEFAULT 'LANDSCAPE',
  layout_json JSON NOT NULL,
  gift_tag_message VARCHAR(500) NULL,
  include_cut_lines_default TINYINT(1) NOT NULL DEFAULT 1,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id BINARY(16) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_campaign_gift_tag_template_campaign_key (campaign_id, template_key),
  KEY idx_campaign_gift_tag_template_campaign (campaign_id),
  KEY idx_campaign_gift_tag_template_active (campaign_id, is_active),
  KEY idx_campaign_gift_tag_template_created_by (created_by_user_id),
  CONSTRAINT fk_campaign_gift_tag_template_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_gift_tag_template_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);
