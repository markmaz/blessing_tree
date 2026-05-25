from __future__ import annotations

CAMPAIGN_MILESTONE_FEATURE_AREAS = frozenset(
    {
        "GENERAL",
        "RECIPIENTS",
        "SPONSORS",
        "GIFTS",
        "PICKUP",
        "COMMUNICATIONS",
    }
)

CAMPAIGN_READINESS_RULE_TYPES = frozenset({"MISSING_MILESTONE"})
CAMPAIGN_READINESS_CONDITION_TYPES = frozenset(
    {
        "ALWAYS",
        "CAMPAIGN_FIELD_TRUE",
        "CAMPAIGN_STATUS_IS",
        "FEATURE_ENABLED",
    }
)
CAMPAIGN_READINESS_SEVERITIES = frozenset({"error", "warning", "info"})
CAMPAIGN_READINESS_CATEGORIES = frozenset(
    {
        "blockers",
        "launch_checks",
        "planning_gaps",
        "operational_health",
    }
)
CAMPAIGN_READINESS_PHASES = frozenset({"draft", "activate", "operations", "close"})
CAMPAIGN_READINESS_SECTIONS = frozenset({"settings", "team", "communications", "schedule", "readiness"})
CAMPAIGN_READINESS_ALLOWED_CAMPAIGN_FIELDS = frozenset({"public_sponsor_signup_enabled"})
