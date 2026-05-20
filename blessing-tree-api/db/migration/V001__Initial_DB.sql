-- Blessing Tree (MySQL 8+) - Drop-in DDL (BINARY(16) UUIDs everywhere)
-- Includes: recipient grouping (households + institutions), item-by-item sponsorship,
-- option B donations (donation -> lines -> fulfillment), label printing + QR lookup,
-- pickup tracking, sponsor call/reminder log, audit + scan events.
--
-- ✅ UUID STORAGE STRATEGY
-- Store UUIDs as BINARY(16) using MySQL's optimized byte order:
--   INSERT: UUID_TO_BIN(UUID(), true)
--   Bind:   UUID_TO_BIN(:uuid_string, true)
--   Read:   BIN_TO_UUID(id, true)
--
-- ✅ label_code
-- label_code is a human/QR-facing lookup key and is enforced globally unique
-- (simplifies scan lookup and avoids cross-campaign ambiguity).

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================
-- Drop in reverse dependency order
-- ============================================================
DROP TABLE IF EXISTS scan_event;
DROP TABLE IF EXISTS item_event;
DROP TABLE IF EXISTS sponsor_reminder;
DROP TABLE IF EXISTS sponsor_interaction;
DROP TABLE IF EXISTS label_print_item;
DROP TABLE IF EXISTS label_print_job;
DROP TABLE IF EXISTS pickup_item;
DROP TABLE IF EXISTS pickup;
DROP TABLE IF EXISTS fulfillment;
DROP TABLE IF EXISTS donation_line;
DROP TABLE IF EXISTS donation;
DROP TABLE IF EXISTS sponsorship_item;
DROP TABLE IF EXISTS sponsorship;
DROP TABLE IF EXISTS sponsor;
DROP TABLE IF EXISTS wishlist_item;
DROP TABLE IF EXISTS wishlist;
DROP TABLE IF EXISTS recipient;
DROP TABLE IF EXISTS group_contact;
DROP TABLE IF EXISTS recipient_group;
DROP TABLE IF EXISTS storage_location;
DROP TABLE IF EXISTS campaign;
DROP TABLE IF EXISTS app_user;

DROP TABLE IF EXISTS __ddl_lock;

-- ============================================================
-- Optional lock table (handy for migrations / sanity checks)
-- ============================================================
CREATE TABLE __ddl_lock (
  id TINYINT NOT NULL PRIMARY KEY,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- ============================================================
-- 0) Users (church staff / volunteers)
-- ============================================================
CREATE TABLE app_user (
  id            BINARY(16) NOT NULL PRIMARY KEY,
  email         VARCHAR(255) NOT NULL,
  display_name  VARCHAR(255) NOT NULL,
  role          ENUM('ADMIN','COORDINATOR','VOLUNTEER') NOT NULL DEFAULT 'VOLUNTEER',
  is_active     TINYINT(1) NOT NULL DEFAULT 1,
  created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_app_user_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 1) Campaign / season
-- ============================================================
CREATE TABLE campaign (
  id          BINARY(16) NOT NULL PRIMARY KEY,
  name        VARCHAR(255) NOT NULL,
  year        INT NOT NULL,
  start_date  DATE NULL,
  end_date    DATE NULL,
  status      ENUM('DRAFT','ACTIVE','CLOSED','ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_campaign_year (year),
  KEY idx_campaign_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 2) Storage locations (bins/rooms/shelves)
-- ============================================================
CREATE TABLE storage_location (
  id          BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id BINARY(16) NOT NULL,
  code        VARCHAR(64) NOT NULL,
  name        VARCHAR(255) NOT NULL,
  notes       TEXT NULL,
  is_active   TINYINT(1) NOT NULL DEFAULT 1,
  created_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_storage_location_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_storage_location_campaign_code (campaign_id, code),
  KEY idx_storage_location_campaign (campaign_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 3) Recipient grouping (Households + Institutions)
-- ============================================================
CREATE TABLE recipient_group (
  id             BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id    BINARY(16) NOT NULL,
  group_type     ENUM('HOUSEHOLD','INSTITUTION') NOT NULL,
  group_name     VARCHAR(255) NOT NULL,
  intake_source  VARCHAR(255) NULL,
  notes          TEXT NULL,

  address_line1  VARCHAR(255) NULL,
  address_line2  VARCHAR(255) NULL,
  city           VARCHAR(128) NULL,
  state          VARCHAR(64) NULL,
  postal_code    VARCHAR(32) NULL,

  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_recipient_group_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  KEY idx_recipient_group_campaign (campaign_id),
  KEY idx_recipient_group_type (campaign_id, group_type),
  KEY idx_recipient_group_name (campaign_id, group_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE group_contact (
  id                 BINARY(16) NOT NULL PRIMARY KEY,
  recipient_group_id BINARY(16) NOT NULL,

  contact_role       ENUM('PARENT','GUARDIAN','COORDINATOR','SOCIAL_WORKER','STAFF','OTHER') NOT NULL DEFAULT 'OTHER',
  first_name         VARCHAR(128) NULL,
  last_name          VARCHAR(128) NULL,
  email              VARCHAR(255) NULL,
  phone              VARCHAR(64) NULL,
  preferred_contact  ENUM('EMAIL','PHONE','TEXT','NONE') NOT NULL DEFAULT 'NONE',
  is_primary         TINYINT(1) NOT NULL DEFAULT 0,
  notes              TEXT NULL,

  created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_group_contact_group
    FOREIGN KEY (recipient_group_id) REFERENCES recipient_group(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  KEY idx_group_contact_group (recipient_group_id),
  KEY idx_group_contact_primary (recipient_group_id, is_primary),
  KEY idx_group_contact_email (email),
  KEY idx_group_contact_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE recipient (
  id                 BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id         BINARY(16) NOT NULL,
  recipient_group_id  BINARY(16) NOT NULL,

  recipient_type      ENUM('CHILD','ADULT','SENIOR') NOT NULL,
  privacy_level       ENUM('ANONYMOUS','INITIALS','FULL_NAME') NOT NULL DEFAULT 'ANONYMOUS',

  display_label       VARCHAR(255) NOT NULL,
  first_name          VARCHAR(128) NULL,
  last_name           VARCHAR(128) NULL,
  age                 INT NULL,
  gender              ENUM('M','F','X','U') NULL,

  subgroup_label      VARCHAR(255) NULL,
  notes               TEXT NULL,
  status              ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE',

  created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_recipient_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_recipient_group
    FOREIGN KEY (recipient_group_id) REFERENCES recipient_group(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_recipient_label (campaign_id, recipient_group_id, display_label),
  KEY idx_recipient_group (recipient_group_id),
  KEY idx_recipient_campaign (campaign_id),
  KEY idx_recipient_type (campaign_id, recipient_type),
  KEY idx_recipient_status (campaign_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 4) Wishlist (requested items)
-- ============================================================
CREATE TABLE wishlist (
  id           BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id  BINARY(16) NOT NULL,
  recipient_id BINARY(16) NOT NULL,
  notes        TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_wishlist_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_wishlist_recipient
    FOREIGN KEY (recipient_id) REFERENCES recipient(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_wishlist_per_recipient (campaign_id, recipient_id),
  KEY idx_wishlist_campaign (campaign_id),
  KEY idx_wishlist_recipient (recipient_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE wishlist_item (
  id            BINARY(16) NOT NULL PRIMARY KEY,
  wishlist_id   BINARY(16) NOT NULL,

  category      VARCHAR(64) NULL,
  description   VARCHAR(512) NOT NULL,
  size          VARCHAR(64) NULL,
  qty_requested INT NOT NULL DEFAULT 1,
  priority      ENUM('LOW','MEDIUM','HIGH') NOT NULL DEFAULT 'MEDIUM',
  est_cost_cents INT NULL,
  allow_substitute TINYint(1) NOT NULL DEFAULT 1,

  status        ENUM('OPEN','COMMITTED','RECEIVED','WRAPPED','PICKED_UP','CANCELLED') NOT NULL DEFAULT 'OPEN',
  qty_fulfilled INT NOT NULL DEFAULT 0,

  storage_location_id BINARY(16) NULL,

  received_at   TIMESTAMP NULL,
  received_by_user_id BINARY(16) NULL,

  wrapped_at    TIMESTAMP NULL,
  wrapped_by_user_id  BINARY(16) NULL,

  picked_up_at  TIMESTAMP NULL,
  picked_up_by_contact_id BINARY(16) NULL,
  picked_up_verified_by_user_id BINARY(16) NULL,

  label_code    VARCHAR(64) NOT NULL,
  label_version INT NOT NULL DEFAULT 1,
  label_last_printed_at TIMESTAMP NULL,
  label_last_printed_by_user_id BINARY(16) NULL,

  notes        TEXT NULL,
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_wishlist_item_wishlist
    FOREIGN KEY (wishlist_id) REFERENCES wishlist(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_wishlist_item_storage
    FOREIGN KEY (storage_location_id) REFERENCES storage_location(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_wishlist_item_received_by
    FOREIGN KEY (received_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_wishlist_item_wrapped_by
    FOREIGN KEY (wrapped_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_wishlist_item_picked_up_by_contact
    FOREIGN KEY (picked_up_by_contact_id) REFERENCES group_contact(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_wishlist_item_picked_up_verified_by
    FOREIGN KEY (picked_up_verified_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_wishlist_item_label_printed_by
    FOREIGN KEY (label_last_printed_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  UNIQUE KEY uq_label_code (label_code),
  KEY idx_wishlist_item_wishlist (wishlist_id),
  KEY idx_wishlist_item_status (status),
  KEY idx_wishlist_item_storage (storage_location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 5) Sponsors + item-by-item sponsorship
-- ============================================================
CREATE TABLE sponsor (
  id             BINARY(16) NOT NULL PRIMARY KEY,
  display_name   VARCHAR(255) NOT NULL,
  organization_name VARCHAR(255) NULL,
  email          VARCHAR(255) NULL,
  phone          VARCHAR(64) NULL,
  preferred_contact ENUM('EMAIL','PHONE','TEXT','NONE') NOT NULL DEFAULT 'NONE',
  notes          TEXT NULL,
  is_active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  KEY idx_sponsor_name (display_name),
  KEY idx_sponsor_email (email),
  KEY idx_sponsor_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sponsorship (
  id           BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id  BINARY(16) NOT NULL,
  sponsor_id   BINARY(16) NOT NULL,

  status       ENUM('ACTIVE','COMPLETE','CANCELLED') NOT NULL DEFAULT 'ACTIVE',
  created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  notes        TEXT NULL,

  CONSTRAINT fk_sponsorship_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_sponsorship_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES sponsor(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  KEY idx_sponsorship_campaign (campaign_id),
  KEY idx_sponsorship_sponsor (sponsor_id),
  KEY idx_sponsorship_status (campaign_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sponsorship_item (
  id               BINARY(16) NOT NULL PRIMARY KEY,
  sponsorship_id   BINARY(16) NOT NULL,
  wishlist_item_id BINARY(16) NOT NULL,
  qty_committed    INT NOT NULL DEFAULT 1,
  committed_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  notes            TEXT NULL,

  CONSTRAINT fk_sponsorship_item_sponsorship
    FOREIGN KEY (sponsorship_id) REFERENCES sponsorship(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_sponsorship_item_wishlist_item
    FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_sponsorship_item_one_owner (wishlist_item_id),
  KEY idx_sponsorship_item_sponsorship (sponsorship_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 6) Donation (Option B) - drop-offs with multiple items, plus fulfillment mapping
-- ============================================================
CREATE TABLE donation (
  id                 BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id        BINARY(16) NOT NULL,
  sponsor_id         BINARY(16) NULL,

  source             ENUM('DROP_OFF','SHIPMENT','CHURCH_PURCHASE','OTHER') NOT NULL DEFAULT 'DROP_OFF',
  received_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  received_by_user_id BINARY(16) NULL,
  notes              TEXT NULL,

  CONSTRAINT fk_donation_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_donation_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES sponsor(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_donation_received_by
    FOREIGN KEY (received_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_donation_campaign (campaign_id),
  KEY idx_donation_sponsor (sponsor_id),
  KEY idx_donation_received_at (received_at),
  KEY idx_donation_received_by (received_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE donation_line (
  id                    BINARY(16) NOT NULL PRIMARY KEY,
  donation_id           BINARY(16) NOT NULL,

  line_type             ENUM('GOODS','GIFT_CARD','MONEY') NOT NULL DEFAULT 'GOODS',
  description           VARCHAR(512) NOT NULL,
  category              VARCHAR(64) NULL,
  size                  VARCHAR(64) NULL,
  quantity              INT NOT NULL DEFAULT 1,
  estimated_value_cents INT NULL,

  storage_location_id   BINARY(16) NULL,

  status                ENUM('UNASSIGNED','ASSIGNED','CONSUMED') NOT NULL DEFAULT 'UNASSIGNED',
  notes                 TEXT NULL,

  created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_donation_line_donation
    FOREIGN KEY (donation_id) REFERENCES donation(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_donation_line_storage
    FOREIGN KEY (storage_location_id) REFERENCES storage_location(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_donation_line_donation (donation_id),
  KEY idx_donation_line_status (status),
  KEY idx_donation_line_storage (storage_location_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE fulfillment (
  id                   BINARY(16) NOT NULL PRIMARY KEY,
  wishlist_item_id     BINARY(16) NOT NULL,
  donation_line_id     BINARY(16) NOT NULL,
  quantity_fulfilled   INT NOT NULL DEFAULT 1,

  fulfilled_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fulfilled_by_user_id BINARY(16) NULL,
  notes                TEXT NULL,

  CONSTRAINT fk_fulfillment_wishlist_item
    FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_fulfillment_donation_line
    FOREIGN KEY (donation_line_id) REFERENCES donation_line(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_fulfillment_by
    FOREIGN KEY (fulfilled_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  UNIQUE KEY uq_fulfillment_pair (wishlist_item_id, donation_line_id),
  KEY idx_fulfillment_item (wishlist_item_id),
  KEY idx_fulfillment_line (donation_line_id),
  KEY idx_fulfillment_time (fulfilled_at),
  KEY idx_fulfillment_by (fulfilled_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 7) Pickup / delivery
-- ============================================================
CREATE TABLE pickup (
  id                     BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id            BINARY(16) NOT NULL,
  recipient_group_id     BINARY(16) NOT NULL,

  method                 ENUM('PICKUP','DELIVERED') NOT NULL DEFAULT 'PICKUP',
  picked_up_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  picked_up_by_contact_id BINARY(16) NULL,
  verified_by_user_id    BINARY(16) NULL,
  notes                  TEXT NULL,

  CONSTRAINT fk_pickup_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_pickup_group
    FOREIGN KEY (recipient_group_id) REFERENCES recipient_group(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_pickup_contact
    FOREIGN KEY (picked_up_by_contact_id) REFERENCES group_contact(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_pickup_verified_by
    FOREIGN KEY (verified_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_pickup_campaign (campaign_id),
  KEY idx_pickup_group (recipient_group_id),
  KEY idx_pickup_time (picked_up_at),
  KEY idx_pickup_verified_by (verified_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE pickup_item (
  id               BINARY(16) NOT NULL PRIMARY KEY,
  pickup_id        BINARY(16) NOT NULL,
  wishlist_item_id BINARY(16) NOT NULL,

  CONSTRAINT fk_pickup_item_pickup
    FOREIGN KEY (pickup_id) REFERENCES pickup(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_pickup_item_wishlist_item
    FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_pickup_item_once (wishlist_item_id),
  KEY idx_pickup_item_pickup (pickup_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 8) Label printing (PDF labels + QR)
-- ============================================================
CREATE TABLE label_print_job (
  id                 BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id        BINARY(16) NOT NULL,
  printed_by_user_id BINARY(16) NULL,
  printed_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  format             VARCHAR(64) NOT NULL DEFAULT 'TAPE',
  printer_name       VARCHAR(255) NULL,
  notes              TEXT NULL,

  CONSTRAINT fk_label_print_job_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_label_print_job_by
    FOREIGN KEY (printed_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_label_print_job_campaign (campaign_id),
  KEY idx_label_print_job_time (printed_at),
  KEY idx_label_print_job_by (printed_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE label_print_item (
  id                 BINARY(16) NOT NULL PRIMARY KEY,
  label_print_job_id BINARY(16) NOT NULL,
  wishlist_item_id   BINARY(16) NOT NULL,
  copies             INT NOT NULL DEFAULT 1,
  rendered_payload_json JSON NULL,

  CONSTRAINT fk_label_print_item_job
    FOREIGN KEY (label_print_job_id) REFERENCES label_print_job(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_label_print_item_wishlist_item
    FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  KEY idx_label_print_item_job (label_print_job_id),
  KEY idx_label_print_item_item (wishlist_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 9) Sponsor communications: call log + scheduled reminders
-- ============================================================
CREATE TABLE sponsor_interaction (
  id               BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id      BINARY(16) NOT NULL,
  sponsor_id       BINARY(16) NOT NULL,

  channel          ENUM('CALL','EMAIL','TEXT','IN_PERSON') NOT NULL,
  direction        ENUM('OUTBOUND','INBOUND') NOT NULL DEFAULT 'OUTBOUND',
  subject          VARCHAR(255) NULL,
  outcome          ENUM('LEFT_VM','NO_ANSWER','REACHED','BOUNCED','WRONG_NUMBER','PROMISED_DATE','COMPLETED','OTHER') NOT NULL DEFAULT 'OTHER',
  notes            TEXT NULL,

  occurred_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by_user_id BINARY(16) NULL,
  follow_up_at     TIMESTAMP NULL,

  related_sponsorship_id BINARY(16) NULL,

  CONSTRAINT fk_sponsor_interaction_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_sponsor_interaction_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES sponsor(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_sponsor_interaction_by
    FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_sponsor_interaction_related_sponsorship
    FOREIGN KEY (related_sponsorship_id) REFERENCES sponsorship(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_sponsor_interaction_campaign (campaign_id),
  KEY idx_sponsor_interaction_sponsor (sponsor_id),
  KEY idx_sponsor_interaction_time (occurred_at),
  KEY idx_sponsor_interaction_followup (follow_up_at),
  KEY idx_sponsor_interaction_by (created_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE sponsor_reminder (
  id               BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id      BINARY(16) NOT NULL,
  sponsor_id       BINARY(16) NOT NULL,

  reminder_type    ENUM('DROP_OFF_REMINDER_1','DROP_OFF_REMINDER_2','FINAL_NOTICE','CUSTOM') NOT NULL DEFAULT 'CUSTOM',
  planned_at       TIMESTAMP NOT NULL,
  sent_at          TIMESTAMP NULL,
  status           ENUM('PLANNED','SENT','SKIPPED') NOT NULL DEFAULT 'PLANNED',
  sent_via         ENUM('EMAIL','TEXT','CALL','NONE') NOT NULL DEFAULT 'NONE',

  interaction_id   BINARY(16) NULL,
  notes            TEXT NULL,
  created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT fk_sponsor_reminder_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_sponsor_reminder_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES sponsor(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,

  CONSTRAINT fk_sponsor_reminder_interaction
    FOREIGN KEY (interaction_id) REFERENCES sponsor_interaction(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_sponsor_reminder_campaign (campaign_id),
  KEY idx_sponsor_reminder_sponsor (sponsor_id),
  KEY idx_sponsor_reminder_planned (planned_at),
  KEY idx_sponsor_reminder_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ============================================================
-- 10) Events you'll be happy you added: item_event + scan_event
-- ============================================================
CREATE TABLE item_event (
  id               BINARY(16) NOT NULL PRIMARY KEY,
  wishlist_item_id BINARY(16) NOT NULL,
  event_type       ENUM('COMMITTED','UNCOMMITTED','RECEIVED','WRAPPED','LABEL_PRINTED','PICKED_UP','STATUS_CHANGED','NOTE') NOT NULL,
  event_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actor_user_id    BINARY(16) NULL,
  detail_json      JSON NULL,

  CONSTRAINT fk_item_event_item
    FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_item_event_actor
    FOREIGN KEY (actor_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_item_event_item (wishlist_item_id),
  KEY idx_item_event_time (event_at),
  KEY idx_item_event_type (event_type),
  KEY idx_item_event_actor (actor_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE scan_event (
  id                 BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id        BINARY(16) NOT NULL,

  label_code         VARCHAR(64) NOT NULL,
  wishlist_item_id   BINARY(16) NULL,
  scanned_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  scanned_by_user_id BINARY(16) NULL,

  action_taken       ENUM('LOOKUP','MARK_RECEIVED','MARK_WRAPPED','MARK_PICKED_UP','REPRINT','ERROR') NOT NULL DEFAULT 'LOOKUP',
  detail_json        JSON NULL,

  CONSTRAINT fk_scan_event_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_scan_event_item
    FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_scan_event_user
    FOREIGN KEY (scanned_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  KEY idx_scan_event_campaign (campaign_id),
  KEY idx_scan_event_label (label_code),
  KEY idx_scan_event_time (scanned_at),
  KEY idx_scan_event_item (wishlist_item_id),
  KEY idx_scan_event_user (scanned_by_user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- Notes / Implementation Guidance
-- ============================================================
-- 1) UUID insertion:
--    INSERT INTO campaign (id, name, year) VALUES (UUID_TO_BIN(UUID(), true), 'Blessing Tree 2026', 2026);
-- 2) Read UUIDs:
--    SELECT BIN_TO_UUID(id, true) AS id FROM sponsor;
-- 3) Recommended status changes:
--    - Create sponsorship_item => set wishlist_item.status='COMMITTED' + item_event('COMMITTED')
--    - Fulfillment updates qty_fulfilled (cached) + item_event('RECEIVED') when met
--    - Wrap => set 'WRAPPED'
--    - Pickup => create pickup + pickup_item; set wishlist_item.status='PICKED_UP'
-- 4) QR:
--    QR contains label_code only (or a short prefix + code); lookup server-side.