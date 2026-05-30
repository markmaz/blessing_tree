from __future__ import annotations

import hashlib

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.admin.audit_service import AuditEventService, build_changes
from app.features.campaigns import campaign_ns
from app.features.campaigns.studio_serializers import (
    serialize_ai_draft,
    serialize_campaign_event,
    serialize_campaign_assignment,
    serialize_calendar_intelligence,
    serialize_campaign_flyer,
    serialize_communication_schedule,
    serialize_communication_template,
    serialize_directory_user,
    serialize_gift_policy,
    serialize_milestone,
    serialize_readiness,
    serialize_schedule_item,
    serialize_studio_payload,
    serialize_team_snapshot,
)
from app.features.campaigns.ai_draft_service import CampaignStudioAiDraftService
from app.features.campaigns.calendar_intelligence_service import CampaignCalendarIntelligenceService
from app.features.campaigns.communication_send_service import CampaignCommunicationSendService
from app.features.campaigns.flyer_service import CampaignFlyerService
from app.features.campaigns.gift_policy_service import CampaignGiftPolicyService
from app.features.campaigns.studio_schedule_service import CampaignStudioScheduleService
from app.features.campaigns.studio_service import CampaignStudioService
from app.features.campaigns.studio_team_service import CampaignStudioTeamService
from app.features.rbac.decorators import require_campaign_capability

_studio_service = CampaignStudioService()
_schedule_service = CampaignStudioScheduleService()
_team_service = CampaignStudioTeamService()
_ai_draft_service = CampaignStudioAiDraftService()
_gift_policy_service = CampaignGiftPolicyService()
_flyer_service = CampaignFlyerService()
_communication_send_service = CampaignCommunicationSendService()
_calendar_intelligence_service = CampaignCalendarIntelligenceService()
_audit_event_service = AuditEventService()

TEMPLATE_FIELD_MAP = {
    "template_key": "Template Key",
    "name": "Name",
    "audience": "Audience",
    "channel": "Channel",
    "subject_template": "Subject",
    "body_changed": "Body Content",
    "is_active": "Active",
}

SCHEDULE_FIELD_MAP = {
    "template_id": "Template",
    "milestone_key": "Milestone",
    "scheduled_for": "Scheduled For",
    "status": "Status",
    "notes": "Notes",
}

FLYER_FIELD_MAP = {
    "flyer_key": "Flyer Key",
    "name": "Name",
    "flyer_type": "Flyer Type",
    "headline": "Headline",
    "subheadline": "Subheadline",
    "body_changed": "Body Content",
    "call_to_action": "Call To Action",
    "contact_info": "Contact Info",
    "qr_target_type": "QR Target",
    "qr_custom_url": "QR Custom URL",
    "theme_mode": "Theme Mode",
    "image_prompt": "Image Prompt",
    "layout_changed": "Layout",
    "is_active": "Active",
}

EVENT_FIELD_MAP = {
    "title": "Title",
    "event_type": "Event Type",
    "start_at": "Start",
    "end_at": "End",
    "all_day": "All Day",
    "notes": "Notes",
}

MILESTONE_SET_FIELD_MAP = {
    "milestones": "Milestones",
}

GIFT_POLICY_FIELD_MAP = {
    "max_gifts_per_sponsor": "Max Gifts Per Sponsor",
    "max_wishlist_items_per_recipient": "Max Wishlist Gifts Per Recipient",
    "recipient_coverage_rule": "Fulfillment Rule",
    "recipient_coverage_required_count": "Required Sponsored Gift Count",
    "allow_partial_sponsor_commitments": "Allow Partial Sponsor Commitments",
    "reservation_hold_minutes": "Reservation Hold Minutes",
}


@campaign_ns.route("/<string:campaign_id>/studio")
class CampaignStudioResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _studio_service.get_studio_payload(db, getattr(g, "user_id"), campaign_id)
        return serialize_studio_payload(**payload)


@campaign_ns.route("/<string:campaign_id>/assignments")
class CampaignAssignmentListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            snapshot = _team_service.get_team_snapshot(db, campaign_id)
        return serialize_team_snapshot(snapshot["assignments"], snapshot["counts"])

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            assignment = _team_service.create_assignment(db, campaign_id, payload)
        return serialize_campaign_assignment(assignment), 201


@campaign_ns.route("/<string:campaign_id>/directory-users")
class CampaignDirectoryUserListResource(Resource):
    @require_campaign_capability("campaign.admin")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            users = _team_service.search_directory_users(
                db,
                campaign_id,
                search=request.args.get("search"),
                limit=_parse_limit(request.args.get("limit")),
            )
        return [serialize_directory_user(user) for user in users]


@campaign_ns.route("/<string:campaign_id>/assignments/<string:assignment_id>")
class CampaignAssignmentDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, assignment_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            assignment = _team_service.update_assignment(db, campaign_id, assignment_id, payload)
        return serialize_campaign_assignment(assignment)


@campaign_ns.route("/<string:campaign_id>/communications/templates")
class CommunicationTemplateListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            templates = _studio_service.list_templates(db, campaign_id)
        return [serialize_communication_template(template) for template in templates]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            template = _studio_service.create_template(db, getattr(g, "user_id"), campaign_id, payload)
            response = serialize_communication_template(template)
            _record_audit_event(
                db,
                area="communications",
                action="created",
                entity_type="communication_template",
                entity_id=template.id,
                entity_label=template.name,
                campaign_id=campaign_id,
                summary=f"Created communication template {template.name}.",
                changes=build_changes(before={}, after=_snapshot_template(template), field_map=TEMPLATE_FIELD_MAP),
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/communications/templates/<string:template_id>")
class CommunicationTemplateDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, template_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _snapshot_template(_studio_service._get_template(db, campaign_id, template_id))
            template = _studio_service.update_template(db, campaign_id, template_id, payload)
            response = serialize_communication_template(template)
            _record_audit_event(
                db,
                area="communications",
                action="updated",
                entity_type="communication_template",
                entity_id=template.id,
                entity_label=template.name,
                campaign_id=campaign_id,
                summary=f"Updated communication template {template.name}.",
                changes=build_changes(before=before, after=_snapshot_template(template), field_map=TEMPLATE_FIELD_MAP),
            )
        return response

    @require_campaign_capability("campaign.admin")
    def delete(self, campaign_id: str, template_id: str):
        with SessionLocal() as db:
            before = _snapshot_template(_studio_service._get_template(db, campaign_id, template_id))
            _studio_service.delete_template(db, campaign_id, template_id)
            _record_audit_event(
                db,
                area="communications",
                action="deleted",
                entity_type="communication_template",
                entity_id=template_id,
                entity_label=str(before.get("name") or template_id),
                campaign_id=campaign_id,
                summary=f"Deleted communication template {before.get('name') or template_id}.",
                metadata={"previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/communications/templates/<string:template_id>/test-email")
class CommunicationTemplateTestEmailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str, template_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            result = _studio_service.send_template_test_email(
                db,
                campaign_id=campaign_id,
                template_id=template_id,
                user_id=str(getattr(g, "user_id")),
                recipient_email=payload.get("recipient_email"),
            )
            _record_audit_event(
                db,
                area="communications",
                action="sent",
                entity_type="communication_template_test",
                entity_id=template_id,
                entity_label=str(result.get("subject") or "Test email"),
                campaign_id=campaign_id,
                summary=f"Sent test email for communication template to {result.get('recipient_email')}.",
                metadata={"recipient_email": result.get("recipient_email"), "subject": result.get("subject")},
            )
        return result, 200


@campaign_ns.route("/<string:campaign_id>/communications/send")
class CommunicationSendResource(Resource):
    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            result = _communication_send_service.send_campaign_template(
                db,
                campaign_id=campaign_id,
                template_id=str(payload.get("template_id") or ""),
                target_mode=str(payload.get("target_mode") or "AUDIENCE"),
                manual_recipients=payload.get("manual_recipients") or [],
                team_ids=[str(value) for value in payload.get("team_ids") or []],
                sponsor_ids=[str(value) for value in payload.get("sponsor_ids") or []],
                member_ids=[str(value) for value in payload.get("member_ids") or []],
                contact_ids=[str(value) for value in payload.get("contact_ids") or []],
                created_by_user_id=getattr(g, "user_id", None),
            )
            _record_audit_event(
                db,
                area="communications",
                action="sent",
                entity_type="campaign_communication_send",
                entity_id=result.get("send_id") or result.get("id"),
                entity_label="Campaign communication",
                campaign_id=campaign_id,
                summary="Sent a campaign communication.",
                metadata={
                    "template_id": str(payload.get("template_id") or ""),
                    "target_mode": str(payload.get("target_mode") or "AUDIENCE"),
                    "recipient_count": result.get("recipient_count"),
                },
            )
        return result, 200


@campaign_ns.route("/<string:campaign_id>/flyers")
class CampaignFlyerListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            flyers = _flyer_service.list_flyers(db, campaign_id)
        return [serialize_campaign_flyer(flyer) for flyer in flyers]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            flyer = _flyer_service.create_flyer(db, getattr(g, "user_id"), campaign_id, payload)
            response = serialize_campaign_flyer(flyer)
            _record_audit_event(
                db,
                area="templates",
                action="created",
                entity_type="campaign_flyer",
                entity_id=flyer.id,
                entity_label=flyer.name,
                campaign_id=campaign_id,
                summary=f"Created flyer {flyer.name}.",
                changes=build_changes(before={}, after=_snapshot_flyer(flyer), field_map=FLYER_FIELD_MAP),
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/flyers/<string:flyer_id>")
class CampaignFlyerDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, flyer_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _snapshot_flyer(_flyer_service._get_flyer(db, campaign_id, flyer_id))
            flyer = _flyer_service.update_flyer(db, campaign_id, flyer_id, payload)
            response = serialize_campaign_flyer(flyer)
            _record_audit_event(
                db,
                area="templates",
                action="updated",
                entity_type="campaign_flyer",
                entity_id=flyer.id,
                entity_label=flyer.name,
                campaign_id=campaign_id,
                summary=f"Updated flyer {flyer.name}.",
                changes=build_changes(before=before, after=_snapshot_flyer(flyer), field_map=FLYER_FIELD_MAP),
            )
        return response

    @require_campaign_capability("campaign.admin")
    def delete(self, campaign_id: str, flyer_id: str):
        with SessionLocal() as db:
            before = _snapshot_flyer(_flyer_service._get_flyer(db, campaign_id, flyer_id))
            _flyer_service.delete_flyer(db, campaign_id, flyer_id)
            _record_audit_event(
                db,
                area="templates",
                action="deleted",
                entity_type="campaign_flyer",
                entity_id=flyer_id,
                entity_label=str(before.get("name") or flyer_id),
                campaign_id=campaign_id,
                summary=f"Deleted flyer {before.get('name') or flyer_id}.",
                metadata={"previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/communications/schedules")
class CommunicationScheduleListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            schedules = _studio_service.list_schedules(db, campaign_id)
        return [serialize_communication_schedule(schedule) for schedule in schedules]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            schedule = _studio_service.create_schedule(db, campaign_id, payload)
            response = serialize_communication_schedule(schedule)
            _record_audit_event(
                db,
                area="communications",
                action="scheduled" if schedule.status == "SCHEDULED" else "created",
                entity_type="communication_schedule",
                entity_id=schedule.id,
                entity_label=schedule.template.name if schedule.template else "Communication schedule",
                campaign_id=campaign_id,
                summary=f"Created communication schedule for {schedule.template.name if schedule.template else 'template'}.",
                changes=build_changes(before={}, after=_snapshot_schedule(schedule), field_map=SCHEDULE_FIELD_MAP),
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/communications/schedules/<string:schedule_id>")
class CommunicationScheduleDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, schedule_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _snapshot_schedule(_studio_service._get_schedule(db, campaign_id, schedule_id))
            schedule = _studio_service.update_schedule(db, campaign_id, schedule_id, payload)
            response = serialize_communication_schedule(schedule)
            _record_audit_event(
                db,
                area="communications",
                action="scheduled" if schedule.status == "SCHEDULED" else "updated",
                entity_type="communication_schedule",
                entity_id=schedule.id,
                entity_label=schedule.template.name if schedule.template else "Communication schedule",
                campaign_id=campaign_id,
                summary=f"Updated communication schedule for {schedule.template.name if schedule.template else 'template'}.",
                changes=build_changes(before=before, after=_snapshot_schedule(schedule), field_map=SCHEDULE_FIELD_MAP),
            )
        return response

    @require_campaign_capability("campaign.admin")
    def delete(self, campaign_id: str, schedule_id: str):
        with SessionLocal() as db:
            before = _snapshot_schedule(_studio_service._get_schedule(db, campaign_id, schedule_id))
            _studio_service.delete_schedule(db, campaign_id, schedule_id)
            _record_audit_event(
                db,
                area="communications",
                action="deleted",
                entity_type="communication_schedule",
                entity_id=schedule_id,
                entity_label=str(before.get("template_name") or schedule_id),
                campaign_id=campaign_id,
                summary=f"Deleted communication schedule for {before.get('template_name') or schedule_id}.",
                metadata={"previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/schedule")
class CampaignScheduleResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            items = _schedule_service.list_schedule_items(db, campaign_id)
        return {
            "campaign_id": campaign_id,
            "items": [serialize_schedule_item(item) for item in items],
        }


@campaign_ns.route("/<string:campaign_id>/calendar-intelligence")
class CampaignCalendarIntelligenceResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _calendar_intelligence_service.get_calendar_intelligence(db, campaign_id)
        return serialize_calendar_intelligence(payload)


@campaign_ns.route("/<string:campaign_id>/events")
class CampaignEventListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            events = _schedule_service.list_events(db, campaign_id)
        return [serialize_campaign_event(event) for event in events]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            event = _schedule_service.create_event(db, getattr(g, "user_id"), campaign_id, payload)
            response = serialize_campaign_event(event)
            _record_audit_event(
                db,
                area="campaigns",
                action="created",
                entity_type="campaign_event",
                entity_id=event.id,
                entity_label=event.title,
                campaign_id=campaign_id,
                summary=f"Created calendar event {event.title}.",
                changes=build_changes(before={}, after=_snapshot_event(event), field_map=EVENT_FIELD_MAP),
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/events/<string:event_id>")
class CampaignEventDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, event_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _snapshot_event(_schedule_service._get_event(db, campaign_id, event_id))
            event = _schedule_service.update_event(db, campaign_id, event_id, payload)
            response = serialize_campaign_event(event)
            _record_audit_event(
                db,
                area="campaigns",
                action="updated",
                entity_type="campaign_event",
                entity_id=event.id,
                entity_label=event.title,
                campaign_id=campaign_id,
                summary=f"Updated calendar event {event.title}.",
                changes=build_changes(before=before, after=_snapshot_event(event), field_map=EVENT_FIELD_MAP),
            )
        return response

    @require_campaign_capability("campaign.admin")
    def delete(self, campaign_id: str, event_id: str):
        with SessionLocal() as db:
            before = _snapshot_event(_schedule_service._get_event(db, campaign_id, event_id))
            _schedule_service.delete_event(db, campaign_id, event_id)
            _record_audit_event(
                db,
                area="campaigns",
                action="deleted",
                entity_type="campaign_event",
                entity_id=event_id,
                entity_label=str(before.get("title") or event_id),
                campaign_id=campaign_id,
                summary=f"Deleted calendar event {before.get('title') or event_id}.",
                metadata={"previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/milestones")
class CampaignMilestoneListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            milestones = _studio_service.list_milestones(db, campaign_id)
        return [serialize_milestone(milestone) for milestone in milestones]

    @require_campaign_capability("campaign.admin")
    def put(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = {"milestones": _milestone_summary(_studio_service.list_milestones(db, campaign_id))}
            milestones = _studio_service.replace_milestones(db, campaign_id, payload)
            response = [serialize_milestone(milestone) for milestone in milestones]
            after = {"milestones": _milestone_summary(milestones)}
            _record_audit_event(
                db,
                area="campaigns",
                action="updated",
                entity_type="campaign_milestones",
                entity_id=campaign_id,
                entity_label="Campaign milestones",
                campaign_id=campaign_id,
                summary="Updated campaign milestones.",
                changes=build_changes(before=before, after=after, field_map=MILESTONE_SET_FIELD_MAP),
            )
        return response


@campaign_ns.route("/<string:campaign_id>/readiness")
class CampaignReadinessResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            readiness = _studio_service.get_readiness(db, campaign_id)
        return serialize_readiness(readiness)


@campaign_ns.route("/<string:campaign_id>/gift-policy")
class CampaignGiftPolicyResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            policy = _gift_policy_service.get_policy(db, campaign_id)
            db.commit()
        return serialize_gift_policy(policy)

    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _snapshot_gift_policy(_gift_policy_service.get_policy(db, campaign_id))
            policy = _gift_policy_service.update_policy(db, campaign_id, payload)
            response = serialize_gift_policy(policy)
            _record_audit_event(
                db,
                area="campaigns",
                action="updated",
                entity_type="campaign_gift_policy",
                entity_id=policy.id,
                entity_label="Gift policy",
                campaign_id=campaign_id,
                summary="Updated campaign gift policy.",
                changes=build_changes(before=before, after=_snapshot_gift_policy(policy), field_map=GIFT_POLICY_FIELD_MAP),
            )
        return response


@campaign_ns.route("/<string:campaign_id>/ai/draft")
class CampaignAiDraftResource(Resource):
    @require_campaign_capability("campaign.view")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            draft = _ai_draft_service.draft(
                db,
                user_id=str(getattr(g, "user_id")),
                campaign_id=campaign_id,
                payload=payload,
            )
        return serialize_ai_draft(draft)


def _parse_limit(value: str | None) -> int:
    try:
        return int(value or "10")
    except ValueError:
        return 10


def _actor_user_id() -> str | None:
    user_id = getattr(g, "user_id", None)
    return str(user_id) if user_id else None


def _record_audit_event(
    db,
    *,
    area: str,
    action: str,
    entity_type: str,
    entity_id: object | None,
    entity_label: str,
    campaign_id: str,
    summary: str,
    changes: list[dict[str, object]] | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    _audit_event_service.record_event(
        db,
        area=area,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        campaign_id=campaign_id,
        actor_user_id=_actor_user_id(),
        summary=summary,
        changes=changes,
        metadata=metadata,
    )
    db.commit()


def _snapshot_template(template) -> dict[str, object]:
    return {
        "template_key": template.template_key,
        "name": template.name,
        "audience": template.audience,
        "channel": template.channel,
        "subject_template": template.subject_template,
        "body_changed": _content_marker(template.body_template),
        "body_length": len(template.body_template or ""),
        "is_active": bool(template.is_active),
    }


def _snapshot_schedule(schedule) -> dict[str, object]:
    return {
        "template_id": str(schedule.template_id),
        "template_name": schedule.template.name if schedule.template else None,
        "milestone_key": schedule.milestone_key,
        "scheduled_for": schedule.scheduled_for.isoformat() if schedule.scheduled_for else None,
        "status": schedule.status,
        "notes": schedule.notes,
    }


def _snapshot_flyer(flyer) -> dict[str, object]:
    return {
        "flyer_key": flyer.flyer_key,
        "name": flyer.name,
        "flyer_type": flyer.flyer_type,
        "headline": flyer.headline,
        "subheadline": flyer.subheadline,
        "body_changed": _content_marker(flyer.body_text),
        "body_length": len(flyer.body_text or ""),
        "call_to_action": flyer.call_to_action,
        "contact_info": flyer.contact_info,
        "qr_target_type": flyer.qr_target_type,
        "qr_custom_url": flyer.qr_custom_url,
        "theme_mode": flyer.theme_mode,
        "image_prompt": flyer.image_prompt,
        "layout_changed": _content_marker(flyer.layout_json),
        "is_active": bool(flyer.is_active),
    }


def _snapshot_event(event) -> dict[str, object]:
    return {
        "title": event.title,
        "event_type": event.event_type,
        "start_at": event.start_at.isoformat() if event.start_at else None,
        "end_at": event.end_at.isoformat() if event.end_at else None,
        "all_day": bool(event.all_day),
        "notes": event.notes,
    }


def _snapshot_gift_policy(policy) -> dict[str, object]:
    return {
        "max_gifts_per_sponsor": policy.max_gifts_per_sponsor,
        "max_wishlist_items_per_recipient": policy.max_wishlist_items_per_recipient,
        "recipient_coverage_rule": policy.recipient_coverage_rule,
        "recipient_coverage_required_count": policy.recipient_coverage_required_count,
        "allow_partial_sponsor_commitments": bool(policy.allow_partial_sponsor_commitments),
        "reservation_hold_minutes": policy.reservation_hold_minutes,
    }


def _milestone_summary(milestones) -> list[dict[str, object]]:
    return [
        {
            "key": milestone.milestone_key,
            "label": milestone.label,
            "date": milestone.occurs_on.isoformat() if milestone.occurs_on else None,
            "sort": milestone.sort_order,
        }
        for milestone in milestones
    ]


def _content_marker(value: object) -> str:
    digest = hashlib.sha256(str(value).encode("utf-8")).hexdigest()[:12]
    return f"content:{digest}"
