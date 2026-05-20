CREATE TABLE IF NOT EXISTS campaign_team (
  id BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id BINARY(16) NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_campaign_team_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_campaign_team_campaign_name (campaign_id, name),
  KEY idx_campaign_team_campaign (campaign_id),
  KEY idx_campaign_team_active (campaign_id, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS campaign_team_member (
  id BINARY(16) NOT NULL PRIMARY KEY,
  team_id BINARY(16) NOT NULL,
  campaign_member_id BINARY(16) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  CONSTRAINT fk_campaign_team_member_team
    FOREIGN KEY (team_id) REFERENCES campaign_team(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  CONSTRAINT fk_campaign_team_member_member
    FOREIGN KEY (campaign_member_id) REFERENCES campaign_member(id)
    ON DELETE CASCADE ON UPDATE CASCADE,

  UNIQUE KEY uq_campaign_team_member_scope (team_id, campaign_member_id),
  KEY idx_campaign_team_member_team (team_id),
  KEY idx_campaign_team_member_member (campaign_member_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
