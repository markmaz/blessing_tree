ALTER TABLE campaign
    ADD COLUMN public_sponsor_slug VARCHAR(120) NULL AFTER season_theme,
    ADD COLUMN public_sponsor_signup_enabled TINYINT(1) NOT NULL DEFAULT 0 AFTER public_sponsor_slug;

CREATE UNIQUE INDEX uq_campaign_public_sponsor_slug ON campaign (public_sponsor_slug);
