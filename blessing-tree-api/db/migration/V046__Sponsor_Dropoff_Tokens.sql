CREATE TABLE sponsor_dropoff_token (
  id BINARY(16) NOT NULL,
  campaign_id BINARY(16) NOT NULL,
  sponsorship_id BINARY(16) NOT NULL,
  sponsor_id BINARY(16) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  last_scanned_at DATETIME NULL,
  created_by_user_id BINARY(16) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_sponsor_dropoff_token_hash (token_hash),
  KEY idx_sponsor_dropoff_token_campaign (campaign_id),
  KEY idx_sponsor_dropoff_token_sponsorship (sponsorship_id),
  KEY idx_sponsor_dropoff_token_sponsor (sponsor_id),
  KEY idx_sponsor_dropoff_token_expires (expires_at),
  CONSTRAINT fk_sponsor_dropoff_token_campaign
    FOREIGN KEY (campaign_id)
    REFERENCES campaign (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sponsor_dropoff_token_sponsorship
    FOREIGN KEY (sponsorship_id)
    REFERENCES sponsorship (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sponsor_dropoff_token_sponsor
    FOREIGN KEY (sponsor_id)
    REFERENCES sponsor (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sponsor_dropoff_token_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES app_user (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
