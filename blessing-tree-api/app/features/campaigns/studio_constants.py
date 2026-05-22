from __future__ import annotations

from app.models.communication_audience_constants import (
    COMMUNICATION_AUDIENCE_ADULT_RECIPIENT_DIRECT,
    COMMUNICATION_AUDIENCE_CARE_FACILITY_CONTACT,
    COMMUNICATION_AUDIENCE_GENERAL,
    COMMUNICATION_AUDIENCE_GROUP_PRIMARY_CONTACT,
    COMMUNICATION_AUDIENCE_HOUSEHOLD_CONTACT,
    COMMUNICATION_AUDIENCE_MANAGER,
    COMMUNICATION_AUDIENCE_SPONSOR,
    COMMUNICATION_AUDIENCE_VOLUNTEER,
)

COMMUNICATION_AUDIENCES = frozenset(
    {
        COMMUNICATION_AUDIENCE_SPONSOR,
        COMMUNICATION_AUDIENCE_VOLUNTEER,
        COMMUNICATION_AUDIENCE_MANAGER,
        COMMUNICATION_AUDIENCE_HOUSEHOLD_CONTACT,
        COMMUNICATION_AUDIENCE_CARE_FACILITY_CONTACT,
        COMMUNICATION_AUDIENCE_GROUP_PRIMARY_CONTACT,
        COMMUNICATION_AUDIENCE_ADULT_RECIPIENT_DIRECT,
        COMMUNICATION_AUDIENCE_GENERAL,
    }
)
COMMUNICATION_AUDIENCE_ALIASES = {
    "FAMILY": COMMUNICATION_AUDIENCE_HOUSEHOLD_CONTACT,
    "FACILITY": COMMUNICATION_AUDIENCE_CARE_FACILITY_CONTACT,
    "PRIMARY_CONTACT": COMMUNICATION_AUDIENCE_GROUP_PRIMARY_CONTACT,
    "RECIPIENT_DIRECT": COMMUNICATION_AUDIENCE_ADULT_RECIPIENT_DIRECT,
}
COMMUNICATION_AUDIENCE_CATALOG = (
    {
        "key": COMMUNICATION_AUDIENCE_HOUSEHOLD_CONTACT,
        "label": "Household Contacts",
        "description": "Parents and guardians connected to household recipient groups.",
    },
    {
        "key": COMMUNICATION_AUDIENCE_CARE_FACILITY_CONTACT,
        "label": "Facility Contacts",
        "description": "Staff and social-worker contacts connected to care-facility groups.",
    },
    {
        "key": COMMUNICATION_AUDIENCE_GROUP_PRIMARY_CONTACT,
        "label": "Primary Group Contacts",
        "description": "The primary coordination contact for each recipient group.",
    },
    {
        "key": COMMUNICATION_AUDIENCE_ADULT_RECIPIENT_DIRECT,
        "label": "Direct Adult Recipients",
        "description": "Adult recipients who have their own direct email address on file.",
    },
    {
        "key": COMMUNICATION_AUDIENCE_SPONSOR,
        "label": "Sponsors",
        "description": "Sponsors connected to this campaign through active sponsorships.",
    },
    {
        "key": COMMUNICATION_AUDIENCE_VOLUNTEER,
        "label": "Volunteers",
        "description": "Campaign roster members marked as volunteers.",
    },
    {
        "key": COMMUNICATION_AUDIENCE_MANAGER,
        "label": "Campaign Managers",
        "description": "People with the Campaign Manager app access role in this campaign.",
    },
    {
        "key": COMMUNICATION_AUDIENCE_GENERAL,
        "label": "Campaign Members",
        "description": "All active campaign roster members with an email address.",
    },
)


def get_communication_audience_catalog() -> list[dict[str, str]]:
    return [dict(item) for item in COMMUNICATION_AUDIENCE_CATALOG]
COMMUNICATION_CHANNELS = frozenset({"EMAIL"})
COMMUNICATION_SCHEDULE_STATUSES = frozenset({"DRAFT", "SCHEDULED", "DISABLED"})
CAMPAIGN_EVENT_TYPES = frozenset(
    {
        "GENERAL",
        "VOLUNTEER",
        "SPONSOR",
        "DONATION",
        "RECIPIENT",
        "GIFT",
        "PICKUP",
        "COMMUNICATION",
        "MILESTONE",
    }
)
CAMPAIGN_EVENT_SOURCE_TYPES = frozenset({"manual", "milestone", "communication"})

CAMPAIGN_EVENT_SOURCE_MANUAL = "manual"
CAMPAIGN_EVENT_SOURCE_MILESTONE = "milestone"
CAMPAIGN_EVENT_SOURCE_COMMUNICATION = "communication"

MILESTONE_DEFINITIONS = {
    "registration_open": "Registration Opens",
    "registration_close": "Registration Closes",
    "sponsor_outreach_start": "Sponsor Outreach Starts",
    "gift_intake_start": "Gift Intake Starts",
    "gift_intake_end": "Gift Intake Ends",
    "pickup_start": "Pickup Window Opens",
    "pickup_end": "Pickup Window Closes",
    "campaign_close": "Campaign Closes",
}

REQUIRED_MILESTONE_KEYS = frozenset(MILESTONE_DEFINITIONS.keys())

READINESS_READY = "READY"
READINESS_NEEDS_ATTENTION = "NEEDS_ATTENTION"
READINESS_BLOCKED = "BLOCKED"
