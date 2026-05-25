from __future__ import annotations

import uuid
from collections.abc import Mapping

from sqlalchemy.orm import Session, joinedload

from app.email import send_email_message
from app.exceptions.service_error import ServiceError
from app.features.campaigns.automation_readiness_service import (
    CampaignAutomationReadinessService,
)
from app.features.campaigns.gift_policy_service import CampaignGiftPolicyService
from app.features.campaigns.milestone_definition_service import CampaignMilestoneDefinitionService
from app.features.campaigns.readiness_definition_service import CampaignReadinessDefinitionService
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_readiness import build_campaign_readiness
from app.features.campaigns.studio_schedule_service import CampaignStudioScheduleService
from app.features.campaigns.template_renderer import CampaignTemplateRenderer
from app.features.campaigns.studio_team_service import CampaignStudioTeamService
from app.features.campaigns.studio_validation import (
    parse_bool,
    parse_optional_datetime,
    require_milestone_list,
    require_short_text,
    validate_audience,
    validate_channel,
    validate_milestone_key,
    validate_schedule_status,
    validate_template_key,
)
from app.features.campaigns.studio_constants import get_communication_audience_catalog
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_gift_reminder_rule import CampaignGiftReminderRule
from app.models.campaign_milestone import CampaignMilestone
from app.models.campaign_milestone_definition import CampaignMilestoneDefinition
from app.models.communication_template import CommunicationTemplate
from app.models.app_user import AppUser


class CampaignStudioService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.schedule = CampaignStudioScheduleService(self.campaigns)
        self.team = CampaignStudioTeamService(self.campaigns)
        self.automation_readiness = CampaignAutomationReadinessService()
        self.readiness_definitions = CampaignReadinessDefinitionService()
        self.milestone_definitions = CampaignMilestoneDefinitionService()
        self.gift_policy = CampaignGiftPolicyService(self.campaigns)
        self.template_renderer = CampaignTemplateRenderer()

    def get_studio_payload(self, db: Session, user_id: str, campaign_id: str) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        access = self.campaigns.get_campaign_access_payload(db, user_id, campaign_id)
        summary = self.campaigns.get_campaign_summary_counts(db, campaign_id)
        team = self.team.get_team_snapshot(db, campaign_id)
        templates = self.list_templates(db, campaign_id)
        schedules = self.list_schedules(db, campaign_id)
        audience_catalog = get_communication_audience_catalog()
        milestone_definitions = self.milestone_definitions.list_active_definitions(db)
        milestones = self.list_milestones(db, campaign_id)
        gift_policy = self.gift_policy.get_policy(db, campaign_id)
        schedule_items = self.schedule.list_schedule_items(db, campaign_id)
        readiness = self.get_readiness(db, campaign_id)
        return {
            "campaign": campaign,
            "access": access,
            "summary": summary,
            "team": team,
            "templates": templates,
            "schedules": schedules,
            "audience_catalog": audience_catalog,
            "milestone_definitions": milestone_definitions,
            "milestones": milestones,
            "gift_policy": gift_policy,
            "schedule_items": schedule_items,
            "readiness": readiness,
        }

    def list_templates(self, db: Session, campaign_id: str) -> list[CommunicationTemplate]:
        return (
            db.query(CommunicationTemplate)
            .filter(CommunicationTemplate.campaign_id == campaign_id)
            .order_by(CommunicationTemplate.name.asc())
            .all()
        )

    def create_template(self, db: Session, user_id: str, campaign_id: str, payload: Mapping[str, object]) -> CommunicationTemplate:
        template_key = validate_template_key(payload.get("template_key"))
        existing = (
            db.query(CommunicationTemplate)
            .filter(
                CommunicationTemplate.campaign_id == campaign_id,
                CommunicationTemplate.template_key == template_key,
            )
            .one_or_none()
        )
        if existing is not None:
            raise ServiceError("Template key already exists", status_code=409, details={"template_key": template_key})

        template = CommunicationTemplate(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            template_key=template_key,
            name=require_short_text(payload.get("name"), "name"),
            audience=validate_audience(payload.get("audience")),
            channel=validate_channel(payload.get("channel")),
            subject_template=require_short_text(payload.get("subject_template"), "subject_template"),
            body_template=require_short_text(payload.get("body_template"), "body_template", max_length=20000),
            is_active=parse_bool(payload.get("is_active"), "is_active", default=True),
            created_by_user_id=uuid.UUID(str(user_id)),
        )
        db.add(template)
        db.commit()
        db.refresh(template)
        return template

    def update_template(self, db: Session, campaign_id: str, template_id: str, payload: Mapping[str, object]) -> CommunicationTemplate:
        template = self._get_template(db, campaign_id, template_id)
        if "template_key" in payload:
            next_key = validate_template_key(payload.get("template_key"))
            duplicate = (
                db.query(CommunicationTemplate)
                .filter(
                    CommunicationTemplate.campaign_id == campaign_id,
                    CommunicationTemplate.template_key == next_key,
                    CommunicationTemplate.id != template.id,
                )
                .one_or_none()
            )
            if duplicate is not None:
                raise ServiceError("Template key already exists", status_code=409, details={"template_key": next_key})
            template.template_key = next_key
        if "name" in payload:
            template.name = require_short_text(payload.get("name"), "name")
        if "audience" in payload:
            template.audience = validate_audience(payload.get("audience"))
        if "channel" in payload:
            template.channel = validate_channel(payload.get("channel"))
        if "subject_template" in payload:
            template.subject_template = require_short_text(payload.get("subject_template"), "subject_template")
        if "body_template" in payload:
            template.body_template = require_short_text(payload.get("body_template"), "body_template", max_length=20000)
        if "is_active" in payload:
            template.is_active = parse_bool(payload.get("is_active"), "is_active")
        db.commit()
        db.refresh(template)
        return template

    def delete_template(self, db: Session, campaign_id: str, template_id: str) -> None:
        template = self._get_template(db, campaign_id, template_id)
        has_schedules = (
            db.query(CampaignCommunicationSchedule.id)
            .filter(
                CampaignCommunicationSchedule.campaign_id == campaign_id,
                CampaignCommunicationSchedule.template_id == template.id,
            )
            .first()
            is not None
        )
        if has_schedules:
            raise ServiceError(
                "Template is still used by scheduled communications",
                status_code=409,
            )
        db.delete(template)
        db.commit()

    def send_template_test_email(
        self,
        db: Session,
        *,
        campaign_id: str,
        template_id: str,
        user_id: str,
        recipient_email: object = None,
    ) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        template = self._get_template(db, campaign_id, template_id)
        user = db.query(AppUser).filter(AppUser.id == uuid.UUID(str(user_id))).one_or_none()
        if user is None:
            raise ServiceError("User not found", status_code=404)

        target_email = str(recipient_email or user.email or "").strip()
        if "@" not in target_email or len(target_email) > 255:
            raise ServiceError("A valid test recipient email is required", status_code=400, details={"field": "recipient_email"})

        subject, html_body, text_body = self.template_renderer.render(
            campaign_name=campaign.name,
            campaign_year=campaign.year,
            subject_template=template.subject_template,
            body_template=template.body_template,
            merge_fields=_sample_template_merge_fields(user.display_name),
        )
        test_subject = f"[Test] {subject}"
        send_email_message(
            recipients=[target_email],
            subject=test_subject,
            html=html_body,
            text_body=text_body,
        )
        return {
            "template_id": str(template.id),
            "recipient_email": target_email,
            "subject": test_subject,
        }

    def list_schedules(self, db: Session, campaign_id: str) -> list[CampaignCommunicationSchedule]:
        return (
            db.query(CampaignCommunicationSchedule)
            .options(joinedload(CampaignCommunicationSchedule.template))
            .filter(CampaignCommunicationSchedule.campaign_id == campaign_id)
            .order_by(CampaignCommunicationSchedule.created_at.asc())
            .all()
        )

    def create_schedule(self, db: Session, campaign_id: str, payload: Mapping[str, object]) -> CampaignCommunicationSchedule:
        self.campaigns.get_campaign(db, campaign_id)
        template = self._get_template(db, campaign_id, payload.get("template_id"))
        milestone_key = self._optional_milestone_key(db, payload.get("milestone_key"))
        scheduled_for = parse_optional_datetime(payload.get("scheduled_for"), "scheduled_for")
        self._validate_schedule_timing(milestone_key, scheduled_for)
        schedule = CampaignCommunicationSchedule(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            template_id=template.id,
            milestone_key=milestone_key,
            scheduled_for=scheduled_for,
            status=validate_schedule_status(payload.get("status")),
            notes=self.campaigns_optional_text(payload.get("notes")),
        )
        db.add(schedule)
        db.commit()
        return self._get_schedule(db, campaign_id, str(schedule.id))

    def update_schedule(
        self,
        db: Session,
        campaign_id: str,
        schedule_id: str,
        payload: Mapping[str, object],
    ) -> CampaignCommunicationSchedule:
        schedule = self._get_schedule(db, campaign_id, schedule_id)
        if "template_id" in payload:
            schedule.template_id = self._get_template(db, campaign_id, payload.get("template_id")).id
        if "milestone_key" in payload:
            schedule.milestone_key = self._optional_milestone_key(db, payload.get("milestone_key"))
        if "scheduled_for" in payload:
            schedule.scheduled_for = parse_optional_datetime(payload.get("scheduled_for"), "scheduled_for")
        self._validate_schedule_timing(schedule.milestone_key, schedule.scheduled_for)
        if "status" in payload:
            schedule.status = validate_schedule_status(payload.get("status"))
        if "notes" in payload:
            schedule.notes = self.campaigns_optional_text(payload.get("notes"))
        db.commit()
        return self._get_schedule(db, campaign_id, schedule_id)

    def delete_schedule(self, db: Session, campaign_id: str, schedule_id: str) -> None:
        schedule = self._get_schedule(db, campaign_id, schedule_id)
        db.delete(schedule)
        db.commit()

    def list_milestones(self, db: Session, campaign_id: str) -> list[CampaignMilestone]:
        return (
            db.query(CampaignMilestone)
            .filter(CampaignMilestone.campaign_id == campaign_id)
            .order_by(CampaignMilestone.sort_order.asc(), CampaignMilestone.occurs_on.asc())
            .all()
        )

    def replace_milestones(self, db: Session, campaign_id: str, payload: object) -> list[CampaignMilestone]:
        self.campaigns.get_campaign(db, campaign_id)
        existing = {
            milestone.milestone_key: milestone
            for milestone in db.query(CampaignMilestone).filter(CampaignMilestone.campaign_id == campaign_id).all()
        }
        active_definitions = self.milestone_definitions.get_active_definition_defaults(db)
        definition_defaults = dict(active_definitions)
        inactive_existing_keys = [key for key in existing if key not in active_definitions]
        if inactive_existing_keys:
            inactive_existing_definitions = (
                db.query(CampaignMilestoneDefinition)
                .filter(CampaignMilestoneDefinition.milestone_key.in_(inactive_existing_keys))
                .all()
            )
            for definition in inactive_existing_definitions:
                definition_defaults[definition.milestone_key] = {
                    "label": definition.label,
                    "sort_order": definition.default_sort_order,
                }
        items = require_milestone_list(payload, definition_defaults)
        submitted_keys = {item["milestone_key"] for item in items}

        for milestone_key, milestone in existing.items():
            if milestone_key in active_definitions and milestone_key not in submitted_keys:
                db.delete(milestone)

        for item in items:
            milestone = existing.get(item["milestone_key"])
            if milestone is None:
                milestone = CampaignMilestone(
                    id=uuid.uuid4(),
                    campaign_id=campaign_id,
                    milestone_key=str(item["milestone_key"]),
                )
                db.add(milestone)
            milestone.label = str(item["label"])
            milestone.occurs_on = item["occurs_on"]
            milestone.notes = item["notes"]
            milestone.sort_order = int(item["sort_order"])

        db.commit()
        return self.list_milestones(db, campaign_id)

    def get_readiness(self, db: Session, campaign_id: str) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        team = self.team.get_team_snapshot(db, campaign_id)
        milestones = self.list_milestones(db, campaign_id)
        schedules = self.list_schedules(db, campaign_id)
        templates = self.list_templates(db, campaign_id)
        manual_events = self.schedule.list_events(db, campaign_id)
        gift_reminder_rules = (
            db.query(CampaignGiftReminderRule)
            .filter(CampaignGiftReminderRule.campaign_id == campaign.id)
            .all()
        )
        automation_snapshot = self.automation_readiness.build_snapshot(
            db,
            campaign_id=campaign_id,
            schedules=schedules,
        )
        configured_items = self.readiness_definitions.build_configured_items(
            db,
            campaign=campaign,
            milestones=milestones,
        )
        return build_campaign_readiness(
            campaign,
            assignments=team["assignments"],
            role_counts=team["counts"]["role_counts"],
            milestones=milestones,
            schedules=schedules,
            templates=templates,
            manual_events=manual_events,
            automation_snapshot=automation_snapshot,
            configured_items=configured_items,
            gift_reminder_rules=gift_reminder_rules,
        )

    @staticmethod
    def campaigns_optional_text(value: object) -> str | None:
        return require_short_text(value, "notes", max_length=5000) if value not in (None, "") else None

    @staticmethod
    def _get_template(db: Session, campaign_id: str, template_id: object) -> CommunicationTemplate:
        try:
            template_uuid = uuid.UUID(str(template_id))
        except (TypeError, ValueError, AttributeError):
            raise ServiceError("Valid template_id is required", status_code=400, details={"field": "template_id"})

        template = (
            db.query(CommunicationTemplate)
            .filter(
                CommunicationTemplate.id == template_uuid,
                CommunicationTemplate.campaign_id == campaign_id,
            )
            .one_or_none()
        )
        if template is None:
            raise ServiceError("Communication template not found", status_code=404, details={"template_id": str(template_uuid)})
        return template

    def _get_schedule(self, db: Session, campaign_id: str, schedule_id: str) -> CampaignCommunicationSchedule:
        schedule = (
            db.query(CampaignCommunicationSchedule)
            .options(joinedload(CampaignCommunicationSchedule.template))
            .filter(CampaignCommunicationSchedule.campaign_id == campaign_id, CampaignCommunicationSchedule.id == schedule_id)
            .one_or_none()
        )
        if schedule is None:
            raise ServiceError(
                "Communication schedule not found",
                status_code=404,
                details={"campaign_id": campaign_id, "schedule_id": schedule_id},
            )
        return schedule

    def _optional_milestone_key(self, db: Session, value: object) -> str | None:
        if value in (None, ""):
            return None
        return validate_milestone_key(
            value,
            self.milestone_definitions.get_active_definition_defaults(db).keys(),
        )

    @staticmethod
    def _validate_schedule_timing(milestone_key: str | None, scheduled_for) -> None:
        if milestone_key is None and scheduled_for is None:
            raise ServiceError(
                "Communication schedules require milestone_key or scheduled_for",
                status_code=400,
                details={"fields": ["milestone_key", "scheduled_for"]},
            )


def _sample_template_merge_fields(manager_name: str) -> dict[str, str]:
    return {
        "campaign.start_date": "November 1, 2026",
        "campaign.end_date": "December 20, 2026",
        "manager.name": manager_name,
        "contact.first_name": "Pat",
        "contact.full_name": "Pat Coordinator",
        "group.name": "Johnson Household",
        "recipient.first_name": "Ava",
        "recipient.full_name": "Ava Johnson",
        "sponsor.first_name": "Taylor",
        "sponsor.full_name": "Taylor Reed",
        "volunteer.first_name": "Chris",
        "volunteer.full_name": "Chris Walker",
        "milestone.label": "Pickup Weekend",
        "milestone.date": "December 19, 2026",
        "event.title": "Volunteer Orientation",
        "event.start_at": "November 3, 2026 at 6:00 PM",
        "location.map_url": "https://maps.example.com/pickup-warehouse",
    }
