ALTER TABLE sponsor
  ADD COLUMN first_name VARCHAR(128) NULL AFTER id,
  ADD COLUMN last_name VARCHAR(128) NULL AFTER first_name,
  ADD COLUMN address_line1 VARCHAR(255) NULL AFTER phone,
  ADD COLUMN address_line2 VARCHAR(255) NULL AFTER address_line1,
  ADD COLUMN city VARCHAR(128) NULL AFTER address_line2,
  ADD COLUMN state VARCHAR(64) NULL AFTER city,
  ADD COLUMN postal_code VARCHAR(32) NULL AFTER state,
  ADD COLUMN source ENUM('STAFF_ENTRY','PUBLIC_QR','PUBLIC_LINK','IMPORT','OTHER') NOT NULL DEFAULT 'STAFF_ENTRY' AFTER preferred_contact,
  ADD COLUMN source_detail VARCHAR(255) NULL AFTER source,
  ADD COLUMN self_registered_at TIMESTAMP NULL AFTER is_active,
  ADD COLUMN last_contacted_at TIMESTAMP NULL AFTER self_registered_at,
  ADD COLUMN do_not_contact TINYINT(1) NOT NULL DEFAULT 0 AFTER last_contacted_at;

ALTER TABLE sponsorship
  ADD COLUMN sponsor_code VARCHAR(64) NULL AFTER sponsor_id,
  ADD COLUMN interest_status ENUM('NEW','CONTACTED','RESPONDED','COMMITTED','DECLINED') NOT NULL DEFAULT 'NEW' AFTER status,
  ADD COLUMN drop_off_status ENUM('NOT_STARTED','SCHEDULED','RECEIVED','LATE') NOT NULL DEFAULT 'NOT_STARTED' AFTER interest_status,
  ADD COLUMN drop_off_due_at TIMESTAMP NULL AFTER drop_off_status,
  ADD COLUMN drop_off_completed_at TIMESTAMP NULL AFTER drop_off_due_at,
  ADD COLUMN self_registered TINYINT(1) NOT NULL DEFAULT 0 AFTER drop_off_completed_at;

ALTER TABLE sponsorship
  ADD UNIQUE KEY uq_sponsorship_campaign_sponsor (campaign_id, sponsor_id);

ALTER TABLE sponsor_interaction
  ADD COLUMN origin_type ENUM('MANUAL','CAMPAIGN_COMMUNICATION','PUBLIC_SIGNUP','SYSTEM') NOT NULL DEFAULT 'MANUAL' AFTER subject,
  ADD COLUMN related_schedule_id BINARY(16) NULL AFTER related_sponsorship_id,
  ADD COLUMN related_delivery_attempt_id VARCHAR(255) NULL AFTER related_schedule_id,
  ADD COLUMN external_message_id VARCHAR(255) NULL AFTER related_delivery_attempt_id,
  ADD KEY idx_sponsor_interaction_schedule (related_schedule_id);

CREATE TABLE pending_sponsor_registration (
  id                        BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id               BINARY(16) NOT NULL,
  matched_sponsor_id        BINARY(16) NULL,
  email                     VARCHAR(255) NOT NULL,
  first_name                VARCHAR(128) NULL,
  last_name                 VARCHAR(128) NULL,
  display_name              VARCHAR(255) NULL,
  organization_name         VARCHAR(255) NULL,
  phone                     VARCHAR(64) NULL,
  preferred_contact         ENUM('EMAIL','PHONE','TEXT','NONE') NOT NULL DEFAULT 'EMAIL',
  address_line1             VARCHAR(255) NULL,
  address_line2             VARCHAR(255) NULL,
  city                      VARCHAR(128) NULL,
  state                     VARCHAR(64) NULL,
  postal_code               VARCHAR(32) NULL,
  source                    ENUM('STAFF_ENTRY','PUBLIC_QR','PUBLIC_LINK','IMPORT','OTHER') NOT NULL DEFAULT 'PUBLIC_LINK',
  selected_wishlist_item_ids_json JSON NOT NULL,
  notes                     TEXT NULL,
  verification_token        VARCHAR(255) NOT NULL,
  verification_sent_at      TIMESTAMP NULL,
  verified_at               TIMESTAMP NULL,
  expires_at                TIMESTAMP NOT NULL,
  status                    ENUM('PENDING','VERIFIED','EXPIRED','CANCELLED') NOT NULL DEFAULT 'PENDING',
  submitted_ip              VARCHAR(64) NULL,
  user_agent                VARCHAR(512) NULL,
  created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_pending_sponsor_registration_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_pending_sponsor_registration_sponsor
    FOREIGN KEY (matched_sponsor_id) REFERENCES sponsor(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  UNIQUE KEY uq_pending_sponsor_registration_token (verification_token),
  KEY idx_pending_sponsor_registration_campaign_status (campaign_id, status),
  KEY idx_pending_sponsor_registration_campaign_email (campaign_id, email),
  KEY idx_pending_sponsor_registration_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
