from __future__ import annotations

import uuid
from collections.abc import Mapping

from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_readiness import build_campaign_readiness
from app.features.campaigns.studio_schedule_service import CampaignStudioScheduleService
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
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_milestone import CampaignMilestone
from app.models.communication_template import CommunicationTemplate


class CampaignStudioService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.schedule = CampaignStudioScheduleService(self.campaigns)
        self.team = CampaignStudioTeamService(self.campaigns)

    def get_studio_payload(self, db: Session, user_id: str, campaign_id: str) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        access = self.campaigns.get_campaign_access_payload(db, user_id, campaign_id)
        summary = self.campaigns.get_campaign_summary_counts(db, campaign_id)
        team = self.team.get_team_snapshot(db, campaign_id)
        templates = self.list_templates(db)
        schedules = self.list_schedules(db, campaign_id)
        milestones = self.list_milestones(db, campaign_id)
        schedule_items = self.schedule.list_schedule_items(db, campaign_id)
        readiness = self.get_readiness(db, campaign_id)
        return {
            "campaign": campaign,
            "access": access,
            "summary": summary,
            "team": team,
            "templates": templates,
            "schedules": schedules,
            "milestones": milestones,
            "schedule_items": schedule_items,
            "readiness": readiness,
        }

    def list_templates(self, db: Session) -> list[CommunicationTemplate]:
        return db.query(CommunicationTemplate).order_by(CommunicationTemplate.name.asc()).all()

    def create_template(self, db: Session, user_id: str, payload: Mapping[str, object]) -> CommunicationTemplate:
        template_key = validate_template_key(payload.get("template_key"))
        existing = (
            db.query(CommunicationTemplate)
            .filter(CommunicationTemplate.template_key == template_key)
            .one_or_none()
        )
        if existing is not None:
            raise ServiceError("Template key already exists", status_code=409, details={"template_key": template_key})

        template = CommunicationTemplate(
            id=uuid.uuid4(),
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

    def update_template(self, db: Session, template_id: str, payload: Mapping[str, object]) -> CommunicationTemplate:
        template = self._get_template(db, template_id)
        if "template_key" in payload:
            next_key = validate_template_key(payload.get("template_key"))
            duplicate = (
                db.query(CommunicationTemplate)
                .filter(CommunicationTemplate.template_key == next_key, CommunicationTemplate.id != template.id)
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
        template = self._get_template(db, payload.get("template_id"))
        milestone_key = self._optional_milestone_key(payload.get("milestone_key"))
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
            schedule.template_id = self._get_template(db, payload.get("template_id")).id
        if "milestone_key" in payload:
            schedule.milestone_key = self._optional_milestone_key(payload.get("milestone_key"))
        if "scheduled_for" in payload:
            schedule.scheduled_for = parse_optional_datetime(payload.get("scheduled_for"), "scheduled_for")
        self._validate_schedule_timing(schedule.milestone_key, schedule.scheduled_for)
        if "status" in payload:
            schedule.status = validate_schedule_status(payload.get("status"))
        if "notes" in payload:
            schedule.notes = self.campaigns_optional_text(payload.get("notes"))
        db.commit()
        return self._get_schedule(db, campaign_id, schedule_id)

    def list_milestones(self, db: Session, campaign_id: str) -> list[CampaignMilestone]:
        return (
            db.query(CampaignMilestone)
            .filter(CampaignMilestone.campaign_id == campaign_id)
            .order_by(CampaignMilestone.sort_order.asc(), CampaignMilestone.occurs_on.asc())
            .all()
        )

    def replace_milestones(self, db: Session, campaign_id: str, payload: object) -> list[CampaignMilestone]:
        self.campaigns.get_campaign(db, campaign_id)
        items = require_milestone_list(payload)
        existing = {
            milestone.milestone_key: milestone
            for milestone in db.query(CampaignMilestone).filter(CampaignMilestone.campaign_id == campaign_id).all()
        }
        submitted_keys = {item["milestone_key"] for item in items}

        for milestone_key, milestone in existing.items():
            if milestone_key not in submitted_keys:
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
        templates = self.list_templates(db)
        manual_events = self.schedule.list_events(db, campaign_id)
        return build_campaign_readiness(
            campaign,
            assignments=team["assignments"],
            role_counts=team["counts"]["role_counts"],
            milestones=milestones,
            schedules=schedules,
            templates=templates,
            manual_events=manual_events,
        )

    @staticmethod
    def campaigns_optional_text(value: object) -> str | None:
        return require_short_text(value, "notes", max_length=5000) if value not in (None, "") else None

    @staticmethod
    def _get_template(db: Session, template_id: object) -> CommunicationTemplate:
        try:
            template_uuid = uuid.UUID(str(template_id))
        except (TypeError, ValueError, AttributeError):
            raise ServiceError("Valid template_id is required", status_code=400, details={"field": "template_id"})

        template = db.get(CommunicationTemplate, template_uuid)
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

    @staticmethod
    def _optional_milestone_key(value: object) -> str | None:
        if value in (None, ""):
            return None
        return validate_milestone_key(value)

    @staticmethod
    def _validate_schedule_timing(milestone_key: str | None, scheduled_for) -> None:
        if milestone_key is None and scheduled_for is None:
            raise ServiceError(
                "Communication schedules require milestone_key or scheduled_for",
                status_code=400,
                details={"fields": ["milestone_key", "scheduled_for"]},
            )
