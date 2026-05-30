CREATE TABLE audit_event (
  id BINARY(16) NOT NULL,
  occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id BINARY(16) NULL,
  actor_display_name VARCHAR(255) NULL,
  actor_email VARCHAR(255) NULL,
  campaign_id BINARY(16) NULL,
  area VARCHAR(64) NOT NULL,
  action VARCHAR(64) NOT NULL,
  entity_type VARCHAR(96) NOT NULL,
  entity_id BINARY(16) NULL,
  entity_label VARCHAR(255) NULL,
  summary VARCHAR(500) NOT NULL,
  change_set_json JSON NULL,
  metadata_json JSON NULL,
  correlation_id VARCHAR(64) NULL,
  ip_address VARCHAR(255) NULL,
  user_agent VARCHAR(500) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_audit_event_occurred (occurred_at),
  KEY idx_audit_event_campaign_occurred (campaign_id, occurred_at),
  KEY idx_audit_event_actor_occurred (actor_user_id, occurred_at),
  KEY idx_audit_event_area_occurred (area, occurred_at),
  KEY idx_audit_event_action_occurred (action, occurred_at),
  KEY idx_audit_event_entity (entity_type, entity_id),
  CONSTRAINT fk_audit_event_actor
    FOREIGN KEY (actor_user_id)
    REFERENCES app_user (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE,
  CONSTRAINT fk_audit_event_campaign
    FOREIGN KEY (campaign_id)
    REFERENCES campaign (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);
