ALTER TABLE recipient
  ADD COLUMN public_label VARCHAR(255) NULL AFTER display_label;

CREATE TABLE campaign_communication_send (
  id BINARY(16) NOT NULL,
  campaign_id BINARY(16) NOT NULL,
  template_id BINARY(16) NOT NULL,
  target_mode ENUM(
    'CONTEXT_SPONSOR',
    'AUDIENCE',
    'TEAM',
    'SELECTED_SPONSORS',
    'SELECTED_CONTACTS',
    'SELECTED_MEMBERS',
    'MANUAL_EMAIL'
  ) NOT NULL,
  status ENUM('PENDING','SENT','FAILED','PARTIAL') NOT NULL DEFAULT 'PENDING',
  subject VARCHAR(255) NOT NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  delivered_count INT NOT NULL DEFAULT 0,
  failed_count INT NOT NULL DEFAULT 0,
  error_message TEXT NULL,
  created_by_user_id BINARY(16) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campaign_communication_send_campaign (campaign_id),
  KEY idx_campaign_communication_send_template (template_id),
  KEY idx_campaign_communication_send_status (status),
  KEY idx_campaign_communication_send_created (created_at),
  KEY idx_campaign_communication_send_created_by (created_by_user_id),
  CONSTRAINT fk_campaign_communication_send_campaign
    FOREIGN KEY (campaign_id)
    REFERENCES campaign (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_communication_send_template
    FOREIGN KEY (template_id)
    REFERENCES communication_template (id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_communication_send_created_by
    FOREIGN KEY (created_by_user_id)
    REFERENCES app_user (id)
    ON DELETE SET NULL
    ON UPDATE CASCADE
);

CREATE TABLE campaign_communication_send_recipient (
  id BINARY(16) NOT NULL,
  send_id BINARY(16) NOT NULL,
  recipient_type ENUM('SPONSOR','TEAM','MEMBER','CONTACT','MANUAL') NOT NULL,
  recipient_ref_id BINARY(16) NULL,
  email VARCHAR(255) NOT NULL,
  display_name VARCHAR(255) NULL,
  status ENUM('PENDING','SENT','FAILED','PARTIAL') NOT NULL DEFAULT 'PENDING',
  error_message TEXT NULL,
  sent_at DATETIME NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_campaign_communication_send_recipient_send (send_id),
  KEY idx_campaign_communication_send_recipient_ref (recipient_type, recipient_ref_id),
  KEY idx_campaign_communication_send_recipient_status (status),
  CONSTRAINT fk_campaign_communication_send_recipient_send
    FOREIGN KEY (send_id)
    REFERENCES campaign_communication_send (id)
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

INSERT INTO campaign_milestone_definition
  (id, milestone_key, label, description, feature_area, default_sort_order, is_active, is_system)
VALUES
  (
    UUID_TO_BIN('00000000-0000-0000-0000-000000000111', true),
    'gift_turn_in_due',
    'Gift Turn-In Due',
    'Deadline when sponsors should turn in committed gifts.',
    'GIFTS',
    8,
    1,
    1
  )
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  description = VALUES(description),
  feature_area = VALUES(feature_area),
  is_active = VALUES(is_active),
  is_system = VALUES(is_system);
