from __future__ import annotations

APP_ADMIN_ROLE = "APP_ADMIN"
APP_USER_ROLE = "APP_USER"

CAMPAIGN_MANAGER_ROLE = "CAMPAIGN_MANAGER"
PEOPLE_MANAGER_ROLE = "PEOPLE_MANAGER"
RECIPIENT_COORDINATOR_ROLE = PEOPLE_MANAGER_ROLE
DONATION_ENTRY_ROLE = "DONATION_ENTRY"
SPONSOR_MANAGER_ROLE = "SPONSOR_MANAGER"
GIFT_OPERATIONS_ROLE = "GIFT_OPERATIONS"
GIFT_SEARCH_USER_ROLE = "GIFT_SEARCH_USER"
REPORTS_VIEWER_ROLE = "REPORTS_VIEWER"
CAMPAIGN_VIEWER_ROLE = "CAMPAIGN_VIEWER"
GIFT_CHECKIN_ROLE = GIFT_OPERATIONS_ROLE
VOLUNTEER_VIEWER_ROLE = CAMPAIGN_VIEWER_ROLE

CAMPAIGN_VIEW_CAPABILITY = "campaign.view"
CAMPAIGN_ADMIN_CAPABILITY = "campaign.admin"
CAMPAIGN_RECIPIENTS_VIEW_CAPABILITY = "campaign.recipients.view"
CAMPAIGN_RECIPIENTS_EDIT_CAPABILITY = "campaign.recipients.edit"
CAMPAIGN_DONATIONS_VIEW_CAPABILITY = "campaign.donations.view"
CAMPAIGN_DONATIONS_EDIT_CAPABILITY = "campaign.donations.edit"
CAMPAIGN_GIFTS_SEARCH_CAPABILITY = "campaign.gifts.search"
CAMPAIGN_GIFTS_COMMIT_CAPABILITY = "campaign.gifts.commit"
CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY = "campaign.gifts.check_in"
CAMPAIGN_GIFTS_WRAP_CAPABILITY = "campaign.gifts.wrap"
CAMPAIGN_GIFTS_DISTRIBUTE_CAPABILITY = "campaign.gifts.distribute"
CAMPAIGN_GIFTS_POOL_MANAGE_CAPABILITY = "campaign.gifts.pool.manage"
CAMPAIGN_SPONSORS_VIEW_CAPABILITY = "campaign.sponsors.view"
CAMPAIGN_SPONSORS_MANAGE_CAPABILITY = "campaign.sponsors.manage"
CAMPAIGN_REPORTS_VIEW_CAPABILITY = "campaign.reports.view"
CAMPAIGN_PICKUPS_MANAGE_CAPABILITY = "campaign.pickups.manage"

_LEGACY_APP_ROLE_ALIASES = {
    "ADMIN": APP_ADMIN_ROLE,
    "COORDINATOR": APP_USER_ROLE,
    "VOLUNTEER": APP_USER_ROLE,
    APP_ADMIN_ROLE: APP_ADMIN_ROLE,
    APP_USER_ROLE: APP_USER_ROLE,
}

ALL_CAMPAIGN_CAPABILITIES = frozenset(
    {
        CAMPAIGN_VIEW_CAPABILITY,
        CAMPAIGN_ADMIN_CAPABILITY,
        CAMPAIGN_RECIPIENTS_VIEW_CAPABILITY,
        CAMPAIGN_RECIPIENTS_EDIT_CAPABILITY,
        CAMPAIGN_DONATIONS_VIEW_CAPABILITY,
        CAMPAIGN_DONATIONS_EDIT_CAPABILITY,
        CAMPAIGN_GIFTS_SEARCH_CAPABILITY,
        CAMPAIGN_GIFTS_COMMIT_CAPABILITY,
        CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY,
        CAMPAIGN_GIFTS_WRAP_CAPABILITY,
        CAMPAIGN_GIFTS_DISTRIBUTE_CAPABILITY,
        CAMPAIGN_GIFTS_POOL_MANAGE_CAPABILITY,
        CAMPAIGN_SPONSORS_VIEW_CAPABILITY,
        CAMPAIGN_SPONSORS_MANAGE_CAPABILITY,
        CAMPAIGN_REPORTS_VIEW_CAPABILITY,
        CAMPAIGN_PICKUPS_MANAGE_CAPABILITY,
    }
)

CAMPAIGN_ROLE_CAPABILITIES = {
    CAMPAIGN_MANAGER_ROLE: ALL_CAMPAIGN_CAPABILITIES,
    PEOPLE_MANAGER_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_RECIPIENTS_VIEW_CAPABILITY,
            CAMPAIGN_RECIPIENTS_EDIT_CAPABILITY,
            CAMPAIGN_PICKUPS_MANAGE_CAPABILITY,
            CAMPAIGN_REPORTS_VIEW_CAPABILITY,
        }
    ),
    SPONSOR_MANAGER_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_SPONSORS_VIEW_CAPABILITY,
            CAMPAIGN_SPONSORS_MANAGE_CAPABILITY,
            CAMPAIGN_REPORTS_VIEW_CAPABILITY,
        }
    ),
    DONATION_ENTRY_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_DONATIONS_VIEW_CAPABILITY,
            CAMPAIGN_DONATIONS_EDIT_CAPABILITY,
        }
    ),
    GIFT_OPERATIONS_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_GIFTS_SEARCH_CAPABILITY,
            CAMPAIGN_GIFTS_COMMIT_CAPABILITY,
            CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY,
            CAMPAIGN_GIFTS_WRAP_CAPABILITY,
            CAMPAIGN_GIFTS_DISTRIBUTE_CAPABILITY,
            CAMPAIGN_GIFTS_POOL_MANAGE_CAPABILITY,
            CAMPAIGN_REPORTS_VIEW_CAPABILITY,
        }
    ),
    GIFT_SEARCH_USER_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_GIFTS_SEARCH_CAPABILITY,
            CAMPAIGN_GIFTS_COMMIT_CAPABILITY,
        }
    ),
    REPORTS_VIEWER_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_REPORTS_VIEW_CAPABILITY}),
    CAMPAIGN_VIEWER_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY}),
}

_LEGACY_CAMPAIGN_ROLE_ALIASES = {
    "RECIPIENT_COORDINATOR": PEOPLE_MANAGER_ROLE,
    "GIFT_CHECKIN": GIFT_OPERATIONS_ROLE,
    "VOLUNTEER_VIEWER": CAMPAIGN_VIEWER_ROLE,
}

CAMPAIGN_ROLE_CATALOG = (
    {
        "role_key": CAMPAIGN_MANAGER_ROLE,
        "label": "Campaign Manager",
        "description": "Full campaign setup, staffing, and operations access.",
    },
    {
        "role_key": PEOPLE_MANAGER_ROLE,
        "label": "People",
        "description": "Manage people, groups, wishlists, pickup setup, and people reports.",
    },
    {
        "role_key": SPONSOR_MANAGER_ROLE,
        "label": "Sponsors",
        "description": "Manage sponsors, public signup follow-up, and sponsor reports.",
    },
    {
        "role_key": GIFT_OPERATIONS_ROLE,
        "label": "Gift Operations",
        "description": "Search, commit, receive, wrap, tag, pool, scan, and distribute gifts.",
    },
    {
        "role_key": GIFT_SEARCH_USER_ROLE,
        "label": "Gift Search",
        "description": "Find and commit gifts with limited campaign access.",
    },
    {
        "role_key": REPORTS_VIEWER_ROLE,
        "label": "Reports Only",
        "description": "View campaign reports without operational edit access.",
    },
    {
        "role_key": CAMPAIGN_VIEWER_ROLE,
        "label": "View Only",
        "description": "Basic read-only campaign access.",
    },
)


def normalize_app_role(value: str | None) -> str:
    normalized = (value or "").strip().upper()
    return _LEGACY_APP_ROLE_ALIASES.get(normalized, APP_USER_ROLE)


def normalize_campaign_role_key(value: str | None) -> str:
    normalized = (value or "").strip().upper()
    return _LEGACY_CAMPAIGN_ROLE_ALIASES.get(normalized, normalized)


def get_capabilities_for_campaign_role(role_key: str | None) -> frozenset[str]:
    return CAMPAIGN_ROLE_CAPABILITIES.get(normalize_campaign_role_key(role_key), frozenset())


def list_campaign_role_catalog() -> list[dict[str, object]]:
    return [
        {
            "role_key": role["role_key"],
            "label": role["label"],
            "description": role["description"],
            "capabilities": sorted(get_capabilities_for_campaign_role(str(role["role_key"]))),
        }
        for role in CAMPAIGN_ROLE_CATALOG
    ]
