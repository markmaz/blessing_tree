-- Add auth identities and last login timestamp

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

ALTER TABLE app_user
  ADD COLUMN last_login_at TIMESTAMP NULL AFTER is_active;

CREATE TABLE auth_identity (
  id            BINARY(16) NOT NULL PRIMARY KEY,
  user_id       BINARY(16) NOT NULL,
  provider      ENUM('GOOGLE','YAHOO','LOCAL') NOT NULL,
  provider_sub  VARCHAR(128) NULL,
  email         VARCHAR(255) NULL,
  password_hash VARCHAR(255) NULL,
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_auth_identity_user
    FOREIGN KEY (user_id) REFERENCES app_user(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_auth_identity_provider_sub (provider, provider_sub),
  UNIQUE KEY uq_auth_identity_provider_email (provider, email),
  KEY idx_auth_identity_user (user_id),
  KEY idx_auth_identity_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;
