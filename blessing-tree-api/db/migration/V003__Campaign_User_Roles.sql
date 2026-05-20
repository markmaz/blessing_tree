CREATE TABLE IF NOT EXISTS campaign_user_role (
  id BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  role_key VARCHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_campaign_user_role_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_campaign_user_role_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_campaign_user_role_scope (campaign_id, user_id, role_key),
  KEY idx_campaign_user_role_scope (campaign_id, user_id),
  KEY idx_campaign_user_role_role (campaign_id, role_key),
  KEY idx_campaign_user_role_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
