CREATE TABLE sponsor_dropoff_scan_event (
  id BINARY(16) NOT NULL,
  token_id BINARY(16) NOT NULL,
  campaign_id BINARY(16) NOT NULL,
  sponsorship_id BINARY(16) NOT NULL,
  sponsor_id BINARY(16) NOT NULL,
  scanned_by_user_id BINARY(16) NULL,
  scanned_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  outcome VARCHAR(32) NOT NULL,
  user_agent VARCHAR(512) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_sponsor_dropoff_scan_event_token (token_id),
  KEY idx_sponsor_dropoff_scan_event_campaign (campaign_id),
  KEY idx_sponsor_dropoff_scan_event_sponsor (sponsor_id),
  KEY idx_sponsor_dropoff_scan_event_scanned_at (scanned_at),
  CONSTRAINT fk_sponsor_dropoff_scan_event_token
    FOREIGN KEY (token_id)
    REFERENCES sponsor_dropoff_token (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sponsor_dropoff_scan_event_campaign
    FOREIGN KEY (campaign_id)
    REFERENCES campaign (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sponsor_dropoff_scan_event_sponsorship
    FOREIGN KEY (sponsorship_id)
    REFERENCES sponsorship (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sponsor_dropoff_scan_event_sponsor
    FOREIGN KEY (sponsor_id)
    REFERENCES sponsor (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_sponsor_dropoff_scan_event_scanned_by
    FOREIGN KEY (scanned_by_user_id)
    REFERENCES app_user (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
