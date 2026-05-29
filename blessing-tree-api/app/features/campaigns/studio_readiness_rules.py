from __future__ import annotations

from app.features.campaigns.readiness_constants import (
    READINESS_CATEGORY_BLOCKERS,
    READINESS_CATEGORY_LAUNCH_CHECKS,
    READINESS_CATEGORY_OPERATIONAL_HEALTH,
    READINESS_CATEGORY_PLANNING_GAPS,
    READINESS_PHASE_ACTIVATE,
    READINESS_PHASE_OPERATIONS,
    SECTION_ACTION_LABELS,
)
from app.features.campaigns.studio_constants import (
    COMMUNICATION_AUDIENCE_SPONSOR,
    PUBLIC_SPONSOR_REQUIRED_MILESTONE_KEYS,
    REQUIRED_MILESTONE_KEYS,
)
from app.features.rbac.constants import CAMPAIGN_MANAGER_ROLE


def build_metadata_rules(campaign) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []

    if not campaign.description:
        items.append(
            readiness_item(
                severity="warning",
                category=READINESS_CATEGORY_PLANNING_GAPS,
                code="missing_description",
                section="settings",
                message="Add a campaign description.",
                blocking_for=[READINESS_PHASE_ACTIVATE],
            )
        )

    if not campaign.start_date or not campaign.end_date:
        items.append(
            readiness_item(
                severity="error",
                category=READINESS_CATEGORY_BLOCKERS,
                code="missing_date_range",
                section="settings",
                message="Set the campaign start and end dates.",
                blocking_for=[READINESS_PHASE_ACTIVATE, READINESS_PHASE_OPERATIONS],
            )
        )

    return items


def build_team_rules(assignments, role_counts) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    active_assignments = [assignment for assignment in assignments if assignment.is_active]

    if role_counts.get(CAMPAIGN_MANAGER_ROLE, 0) == 0:
        items.append(
            readiness_item(
                severity="error",
                category=READINESS_CATEGORY_BLOCKERS,
                code="missing_manager",
                section="team",
                message="Assign at least one campaign manager.",
                blocking_for=[READINESS_PHASE_ACTIVATE, READINESS_PHASE_OPERATIONS],
            )
        )

    if not any(assignment.role_key != CAMPAIGN_MANAGER_ROLE for assignment in active_assignments):
        items.append(
            readiness_item(
                severity="warning",
                category=READINESS_CATEGORY_LAUNCH_CHECKS,
                code="missing_team_assignments",
                section="team",
                message="Add at least one non-manager campaign assignment.",
                blocking_for=[],
            )
        )

    return items


def build_schedule_rules(milestones, schedules, manual_events) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    milestone_keys = {milestone.milestone_key for milestone in milestones}
    missing_milestone_keys = sorted(REQUIRED_MILESTONE_KEYS - milestone_keys)
    active_schedules = [schedule for schedule in schedules if schedule.status != "DISABLED"]
    manual_events_with_dates = [
        event
        for event in manual_events
        if event.source_type == "manual" and event.start_at is not None
    ]
    milestone_keys_with_schedule = {
        schedule.milestone_key
        for schedule in active_schedules
        if schedule.milestone_key
    }
    milestone_keys_needing_schedule = sorted(
        milestone.milestone_key
        for milestone in milestones
        if milestone.milestone_key in REQUIRED_MILESTONE_KEYS
        and milestone.occurs_on is not None
        and milestone.milestone_key not in milestone_keys_with_schedule
    )

    if missing_milestone_keys:
        items.append(
            readiness_item(
                severity="warning",
                category=READINESS_CATEGORY_LAUNCH_CHECKS,
                code="missing_milestones",
                section="schedule",
                message="Add the remaining required milestone dates.",
                blocking_for=[READINESS_PHASE_ACTIVATE],
                details={"missing_keys": missing_milestone_keys},
            )
        )

    if not manual_events_with_dates:
        items.append(
            readiness_item(
                severity="warning",
                category=READINESS_CATEGORY_PLANNING_GAPS,
                code="missing_manual_schedule",
                section="schedule",
                message="Add at least one manual planning event to shape the campaign timeline.",
                blocking_for=[],
            )
        )

    if milestone_keys_needing_schedule:
        items.append(
            readiness_item(
                severity="warning",
                category=READINESS_CATEGORY_LAUNCH_CHECKS,
                code="missing_schedule_messaging",
                section="schedule",
                message="Add communication timing for the key milestones already on the calendar.",
                blocking_for=[READINESS_PHASE_ACTIVATE],
                details={"missing_keys": milestone_keys_needing_schedule},
            )
        )

    return items


def build_communications_rules(templates, schedules, milestones) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    active_templates = [template for template in templates if template.is_active]
    active_schedules = [schedule for schedule in schedules if schedule.status != "DISABLED"]
    milestone_keys = {milestone.milestone_key for milestone in milestones}

    if not active_templates:
        items.append(
            readiness_item(
                severity="warning",
                category=READINESS_CATEGORY_LAUNCH_CHECKS,
                code="missing_templates",
                section="communications",
                message="Create at least one active communication template.",
                blocking_for=[READINESS_PHASE_ACTIVATE],
            )
        )

    if not active_schedules:
        items.append(
            readiness_item(
                severity="warning",
                category=READINESS_CATEGORY_LAUNCH_CHECKS,
                code="missing_schedules",
                section="communications",
                message="Add at least one campaign communication schedule.",
                blocking_for=[READINESS_PHASE_ACTIVATE],
            )
        )

    sponsor_due_templates = [
        template
        for template in active_templates
        if template.audience == COMMUNICATION_AUDIENCE_SPONSOR
        and _template_references_field(template, "gift.due_date")
    ]
    if sponsor_due_templates and "gift_turn_in_due" not in milestone_keys:
        items.append(
            readiness_item(
                severity="error",
                category=READINESS_CATEGORY_BLOCKERS,
                code="missing_gift_turn_in_due_milestone",
                section="schedule",
                message="Sponsor gift due-date communications need a Gift Turn-In Due milestone.",
                blocking_for=[READINESS_PHASE_ACTIVATE, READINESS_PHASE_OPERATIONS],
                details={
                    "missing_key": "gift_turn_in_due",
                    "template_ids": [str(template.id) for template in sponsor_due_templates],
                },
            )
        )

    return items


def _template_references_field(template, field_name: str) -> bool:
    marker = "{{"
    values = [template.subject_template or "", template.body_template or ""]
    return any(marker in value and field_name in value for value in values)


def build_automation_rules(campaign, schedules, automation_snapshot: dict[str, object]) -> list[dict[str, object]]:
    active_schedules = [schedule for schedule in schedules if schedule.status != "DISABLED"]
    if not active_schedules:
        return []

    is_active_campaign = campaign.status == "ACTIVE"
    worker_healthy = bool(automation_snapshot.get("worker_healthy"))
    recent_issue_count = int(automation_snapshot.get("recent_issue_count") or 0)
    category = (
        READINESS_CATEGORY_OPERATIONAL_HEALTH
        if is_active_campaign
        else READINESS_CATEGORY_LAUNCH_CHECKS
    )
    blocking_for = (
        [READINESS_PHASE_OPERATIONS]
        if is_active_campaign
        else [READINESS_PHASE_ACTIVATE]
    )

    items: list[dict[str, object]] = []
    if not worker_healthy:
        items.append(
            readiness_item(
                severity="warning",
                category=category,
                code="automation_worker_unavailable",
                section="readiness",
                message=(
                    "Scheduled communications exist, but the automation worker is not currently healthy."
                    if is_active_campaign
                    else "Scheduled communications will not deliver automatically until the automation worker is running."
                ),
                blocking_for=blocking_for,
            )
        )

    if recent_issue_count > 0:
        items.append(
            readiness_item(
                severity="warning",
                category=READINESS_CATEGORY_OPERATIONAL_HEALTH,
                code="automation_recent_failures",
                section="readiness",
                message="Automation has recent blocked or failed executions that should be reviewed.",
                blocking_for=[READINESS_PHASE_OPERATIONS],
                details={"issue_count": recent_issue_count},
            )
        )

    return items


def build_lifecycle_rules(campaign) -> list[dict[str, object]]:
    if campaign.status != "DRAFT":
        return []

    return [
        readiness_item(
            severity="info",
            category=READINESS_CATEGORY_PLANNING_GAPS,
            code="campaign_in_draft",
            section="settings",
            message="Campaign is still in draft status.",
            blocking_for=[],
        )
    ]


def build_public_sponsor_rules(campaign, milestones) -> list[dict[str, object]]:
    if not getattr(campaign, "public_sponsor_signup_enabled", False):
        return []

    milestone_keys = {milestone.milestone_key for milestone in milestones}
    missing_definitions = [
        (
            "sponsor_registration_start",
            "missing_public_sponsor_registration_start",
            "Public sponsor signup is enabled, but the sponsor registration start milestone is missing.",
        ),
        (
            "sponsor_registration_end",
            "missing_public_sponsor_registration_end",
            "Public sponsor signup is enabled, but the sponsor registration end milestone is missing.",
        ),
        (
            "gift_intake_end",
            "missing_public_sponsor_gift_turn_in",
            "Public sponsor signup is enabled, but the gift turn-in deadline milestone is missing.",
        ),
    ]

    return [
        readiness_item(
            severity="error",
            category=READINESS_CATEGORY_BLOCKERS,
            code=code,
            section="schedule",
            message=message,
            blocking_for=[READINESS_PHASE_ACTIVATE, READINESS_PHASE_OPERATIONS],
            details={"missing_key": key},
        )
        for key, code, message in missing_definitions
        if key in PUBLIC_SPONSOR_REQUIRED_MILESTONE_KEYS and key not in milestone_keys
    ]


def build_gift_reminder_rules(campaign, milestones, templates, reminder_rules) -> list[dict[str, object]]:
    enabled_rules = [rule for rule in reminder_rules if rule.is_enabled]
    if not enabled_rules:
        return []

    milestone_keys = {milestone.milestone_key for milestone in milestones}
    active_template_ids = {template.id for template in templates if template.is_active}
    category = (
        READINESS_CATEGORY_OPERATIONAL_HEALTH
        if campaign.status == "ACTIVE"
        else READINESS_CATEGORY_LAUNCH_CHECKS
    )
    blocking_for = (
        [READINESS_PHASE_OPERATIONS]
        if campaign.status == "ACTIVE"
        else [READINESS_PHASE_ACTIVATE]
    )

    items: list[dict[str, object]] = []
    for rule in enabled_rules:
        if not rule.template_id or rule.template_id not in active_template_ids:
            items.append(
                readiness_item(
                    severity="warning",
                    category=category,
                    code="missing_gift_reminder_template",
                    section="communications",
                    message=f"Gift reminder rule '{rule.label}' needs an active sponsor email template.",
                    blocking_for=blocking_for,
                    details={"rule_id": str(rule.id), "rule_key": rule.rule_key},
                )
            )
        if not rule.milestone_key or rule.milestone_key not in milestone_keys:
            items.append(
                readiness_item(
                    severity="warning",
                    category=category,
                    code="missing_gift_reminder_milestone",
                    section="schedule",
                    message=f"Gift reminder rule '{rule.label}' needs a valid campaign milestone.",
                    blocking_for=blocking_for,
                    details={
                        "rule_id": str(rule.id),
                        "rule_key": rule.rule_key,
                        "milestone_key": rule.milestone_key,
                    },
                )
            )
    return items


def readiness_item(
    *,
    severity: str,
    category: str,
    code: str,
    section: str,
    message: str,
    blocking_for: list[str],
    details: dict[str, object] | None = None,
) -> dict[str, object]:
    return {
        "severity": severity,
        "category": category,
        "code": code,
        "section": section,
        "message": message,
        "action_label": SECTION_ACTION_LABELS.get(section, "Open Settings"),
        "blocking_for": blocking_for,
        "details": details or {},
    }
