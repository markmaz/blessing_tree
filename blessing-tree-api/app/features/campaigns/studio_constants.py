from __future__ import annotations

COMMUNICATION_AUDIENCES = frozenset(
    {"SPONSOR", "VOLUNTEER", "MANAGER", "FAMILY", "GENERAL"}
)
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
