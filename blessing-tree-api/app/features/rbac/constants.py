from __future__ import annotations

APP_ADMIN_ROLE = "APP_ADMIN"
APP_USER_ROLE = "APP_USER"

CAMPAIGN_MANAGER_ROLE = "CAMPAIGN_MANAGER"
CAMPAIGN_OVERVIEW_ROLE = "CAMPAIGN_OVERVIEW"
CAMPAIGN_STUDIO_ROLE = "CAMPAIGN_STUDIO"
CAMPAIGN_FLYER_BUILDER_ROLE = "CAMPAIGN_FLYER_BUILDER"
ASK_BLESSING_TREE_ROLE = "ASK_BLESSING_TREE"
PEOPLE_INTAKE_ROLE = "PEOPLE_INTAKE"
PEOPLE_DIRECTORY_ROLE = "PEOPLE_DIRECTORY"
PEOPLE_REPORTS_ROLE = "PEOPLE_REPORTS"
SPONSORS_INTAKE_ROLE = "SPONSORS_INTAKE"
SPONSORS_DIRECTORY_ROLE = "SPONSORS_DIRECTORY"
SPONSORS_REPORTS_ROLE = "SPONSORS_REPORTS"
GIFTS_SEARCH_ROLE = "GIFTS_SEARCH"
GIFTS_OPERATIONS_SCREEN_ROLE = "GIFTS_OPERATIONS"
GIFTS_POOL_ROLE = "GIFTS_POOL"
GIFTS_STATUS_ROLE = "GIFTS_STATUS"
GIFTS_TAG_BUILDER_ROLE = "GIFTS_TAG_BUILDER"
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
    CAMPAIGN_OVERVIEW_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY}),
    CAMPAIGN_STUDIO_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_ADMIN_CAPABILITY}),
    CAMPAIGN_FLYER_BUILDER_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_ADMIN_CAPABILITY}),
    ASK_BLESSING_TREE_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY}),
    PEOPLE_INTAKE_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_RECIPIENTS_VIEW_CAPABILITY,
            CAMPAIGN_RECIPIENTS_EDIT_CAPABILITY,
            CAMPAIGN_PICKUPS_MANAGE_CAPABILITY,
        }
    ),
    PEOPLE_DIRECTORY_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_RECIPIENTS_VIEW_CAPABILITY}),
    PEOPLE_REPORTS_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_REPORTS_VIEW_CAPABILITY}),
    SPONSORS_INTAKE_ROLE: frozenset(
        {CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_SPONSORS_VIEW_CAPABILITY, CAMPAIGN_SPONSORS_MANAGE_CAPABILITY}
    ),
    SPONSORS_DIRECTORY_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_SPONSORS_VIEW_CAPABILITY}),
    SPONSORS_REPORTS_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_REPORTS_VIEW_CAPABILITY}),
    GIFTS_SEARCH_ROLE: frozenset(
        {CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_GIFTS_SEARCH_CAPABILITY, CAMPAIGN_GIFTS_COMMIT_CAPABILITY}
    ),
    GIFTS_OPERATIONS_SCREEN_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_GIFTS_SEARCH_CAPABILITY,
            CAMPAIGN_GIFTS_COMMIT_CAPABILITY,
            CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY,
            CAMPAIGN_GIFTS_WRAP_CAPABILITY,
            CAMPAIGN_GIFTS_DISTRIBUTE_CAPABILITY,
        }
    ),
    GIFTS_POOL_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_DONATIONS_VIEW_CAPABILITY,
            CAMPAIGN_DONATIONS_EDIT_CAPABILITY,
            CAMPAIGN_GIFTS_POOL_MANAGE_CAPABILITY,
        }
    ),
    GIFTS_STATUS_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_REPORTS_VIEW_CAPABILITY}),
    GIFTS_TAG_BUILDER_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY, CAMPAIGN_ADMIN_CAPABILITY}),
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
        "role_key": CAMPAIGN_OVERVIEW_ROLE,
        "label": "Campaign Overview",
        "description": "View the selected campaign overview screen.",
    },
    {
        "role_key": CAMPAIGN_STUDIO_ROLE,
        "label": "Campaign Studio",
        "description": "Open and manage the campaign studio.",
    },
    {
        "role_key": CAMPAIGN_FLYER_BUILDER_ROLE,
        "label": "Flyer Builder",
        "description": "Open and manage campaign sponsor flyers.",
    },
    {
        "role_key": ASK_BLESSING_TREE_ROLE,
        "label": "Ask Blessing Tree",
        "description": "Use the Ask Blessing Tree help and reporting screen.",
    },
    {
        "role_key": PEOPLE_INTAKE_ROLE,
        "label": "People Intake",
        "description": "Create and update family, organization, person, and wishlist intake records.",
    },
    {
        "role_key": PEOPLE_DIRECTORY_ROLE,
        "label": "People Directory",
        "description": "View and search people, families, organizations, and wishlists.",
    },
    {
        "role_key": PEOPLE_REPORTS_ROLE,
        "label": "People Reports",
        "description": "View people-focused campaign reports.",
    },
    {
        "role_key": SPONSORS_INTAKE_ROLE,
        "label": "Sponsor Intake",
        "description": "Create and update sponsor intake records.",
    },
    {
        "role_key": SPONSORS_DIRECTORY_ROLE,
        "label": "Sponsor Directory",
        "description": "View and search sponsors.",
    },
    {
        "role_key": SPONSORS_REPORTS_ROLE,
        "label": "Sponsor Reports",
        "description": "View sponsor-focused campaign reports.",
    },
    {
        "role_key": GIFTS_SEARCH_ROLE,
        "label": "Gift Search",
        "description": "Search and commit gifts.",
    },
    {
        "role_key": GIFTS_OPERATIONS_SCREEN_ROLE,
        "label": "Gift Operations",
        "description": "Receive, wrap, tag, and distribute gifts.",
    },
    {
        "role_key": GIFTS_POOL_ROLE,
        "label": "Gift Pool",
        "description": "Manage donated gifts and matching pool items.",
    },
    {
        "role_key": GIFTS_STATUS_ROLE,
        "label": "Gift Status",
        "description": "View the gift status report.",
    },
    {
        "role_key": GIFTS_TAG_BUILDER_ROLE,
        "label": "Gift Tag Builder",
        "description": "Design and manage campaign gift tag templates.",
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
