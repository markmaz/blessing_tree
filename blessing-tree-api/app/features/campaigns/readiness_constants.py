from __future__ import annotations

READINESS_CATEGORY_BLOCKERS = "blockers"
READINESS_CATEGORY_LAUNCH_CHECKS = "launch_checks"
READINESS_CATEGORY_PLANNING_GAPS = "planning_gaps"
READINESS_CATEGORY_OPERATIONAL_HEALTH = "operational_health"

READINESS_CATEGORIES = (
    READINESS_CATEGORY_BLOCKERS,
    READINESS_CATEGORY_LAUNCH_CHECKS,
    READINESS_CATEGORY_PLANNING_GAPS,
    READINESS_CATEGORY_OPERATIONAL_HEALTH,
)

READINESS_PHASE_DRAFT = "draft"
READINESS_PHASE_ACTIVATE = "activate"
READINESS_PHASE_OPERATIONS = "operations"
READINESS_PHASE_CLOSE = "close"

READINESS_PHASES = (
    READINESS_PHASE_DRAFT,
    READINESS_PHASE_ACTIVATE,
    READINESS_PHASE_OPERATIONS,
    READINESS_PHASE_CLOSE,
)

SECTION_ACTION_LABELS = {
    "team": "Open Team",
    "communications": "Open Communications",
    "schedule": "Open Schedule",
    "readiness": "Open Readiness",
    "settings": "Open Settings",
    "sponsors": "Open Sponsors",
}
