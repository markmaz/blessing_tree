CREATE TABLE campaign_gift_policy (
    id BINARY(16) NOT NULL,
    campaign_id BINARY(16) NOT NULL,
    max_gifts_per_sponsor INT NOT NULL DEFAULT 3,
    max_wishlist_items_per_recipient INT NOT NULL DEFAULT 3,
    recipient_coverage_rule ENUM(
        'ONE_GIFT_SPONSORED',
        'MIN_GIFTS_SPONSORED',
        'ALL_GIFTS_SPONSORED'
    ) NOT NULL DEFAULT 'ALL_GIFTS_SPONSORED',
    recipient_coverage_required_count INT NOT NULL DEFAULT 1,
    allow_partial_sponsor_commitments TINYINT(1) NOT NULL DEFAULT 0,
    reservation_hold_minutes INT NOT NULL DEFAULT 1440,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    UNIQUE KEY uq_campaign_gift_policy_campaign (campaign_id),
    CONSTRAINT fk_campaign_gift_policy_campaign
        FOREIGN KEY (campaign_id) REFERENCES campaign(id)
        ON DELETE CASCADE
        ON UPDATE CASCADE
);

INSERT INTO campaign_gift_policy (id, campaign_id)
SELECT UUID_TO_BIN(UUID(), true), campaign.id
FROM campaign
WHERE NOT EXISTS (
    SELECT 1
    FROM campaign_gift_policy
    WHERE campaign_gift_policy.campaign_id = campaign.id
);
