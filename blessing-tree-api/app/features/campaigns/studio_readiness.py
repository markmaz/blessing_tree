from __future__ import annotations

from app.features.campaigns.studio_constants import (
    READINESS_BLOCKED,
    READINESS_NEEDS_ATTENTION,
    READINESS_READY,
    REQUIRED_MILESTONE_KEYS,
)
from app.features.rbac.constants import CAMPAIGN_MANAGER_ROLE


def build_campaign_readiness(
    campaign,
    *,
    assignments,
    role_counts,
    milestones,
    schedules,
    templates,
) -> dict[str, object]:
    items: list[dict[str, object]] = []
    active_assignments = [assignment for assignment in assignments if assignment.is_active]
    milestone_keys = {milestone.milestone_key for milestone in milestones}
    missing_milestone_keys = sorted(REQUIRED_MILESTONE_KEYS - milestone_keys)
    active_schedules = [schedule for schedule in schedules if schedule.status != "DISABLED"]
    active_templates = [template for template in templates if template.is_active]

    if not campaign.description:
        items.append(_readiness_item("warning", "missing_description", "settings", "Add a campaign description."))
    if not campaign.start_date or not campaign.end_date:
        items.append(_readiness_item("warning", "missing_date_range", "settings", "Set the campaign start and end dates."))
    if role_counts.get(CAMPAIGN_MANAGER_ROLE, 0) == 0:
        items.append(_readiness_item("error", "missing_manager", "team", "Assign at least one campaign manager."))
    if not any(assignment.role_key != CAMPAIGN_MANAGER_ROLE for assignment in active_assignments):
        items.append(
            _readiness_item(
                "warning",
                "missing_team_assignments",
                "team",
                "Add at least one non-manager campaign assignment.",
            )
        )
    if missing_milestone_keys:
        items.append(
            _readiness_item(
                "warning",
                "missing_milestones",
                "dates",
                "Add the remaining required milestone dates.",
                details={"missing_keys": missing_milestone_keys},
            )
        )
    if not active_templates:
        items.append(
            _readiness_item(
                "warning",
                "missing_templates",
                "communications",
                "Create at least one active communication template.",
            )
        )
    if not active_schedules:
        items.append(
            _readiness_item(
                "warning",
                "missing_schedules",
                "communications",
                "Add at least one campaign communication schedule.",
            )
        )
    if campaign.status == "DRAFT":
        items.append(_readiness_item("info", "campaign_in_draft", "settings", "Campaign is still in draft status."))

    return {
        "campaign_id": str(campaign.id),
        "status": _readiness_status(items),
        "items": items,
        "counts": {
            "errors": sum(1 for item in items if item["severity"] == "error"),
            "warnings": sum(1 for item in items if item["severity"] == "warning"),
            "infos": sum(1 for item in items if item["severity"] == "info"),
        },
    }


def _readiness_item(
    severity: str,
    code: str,
    section: str,
    message: str,
    *,
    details: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "severity": severity,
        "code": code,
        "section": section,
        "message": message,
        "details": details or {},
    }


def _readiness_status(items: list[dict[str, object]]) -> str:
    severities = {str(item["severity"]) for item in items}
    if "error" in severities:
        return READINESS_BLOCKED
    if "warning" in severities or "info" in severities:
        return READINESS_NEEDS_ATTENTION
    return READINESS_READY
