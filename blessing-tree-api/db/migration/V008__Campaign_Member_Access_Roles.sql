CREATE TABLE IF NOT EXISTS campaign_member_access_role (
  id BINARY(16) NOT NULL PRIMARY KEY,
  campaign_member_id BINARY(16) NOT NULL,
  role_key VARCHAR(64) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_campaign_member_access_role_member
    FOREIGN KEY (campaign_member_id) REFERENCES campaign_member(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_campaign_member_access_role_scope (campaign_member_id, role_key),
  KEY idx_campaign_member_access_role_member (campaign_member_id),
  KEY idx_campaign_member_access_role_role (role_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
