CREATE TABLE IF NOT EXISTS campaign_team_role (
  id BINARY(16) NOT NULL,
  team_id BINARY(16) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT fk_campaign_team_role_team
    FOREIGN KEY (team_id) REFERENCES campaign_team(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_campaign_team_role_team_name (team_id, name),
  KEY idx_campaign_team_role_team (team_id),
  KEY idx_campaign_team_role_active (team_id, is_active),
  KEY idx_campaign_team_role_sort (team_id, sort_order)
);

ALTER TABLE campaign_team_member
  ADD COLUMN team_role_id BINARY(16) NULL AFTER campaign_member_id,
  ADD CONSTRAINT fk_campaign_team_member_role
    FOREIGN KEY (team_role_id) REFERENCES campaign_team_role(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  ADD KEY idx_campaign_team_member_role (team_role_id);
