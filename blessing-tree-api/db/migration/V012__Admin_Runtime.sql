CREATE TABLE admin_user_invitation (
  id BINARY(16) NOT NULL,
  user_id BINARY(16) NOT NULL,
  email VARCHAR(255) NOT NULL,
  invited_by_user_id BINARY(16) NULL,
  expires_at DATETIME NOT NULL,
  accepted_at DATETIME NULL,
  revoked_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_admin_user_invitation_user (user_id),
  KEY idx_admin_user_invitation_email (email),
  KEY idx_admin_user_invitation_invited_by (invited_by_user_id),
  KEY idx_admin_user_invitation_expires (expires_at),
  KEY idx_admin_user_invitation_accepted (accepted_at),
  KEY idx_admin_user_invitation_revoked (revoked_at),
  CONSTRAINT fk_admin_user_invitation_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_admin_user_invitation_invited_by
    FOREIGN KEY (invited_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE admin_llm_configuration (
  id BINARY(16) NOT NULL,
  provider ENUM('OPENAI_COMPATIBLE', 'OPENAI') NOT NULL DEFAULT 'OPENAI_COMPATIBLE',
  label VARCHAR(120) NOT NULL,
  base_url VARCHAR(512) NOT NULL,
  model VARCHAR(255) NOT NULL,
  api_key_encrypted TEXT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  last_tested_at DATETIME NULL,
  last_test_status VARCHAR(32) NULL,
  last_test_message VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
);

CREATE TABLE app_feature_flag (
  feature_key VARCHAR(64) NOT NULL,
  label VARCHAR(120) NOT NULL,
  description TEXT NOT NULL,
  is_enabled TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (feature_key)
);
