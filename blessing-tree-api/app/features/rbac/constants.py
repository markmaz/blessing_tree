from __future__ import annotations

APP_ADMIN_ROLE = "APP_ADMIN"
APP_USER_ROLE = "APP_USER"

CAMPAIGN_MANAGER_ROLE = "CAMPAIGN_MANAGER"
RECIPIENT_COORDINATOR_ROLE = "RECIPIENT_COORDINATOR"
DONATION_ENTRY_ROLE = "DONATION_ENTRY"
GIFT_CHECKIN_ROLE = "GIFT_CHECKIN"
VOLUNTEER_VIEWER_ROLE = "VOLUNTEER_VIEWER"

CAMPAIGN_VIEW_CAPABILITY = "campaign.view"
CAMPAIGN_ADMIN_CAPABILITY = "campaign.admin"
CAMPAIGN_RECIPIENTS_VIEW_CAPABILITY = "campaign.recipients.view"
CAMPAIGN_RECIPIENTS_EDIT_CAPABILITY = "campaign.recipients.edit"
CAMPAIGN_DONATIONS_VIEW_CAPABILITY = "campaign.donations.view"
CAMPAIGN_DONATIONS_EDIT_CAPABILITY = "campaign.donations.edit"
CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY = "campaign.gifts.check_in"
CAMPAIGN_GIFTS_WRAP_CAPABILITY = "campaign.gifts.wrap"
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
        CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY,
        CAMPAIGN_GIFTS_WRAP_CAPABILITY,
        CAMPAIGN_SPONSORS_VIEW_CAPABILITY,
        CAMPAIGN_SPONSORS_MANAGE_CAPABILITY,
        CAMPAIGN_REPORTS_VIEW_CAPABILITY,
        CAMPAIGN_PICKUPS_MANAGE_CAPABILITY,
    }
)

CAMPAIGN_ROLE_CAPABILITIES = {
    CAMPAIGN_MANAGER_ROLE: ALL_CAMPAIGN_CAPABILITIES,
    RECIPIENT_COORDINATOR_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_RECIPIENTS_VIEW_CAPABILITY,
            CAMPAIGN_RECIPIENTS_EDIT_CAPABILITY,
            CAMPAIGN_SPONSORS_VIEW_CAPABILITY,
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
    GIFT_CHECKIN_ROLE: frozenset(
        {
            CAMPAIGN_VIEW_CAPABILITY,
            CAMPAIGN_GIFTS_CHECK_IN_CAPABILITY,
            CAMPAIGN_GIFTS_WRAP_CAPABILITY,
        }
    ),
    VOLUNTEER_VIEWER_ROLE: frozenset({CAMPAIGN_VIEW_CAPABILITY}),
}

CAMPAIGN_ROLE_CATALOG = (
    {
        "role_key": CAMPAIGN_MANAGER_ROLE,
        "label": "Campaign Manager",
        "description": "Full campaign setup, staffing, and operations access.",
    },
    {
        "role_key": RECIPIENT_COORDINATOR_ROLE,
        "label": "Recipient Coordinator",
        "description": "Manage recipients, wishlists, and sponsor coordination.",
    },
    {
        "role_key": DONATION_ENTRY_ROLE,
        "label": "Donation Entry",
        "description": "Record and edit donations for the campaign.",
    },
    {
        "role_key": GIFT_CHECKIN_ROLE,
        "label": "Gift Check-In",
        "description": "Check in gifts and support fulfillment handling.",
    },
    {
        "role_key": VOLUNTEER_VIEWER_ROLE,
        "label": "Volunteer Viewer",
        "description": "Read-only campaign access for general volunteers.",
    },
)


def normalize_app_role(value: str | None) -> str:
    normalized = (value or "").strip().upper()
    return _LEGACY_APP_ROLE_ALIASES.get(normalized, APP_USER_ROLE)


def normalize_campaign_role_key(value: str | None) -> str:
    return (value or "").strip().upper()


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
