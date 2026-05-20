from __future__ import annotations

from datetime import date, datetime
from typing import Any

from app.features.campaigns.serializers import (
    serialize_campaign,
    serialize_campaign_access,
    serialize_campaign_summary,
)
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_milestone import CampaignMilestone
from app.models.communication_template import CommunicationTemplate


def serialize_campaign_assignment(assignment: CampaignUserRole) -> dict[str, Any]:
    return {
        "id": str(assignment.id),
        "campaign_id": str(assignment.campaign_id),
        "user_id": str(assignment.user_id),
        "role_key": assignment.role_key,
        "is_active": bool(assignment.is_active),
        "user": {
            "id": str(assignment.user.id),
            "email": assignment.user.email,
            "display_name": assignment.user.display_name,
            "app_role": assignment.user.role,
            "is_active": bool(assignment.user.is_active),
        },
        "created_at": _serialize_datetime(assignment.created_at),
        "updated_at": _serialize_datetime(assignment.updated_at),
    }


def serialize_team_snapshot(assignments: list[CampaignUserRole], counts: dict[str, Any]) -> dict[str, Any]:
    return {
        "assignments": [serialize_campaign_assignment(assignment) for assignment in assignments],
        "counts": counts,
    }


def serialize_communication_template(template: CommunicationTemplate) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "template_key": template.template_key,
        "name": template.name,
        "audience": template.audience,
        "channel": template.channel,
        "subject_template": template.subject_template,
        "body_template": template.body_template,
        "is_active": bool(template.is_active),
        "created_by_user_id": str(template.created_by_user_id) if template.created_by_user_id else None,
        "created_at": _serialize_datetime(template.created_at),
        "updated_at": _serialize_datetime(template.updated_at),
    }


def serialize_communication_schedule(schedule: CampaignCommunicationSchedule) -> dict[str, Any]:
    return {
        "id": str(schedule.id),
        "campaign_id": str(schedule.campaign_id),
        "template_id": str(schedule.template_id),
        "template": serialize_communication_template(schedule.template),
        "milestone_key": schedule.milestone_key,
        "scheduled_for": _serialize_datetime(schedule.scheduled_for),
        "status": schedule.status,
        "notes": schedule.notes,
        "created_at": _serialize_datetime(schedule.created_at),
        "updated_at": _serialize_datetime(schedule.updated_at),
    }


def serialize_milestone(milestone: CampaignMilestone) -> dict[str, Any]:
    return {
        "id": str(milestone.id),
        "campaign_id": str(milestone.campaign_id),
        "milestone_key": milestone.milestone_key,
        "label": milestone.label,
        "occurs_on": _serialize_date(milestone.occurs_on),
        "notes": milestone.notes,
        "sort_order": milestone.sort_order,
        "created_at": _serialize_datetime(milestone.created_at),
        "updated_at": _serialize_datetime(milestone.updated_at),
    }


def serialize_readiness(payload: dict[str, Any]) -> dict[str, Any]:
    return payload


def serialize_studio_payload(
    *,
    campaign,
    access: dict[str, Any],
    summary: dict[str, int],
    team: dict[str, Any],
    templates: list[CommunicationTemplate],
    schedules: list[CampaignCommunicationSchedule],
    milestones: list[CampaignMilestone],
    readiness: dict[str, Any],
) -> dict[str, Any]:
    return {
        "campaign": serialize_campaign(campaign),
        "access": serialize_campaign_access(**access),
        "summary": serialize_campaign_summary(str(campaign.id), summary),
        "team": serialize_team_snapshot(team["assignments"], team["counts"]),
        "communications": {
            "templates": [serialize_communication_template(template) for template in templates],
            "schedules": [serialize_communication_schedule(schedule) for schedule in schedules],
        },
        "milestones": [serialize_milestone(milestone) for milestone in milestones],
        "readiness": serialize_readiness(readiness),
    }


def _serialize_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
