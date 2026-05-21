from __future__ import annotations

from app.features.campaigns.readiness_constants import (
    READINESS_CATEGORIES,
    READINESS_CATEGORY_BLOCKERS,
    READINESS_CATEGORY_LAUNCH_CHECKS,
    READINESS_CATEGORY_OPERATIONAL_HEALTH,
    READINESS_CATEGORY_PLANNING_GAPS,
    READINESS_PHASE_ACTIVATE,
    READINESS_PHASE_CLOSE,
    READINESS_PHASE_DRAFT,
    READINESS_PHASE_OPERATIONS,
    READINESS_PHASES,
)
from app.features.campaigns.studio_constants import (
    READINESS_BLOCKED,
    READINESS_NEEDS_ATTENTION,
    READINESS_READY,
)
from app.features.campaigns.studio_readiness_rules import (
    build_automation_rules,
    build_communications_rules,
    build_lifecycle_rules,
    build_metadata_rules,
    build_schedule_rules,
    build_team_rules,
)


def build_campaign_readiness(
    campaign,
    *,
    assignments,
    role_counts,
    milestones,
    schedules,
    templates,
    manual_events,
    automation_snapshot: dict[str, object] | None = None,
) -> dict[str, object]:
    items = [
        *build_metadata_rules(campaign),
        *build_team_rules(assignments, role_counts),
        *build_schedule_rules(milestones, schedules, manual_events),
        *build_communications_rules(templates, schedules),
        *build_automation_rules(campaign, schedules, automation_snapshot or {}),
        *build_lifecycle_rules(campaign),
    ]

    groups = {category: [] for category in READINESS_CATEGORIES}
    for item in items:
        groups[str(item["category"])].append(item)

    phase_status = build_phase_status(items)
    overall_status = build_overall_status(items)

    return {
        "campaign_id": str(campaign.id),
        "status": overall_status,
        "overall_status": overall_status,
        "phase_status": phase_status,
        "items": items,
        "groups": groups,
        "counts": {
            "errors": sum(1 for item in items if item["severity"] == "error"),
            "warnings": sum(1 for item in items if item["severity"] == "warning"),
            "infos": sum(1 for item in items if item["severity"] == "info"),
        },
        "category_counts": {
            category: len(groups[category]) for category in READINESS_CATEGORIES
        },
    }


def build_phase_status(items: list[dict[str, object]]) -> dict[str, str]:
    return {
        phase: _phase_status(items, phase)
        for phase in READINESS_PHASES
    }


def build_overall_status(items: list[dict[str, object]]) -> str:
    severities = {str(item["severity"]) for item in items}
    if "error" in severities:
        return READINESS_BLOCKED
    if "warning" in severities or "info" in severities:
        return READINESS_NEEDS_ATTENTION
    return READINESS_READY


def _phase_status(items: list[dict[str, object]], phase: str) -> str:
    if any(
        item["severity"] == "error" and phase in item["blocking_for"]
        for item in items
    ):
        return READINESS_BLOCKED

    categories = _phase_categories(phase)
    if any(str(item["category"]) in categories for item in items):
        return READINESS_NEEDS_ATTENTION

    return READINESS_READY


def _phase_categories(phase: str) -> set[str]:
    if phase == READINESS_PHASE_DRAFT:
        return {
            READINESS_CATEGORY_BLOCKERS,
            READINESS_CATEGORY_PLANNING_GAPS,
        }
    if phase == READINESS_PHASE_ACTIVATE:
        return {
            READINESS_CATEGORY_BLOCKERS,
            READINESS_CATEGORY_LAUNCH_CHECKS,
        }
    if phase == READINESS_PHASE_OPERATIONS:
        return {
            READINESS_CATEGORY_BLOCKERS,
            READINESS_CATEGORY_OPERATIONAL_HEALTH,
        }
    if phase == READINESS_PHASE_CLOSE:
        return set()
    return set()
