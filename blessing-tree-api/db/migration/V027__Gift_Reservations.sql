CREATE TABLE gift_reservation (
  id                              BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id                     BINARY(16) NOT NULL,
  wishlist_item_id                BINARY(16) NOT NULL,
  active_wishlist_item_id         BINARY(16) NULL,
  sponsor_id                      BINARY(16) NULL,
  pending_sponsor_registration_id BINARY(16) NULL,
  reserved_by_user_id             BINARY(16) NULL,
  reservation_source              ENUM('PUBLIC_SIGNUP','STAFF') NOT NULL,
  status                          ENUM('ACTIVE','COMMITTED','RELEASED','EXPIRED') NOT NULL DEFAULT 'ACTIVE',
  expires_at                      TIMESTAMP NULL,
  committed_at                    TIMESTAMP NULL,
  released_at                     TIMESTAMP NULL,
  notes                           TEXT NULL,
  created_at                      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at                      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_gift_reservation_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_gift_reservation_wishlist_item
    FOREIGN KEY (wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_gift_reservation_active_wishlist_item
    FOREIGN KEY (active_wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_gift_reservation_sponsor
    FOREIGN KEY (sponsor_id) REFERENCES sponsor(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_gift_reservation_pending_registration
    FOREIGN KEY (pending_sponsor_registration_id) REFERENCES pending_sponsor_registration(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT fk_gift_reservation_reserved_by_user
    FOREIGN KEY (reserved_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,

  UNIQUE KEY uq_active_gift_reservation_item (active_wishlist_item_id),
  KEY idx_gift_reservation_campaign_status (campaign_id, status),
  KEY idx_gift_reservation_registration (pending_sponsor_registration_id),
  KEY idx_gift_reservation_item_status (wishlist_item_id, status),
  KEY idx_gift_reservation_sponsor (sponsor_id),
  KEY idx_gift_reservation_reserved_by_user (reserved_by_user_id),
  KEY idx_gift_reservation_expires_at (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
