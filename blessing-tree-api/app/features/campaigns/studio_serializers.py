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
from app.models.campaign_event import CampaignEvent
from app.models.campaign_flyer import CampaignFlyer
from app.models.campaign_gift_policy import CampaignGiftPolicy
from app.models.campaign_milestone import CampaignMilestone
from app.models.campaign_milestone_definition import CampaignMilestoneDefinition
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


def serialize_directory_user(payload: dict[str, Any]) -> dict[str, Any]:
    return payload


def serialize_communication_template(template: CommunicationTemplate) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "campaign_id": str(template.campaign_id),
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


def serialize_campaign_flyer(flyer: CampaignFlyer) -> dict[str, Any]:
    return {
        "id": str(flyer.id),
        "campaign_id": str(flyer.campaign_id),
        "flyer_key": flyer.flyer_key,
        "name": flyer.name,
        "flyer_type": flyer.flyer_type,
        "headline": flyer.headline,
        "subheadline": flyer.subheadline,
        "body_text": flyer.body_text,
        "call_to_action": flyer.call_to_action,
        "contact_info": flyer.contact_info,
        "qr_target_type": flyer.qr_target_type,
        "qr_custom_url": flyer.qr_custom_url,
        "theme_mode": flyer.theme_mode,
        "image_prompt": flyer.image_prompt,
        "layout_json": flyer.layout_json or {},
        "is_active": bool(flyer.is_active),
        "created_by_user_id": str(flyer.created_by_user_id) if flyer.created_by_user_id else None,
        "created_at": _serialize_datetime(flyer.created_at),
        "updated_at": _serialize_datetime(flyer.updated_at),
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


def serialize_campaign_event(event: CampaignEvent) -> dict[str, Any]:
    return {
        "id": str(event.id),
        "campaign_id": str(event.campaign_id),
        "title": event.title,
        "event_type": event.event_type,
        "start_at": _serialize_datetime(event.start_at),
        "end_at": _serialize_datetime(event.end_at),
        "all_day": bool(event.all_day),
        "notes": event.notes,
        "source_type": event.source_type,
        "source_id": str(event.source_id) if event.source_id else None,
        "created_by_user_id": str(event.created_by_user_id) if event.created_by_user_id else None,
        "created_at": _serialize_datetime(event.created_at),
        "updated_at": _serialize_datetime(event.updated_at),
    }


def serialize_schedule_item(payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(payload.get("id")),
        "title": payload.get("title"),
        "event_type": payload.get("event_type"),
        "source_type": payload.get("source_type"),
        "source_id": str(payload["source_id"]) if payload.get("source_id") is not None else None,
        "start_at": _serialize_datetime(payload.get("start_at")),
        "end_at": _serialize_datetime(payload.get("end_at")),
        "all_day": bool(payload.get("all_day")),
        "notes": payload.get("notes"),
        "is_editable": bool(payload.get("is_editable")),
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


def serialize_milestone_definition(definition: CampaignMilestoneDefinition) -> dict[str, Any]:
    return {
        "id": str(definition.id) if definition.id else None,
        "milestone_key": definition.milestone_key,
        "label": definition.label,
        "description": definition.description,
        "feature_area": definition.feature_area,
        "default_sort_order": definition.default_sort_order,
        "is_active": bool(definition.is_active),
        "is_system": bool(definition.is_system),
        "created_at": _serialize_datetime(definition.created_at),
        "updated_at": _serialize_datetime(definition.updated_at),
    }


def serialize_readiness(payload: dict[str, Any]) -> dict[str, Any]:
    return payload


def serialize_gift_policy(policy: CampaignGiftPolicy) -> dict[str, Any]:
    return {
        "id": str(policy.id),
        "campaign_id": str(policy.campaign_id),
        "max_gifts_per_sponsor": policy.max_gifts_per_sponsor,
        "max_wishlist_items_per_recipient": policy.max_wishlist_items_per_recipient,
        "recipient_coverage_rule": policy.recipient_coverage_rule,
        "recipient_coverage_required_count": policy.recipient_coverage_required_count,
        "allow_partial_sponsor_commitments": bool(policy.allow_partial_sponsor_commitments),
        "reservation_hold_minutes": policy.reservation_hold_minutes,
        "created_at": _serialize_datetime(policy.created_at),
        "updated_at": _serialize_datetime(policy.updated_at),
    }


def serialize_ai_draft(payload: dict[str, Any]) -> dict[str, Any]:
    return payload


def serialize_studio_payload(
    *,
    campaign,
    access: dict[str, Any],
    summary: dict[str, int],
    team: dict[str, Any],
    templates: list[CommunicationTemplate],
    schedules: list[CampaignCommunicationSchedule],
    audience_catalog: list[dict[str, str]],
    milestones: list[CampaignMilestone],
    milestone_definitions: list[CampaignMilestoneDefinition],
    gift_policy: CampaignGiftPolicy,
    schedule_items: list[dict[str, Any]],
    readiness: dict[str, Any],
) -> dict[str, Any]:
    return {
        "campaign": serialize_campaign(campaign),
        "access": serialize_campaign_access(**access),
        "summary": serialize_campaign_summary(str(campaign.id), summary),
        "team": serialize_team_snapshot(team["assignments"], team["counts"]),
        "communications": {
            "audience_catalog": audience_catalog,
            "templates": [serialize_communication_template(template) for template in templates],
            "schedules": [serialize_communication_schedule(schedule) for schedule in schedules],
        },
        "schedule": {
            "items": [serialize_schedule_item(item) for item in schedule_items],
        },
        "milestone_definitions": [
            serialize_milestone_definition(definition)
            for definition in milestone_definitions
        ],
        "milestones": [serialize_milestone(milestone) for milestone in milestones],
        "gift_policy": serialize_gift_policy(gift_policy),
        "readiness": serialize_readiness(readiness),
    }


def _serialize_date(value: date | None) -> str | None:
    return value.isoformat() if value else None


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
