ALTER TABLE donation_line
  ADD COLUMN campaign_id BINARY(16) NULL AFTER donation_id,
  ADD COLUMN quantity_available INT NOT NULL DEFAULT 1 AFTER quantity,
  ADD COLUMN quantity_assigned INT NOT NULL DEFAULT 0 AFTER quantity_available,
  ADD COLUMN age_min INT NULL AFTER estimated_value_cents,
  ADD COLUMN age_max INT NULL AFTER age_min,
  ADD COLUMN gender_fit ENUM('ANY','F','M','X','U','UNSPECIFIED') NOT NULL DEFAULT 'ANY' AFTER age_max,
  ADD COLUMN gift_condition ENUM('NEW','LIKE_NEW','USED_ACCEPTABLE') NOT NULL DEFAULT 'NEW' AFTER gender_fit,
  ADD COLUMN source_label VARCHAR(255) NULL AFTER gift_condition,
  ADD COLUMN inventory_status ENUM('AVAILABLE','PARTIALLY_ASSIGNED','ASSIGNED','CONSUMED','ARCHIVED') NOT NULL DEFAULT 'AVAILABLE' AFTER status,
  ADD COLUMN received_by_user_id BINARY(16) NULL AFTER inventory_status;

UPDATE donation_line line
JOIN donation donation_row ON donation_row.id = line.donation_id
SET
  line.campaign_id = donation_row.campaign_id,
  line.quantity_available = GREATEST(line.quantity - COALESCE((
    SELECT SUM(fulfillment.quantity_fulfilled)
    FROM fulfillment
    WHERE fulfillment.donation_line_id = line.id
  ), 0), 0),
  line.quantity_assigned = COALESCE((
    SELECT SUM(fulfillment.quantity_fulfilled)
    FROM fulfillment
    WHERE fulfillment.donation_line_id = line.id
  ), 0),
  line.inventory_status = CASE
    WHEN line.status = 'CONSUMED' THEN 'CONSUMED'
    WHEN line.status = 'ASSIGNED' AND GREATEST(line.quantity - COALESCE((
      SELECT SUM(fulfillment.quantity_fulfilled)
      FROM fulfillment
      WHERE fulfillment.donation_line_id = line.id
    ), 0), 0) = 0 THEN 'ASSIGNED'
    WHEN line.status = 'ASSIGNED' THEN 'PARTIALLY_ASSIGNED'
    ELSE 'AVAILABLE'
  END;

ALTER TABLE donation_line
  ADD KEY idx_donation_line_campaign (campaign_id),
  ADD KEY idx_donation_line_inventory_status (inventory_status),
  ADD KEY idx_donation_line_gender_fit (gender_fit),
  ADD KEY idx_donation_line_received_by (received_by_user_id),
  ADD CONSTRAINT fk_donation_line_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT fk_donation_line_received_by
    FOREIGN KEY (received_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE;
