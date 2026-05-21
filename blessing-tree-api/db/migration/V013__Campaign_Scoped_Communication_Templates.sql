ALTER TABLE communication_template
    ADD COLUMN campaign_id BINARY(16) NULL AFTER id;

UPDATE communication_template template
JOIN (
    SELECT template_id, MIN(campaign_id) AS campaign_id
    FROM campaign_communication_schedule
    GROUP BY template_id
) schedule_map ON schedule_map.template_id = template.id
SET template.campaign_id = schedule_map.campaign_id
WHERE template.campaign_id IS NULL;

DELETE FROM communication_template
WHERE campaign_id IS NULL;

ALTER TABLE communication_template
    MODIFY COLUMN campaign_id BINARY(16) NOT NULL;

DROP INDEX uq_communication_template_key ON communication_template;
DROP INDEX idx_communication_template_audience ON communication_template;
DROP INDEX idx_communication_template_active ON communication_template;

CREATE UNIQUE INDEX uq_communication_template_campaign_key
    ON communication_template (campaign_id, template_key);

CREATE INDEX idx_communication_template_campaign
    ON communication_template (campaign_id);

CREATE INDEX idx_communication_template_audience
    ON communication_template (campaign_id, audience);

CREATE INDEX idx_communication_template_active
    ON communication_template (campaign_id, is_active);

ALTER TABLE communication_template
    ADD CONSTRAINT fk_communication_template_campaign
        FOREIGN KEY (campaign_id) REFERENCES campaign(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE;
