CREATE TABLE IF NOT EXISTS campaign_manual_gift_label (
  id BINARY(16) NOT NULL,
  campaign_id BINARY(16) NOT NULL,
  label_code VARCHAR(64) NOT NULL,
  status ENUM('UNASSIGNED','ATTACHED','VOID') NOT NULL DEFAULT 'UNASSIGNED',
  attached_wishlist_item_id BINARY(16) NULL,
  created_by_user_id BINARY(16) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_campaign_manual_gift_label_code (label_code),
  KEY idx_campaign_manual_gift_label_campaign (campaign_id),
  KEY idx_campaign_manual_gift_label_status (campaign_id, status),
  KEY idx_campaign_manual_gift_label_attached_item (attached_wishlist_item_id),
  KEY idx_campaign_manual_gift_label_created_by (created_by_user_id),
  CONSTRAINT fk_campaign_manual_gift_label_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_manual_gift_label_attached_item
    FOREIGN KEY (attached_wishlist_item_id) REFERENCES wishlist_item(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_manual_gift_label_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE
);

ALTER TABLE label_print_item
  MODIFY wishlist_item_id BINARY(16) NULL,
  ADD COLUMN manual_label_id BINARY(16) NULL AFTER wishlist_item_id,
  ADD KEY idx_label_print_item_manual_label (manual_label_id),
  ADD CONSTRAINT fk_label_print_item_manual_label
    FOREIGN KEY (manual_label_id) REFERENCES campaign_manual_gift_label(id)
    ON DELETE CASCADE ON UPDATE CASCADE;
