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
    build_gift_reminder_rules,
    build_lifecycle_rules,
    build_metadata_rules,
    build_public_sponsor_rules,
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
    configured_items: list[dict[str, object]] | None = None,
    gift_reminder_rules=None,
) -> dict[str, object]:
    configured_items = configured_items or []
    configured_codes = {str(item.get("code")) for item in configured_items}
    schedule_items = build_schedule_rules(milestones, schedules, manual_events)
    if any(code.startswith("missing_required_milestone_") for code in configured_codes):
        schedule_items = [
            item
            for item in schedule_items
            if item.get("code") != "missing_milestones"
        ]
    public_sponsor_items = [
        item
        for item in build_public_sponsor_rules(campaign, milestones)
        if str(item.get("code")) not in configured_codes
    ]
    items = [
        *build_metadata_rules(campaign),
        *build_team_rules(assignments, role_counts),
        *schedule_items,
        *build_communications_rules(templates, schedules, milestones),
        *public_sponsor_items,
        *configured_items,
        *build_gift_reminder_rules(campaign, milestones, templates, gift_reminder_rules or []),
        *build_automation_rules(campaign, schedules, automation_snapshot or {}),
        *build_lifecycle_rules(campaign),
    ]
    items = _dedupe_missing_milestone_items(items)

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


def _dedupe_missing_milestone_items(items: list[dict[str, object]]) -> list[dict[str, object]]:
    severity_rank = {"error": 3, "warning": 2, "info": 1}
    highest_by_milestone: dict[str, int] = {}
    for item in items:
        milestone_key = _missing_milestone_key(item)
        if not milestone_key:
            continue
        highest_by_milestone[milestone_key] = max(
            highest_by_milestone.get(milestone_key, 0),
            severity_rank.get(str(item.get("severity")), 0),
        )

    deduped: list[dict[str, object]] = []
    for item in items:
        milestone_key = _missing_milestone_key(item)
        if milestone_key and severity_rank.get(str(item.get("severity")), 0) < highest_by_milestone[milestone_key]:
            continue
        deduped.append(item)
    return deduped


def _missing_milestone_key(item: dict[str, object]) -> str | None:
    details = item.get("details")
    if isinstance(details, dict) and details.get("rule_type") == "MISSING_MILESTONE":
        milestone_key = details.get("milestone_key")
        return str(milestone_key) if milestone_key else None
    code = str(item.get("code") or "")
    if code == "missing_milestones" or code.startswith("missing_required_milestone_"):
        return ""
    return None


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
