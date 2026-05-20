CREATE TABLE IF NOT EXISTS communication_template (
  id BINARY(16) NOT NULL PRIMARY KEY,
  template_key VARCHAR(100) NOT NULL,
  name VARCHAR(255) NOT NULL,
  audience ENUM('SPONSOR','VOLUNTEER','MANAGER','FAMILY','GENERAL') NOT NULL DEFAULT 'GENERAL',
  channel ENUM('EMAIL') NOT NULL DEFAULT 'EMAIL',
  subject_template VARCHAR(255) NOT NULL,
  body_template TEXT NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by_user_id BINARY(16) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_communication_template_created_by
    FOREIGN KEY (created_by_user_id) REFERENCES app_user(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  UNIQUE KEY uq_communication_template_key (template_key),
  KEY idx_communication_template_audience (audience),
  KEY idx_communication_template_active (is_active)
);

CREATE TABLE IF NOT EXISTS campaign_milestone (
  id BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id BINARY(16) NOT NULL,
  milestone_key VARCHAR(64) NOT NULL,
  label VARCHAR(255) NOT NULL,
  occurs_on DATE NOT NULL,
  notes TEXT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaign_milestone_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  UNIQUE KEY uq_campaign_milestone_scope (campaign_id, milestone_key),
  KEY idx_campaign_milestone_campaign (campaign_id),
  KEY idx_campaign_milestone_occurs_on (occurs_on)
);

CREATE TABLE IF NOT EXISTS campaign_communication_schedule (
  id BINARY(16) NOT NULL PRIMARY KEY,
  campaign_id BINARY(16) NOT NULL,
  template_id BINARY(16) NOT NULL,
  milestone_key VARCHAR(64) NULL,
  scheduled_for DATETIME NULL,
  status ENUM('DRAFT','SCHEDULED','DISABLED') NOT NULL DEFAULT 'DRAFT',
  notes TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_campaign_communication_schedule_campaign
    FOREIGN KEY (campaign_id) REFERENCES campaign(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT fk_campaign_communication_schedule_template
    FOREIGN KEY (template_id) REFERENCES communication_template(id)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  KEY idx_campaign_communication_schedule_campaign (campaign_id),
  KEY idx_campaign_communication_schedule_template (template_id),
  KEY idx_campaign_communication_schedule_status (status),
  KEY idx_campaign_communication_schedule_scheduled_for (scheduled_for)
);
