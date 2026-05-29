ALTER TABLE recipient_group
  ADD COLUMN parent_organization_group_id BINARY(16) NULL AFTER campaign_id,
  ADD KEY idx_recipient_group_parent_organization (campaign_id, parent_organization_group_id),
  ADD CONSTRAINT fk_recipient_group_parent_organization
    FOREIGN KEY (parent_organization_group_id)
    REFERENCES recipient_group(id)
    ON DELETE SET NULL
    ON UPDATE CASCADE;
