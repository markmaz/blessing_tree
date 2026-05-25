from __future__ import annotations

import uuid
from collections.abc import Mapping
from datetime import datetime

from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_constants import (
    CAMPAIGN_EVENT_SOURCE_COMMUNICATION,
    CAMPAIGN_EVENT_SOURCE_MANUAL,
    CAMPAIGN_EVENT_SOURCE_MILESTONE,
)
from app.features.campaigns.studio_validation import (
    parse_bool,
    parse_optional_datetime,
    parse_required_datetime,
    require_short_text,
    validate_datetime_range,
    validate_event_type,
)
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_event import CampaignEvent
from app.models.campaign_milestone import CampaignMilestone


class CampaignStudioScheduleService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def list_events(self, db: Session, campaign_id: str) -> list[CampaignEvent]:
        self.campaigns.get_campaign(db, campaign_id)
        return (
            db.query(CampaignEvent)
            .filter(CampaignEvent.campaign_id == campaign_id)
            .order_by(CampaignEvent.start_at.asc(), CampaignEvent.created_at.asc())
            .all()
        )

    def create_event(
        self,
        db: Session,
        user_id: str,
        campaign_id: str,
        payload: Mapping[str, object],
    ) -> CampaignEvent:
        self.campaigns.get_campaign(db, campaign_id)
        start_at = parse_required_datetime(payload.get("start_at"), "start_at")
        end_at = parse_optional_datetime(payload.get("end_at"), "end_at")
        validate_datetime_range(start_at, end_at)

        event = CampaignEvent(
            id=uuid.uuid4(),
            campaign_id=uuid.UUID(str(campaign_id)),
            title=require_short_text(payload.get("title"), "title"),
            event_type=validate_event_type(payload.get("event_type")),
            start_at=start_at,
            end_at=end_at,
            all_day=parse_bool(payload.get("all_day"), "all_day", default=False),
            notes=self._optional_notes(payload.get("notes")),
            source_type=CAMPAIGN_EVENT_SOURCE_MANUAL,
            source_id=None,
            created_by_user_id=uuid.UUID(str(user_id)),
        )
        db.add(event)
        db.commit()
        db.refresh(event)
        return event

    def update_event(
        self,
        db: Session,
        campaign_id: str,
        event_id: str,
        payload: Mapping[str, object],
    ) -> CampaignEvent:
        event = self._get_event(db, campaign_id, event_id)
        self._ensure_manual_event(event)

        if "title" in payload:
            event.title = require_short_text(payload.get("title"), "title")
        if "event_type" in payload:
            event.event_type = validate_event_type(payload.get("event_type"))

        start_at = (
            parse_required_datetime(payload.get("start_at"), "start_at")
            if "start_at" in payload
            else event.start_at
        )
        end_at = (
            parse_optional_datetime(payload.get("end_at"), "end_at")
            if "end_at" in payload
            else event.end_at
        )
        validate_datetime_range(start_at, end_at)
        event.start_at = start_at
        event.end_at = end_at

        if "all_day" in payload:
            event.all_day = parse_bool(payload.get("all_day"), "all_day")
        if "notes" in payload:
            event.notes = self._optional_notes(payload.get("notes"))

        db.commit()
        db.refresh(event)
        return event

    def delete_event(self, db: Session, campaign_id: str, event_id: str) -> None:
        event = self._get_event(db, campaign_id, event_id)
        self._ensure_manual_event(event)
        db.delete(event)
        db.commit()

    def list_schedule_items(self, db: Session, campaign_id: str) -> list[dict[str, object]]:
        self.campaigns.get_campaign(db, campaign_id)
        milestones = self._list_milestones(db, campaign_id)
        schedules = self._list_communication_schedules(db, campaign_id)
        manual_events = self.list_events(db, campaign_id)

        milestone_by_key = {milestone.milestone_key: milestone for milestone in milestones}
        items = [self._build_manual_item(event) for event in manual_events]
        items.extend(self._build_milestone_item(milestone) for milestone in milestones)
        items.extend(
            self._build_communication_item(schedule, milestone_by_key.get(schedule.milestone_key))
            for schedule in schedules
        )
        return sorted(items, key=_schedule_item_sort_key)

    def _get_event(self, db: Session, campaign_id: str, event_id: str) -> CampaignEvent:
        event = (
            db.query(CampaignEvent)
            .filter(CampaignEvent.campaign_id == campaign_id, CampaignEvent.id == event_id)
            .one_or_none()
        )
        if event is None:
            raise ServiceError(
                "Campaign event not found",
                status_code=404,
                details={"campaign_id": campaign_id, "event_id": event_id},
            )
        return event

    @staticmethod
    def _ensure_manual_event(event: CampaignEvent) -> None:
        if event.source_type != CAMPAIGN_EVENT_SOURCE_MANUAL:
            raise ServiceError(
                "Only manual campaign events are directly editable",
                status_code=400,
                details={"event_id": str(event.id), "source_type": event.source_type},
            )

    @staticmethod
    def _optional_notes(value: object) -> str | None:
        return require_short_text(value, "notes", max_length=5000) if value not in (None, "") else None

    @staticmethod
    def _list_milestones(db: Session, campaign_id: str) -> list[CampaignMilestone]:
        return (
            db.query(CampaignMilestone)
            .filter(CampaignMilestone.campaign_id == campaign_id)
            .order_by(CampaignMilestone.sort_order.asc(), CampaignMilestone.occurs_on.asc())
            .all()
        )

    @staticmethod
    def _list_communication_schedules(
        db: Session,
        campaign_id: str,
    ) -> list[CampaignCommunicationSchedule]:
        return (
            db.query(CampaignCommunicationSchedule)
            .options(joinedload(CampaignCommunicationSchedule.template))
            .filter(CampaignCommunicationSchedule.campaign_id == campaign_id)
            .order_by(CampaignCommunicationSchedule.created_at.asc())
            .all()
        )

    @staticmethod
    def _build_manual_item(event: CampaignEvent) -> dict[str, object]:
        return {
            "id": str(event.id),
            "title": event.title,
            "event_type": event.event_type,
            "source_type": CAMPAIGN_EVENT_SOURCE_MANUAL,
            "source_id": None,
            "start_at": event.start_at,
            "end_at": event.end_at,
            "all_day": bool(event.all_day),
            "notes": event.notes,
            "is_editable": True,
        }

    @staticmethod
    def _build_milestone_item(milestone: CampaignMilestone) -> dict[str, object]:
        return {
            "id": f"{CAMPAIGN_EVENT_SOURCE_MILESTONE}:{milestone.id}",
            "title": milestone.label,
            "event_type": "MILESTONE",
            "source_type": CAMPAIGN_EVENT_SOURCE_MILESTONE,
            "source_id": str(milestone.id),
            "start_at": datetime.combine(milestone.occurs_on, datetime.min.time()),
            "end_at": None,
            "all_day": True,
            "notes": milestone.notes,
            "is_editable": False,
        }

    @staticmethod
    def _build_communication_item(
        schedule: CampaignCommunicationSchedule,
        milestone: CampaignMilestone | None,
    ) -> dict[str, object]:
        start_at = schedule.scheduled_for
        all_day = False
        if start_at is None and milestone is not None:
            start_at = datetime.combine(milestone.occurs_on, datetime.min.time())
            all_day = True

        title = schedule.template.name if getattr(schedule, "template", None) is not None else "Communication"
        if schedule.milestone_key and not title:
            title = f"{schedule.milestone_key} Communication"

        return {
            "id": f"{CAMPAIGN_EVENT_SOURCE_COMMUNICATION}:{schedule.id}",
            "title": title,
            "event_type": "COMMUNICATION",
            "source_type": CAMPAIGN_EVENT_SOURCE_COMMUNICATION,
            "source_id": str(schedule.id),
            "start_at": start_at,
            "end_at": None,
            "all_day": all_day,
            "notes": schedule.notes,
            "is_editable": False,
        }


def _schedule_item_sort_key(item: dict[str, object]) -> tuple[int, datetime, int, str]:
    source_type = str(item.get("source_type") or "")
    source_priority = {
        CAMPAIGN_EVENT_SOURCE_MANUAL: 0,
        CAMPAIGN_EVENT_SOURCE_MILESTONE: 1,
        CAMPAIGN_EVENT_SOURCE_COMMUNICATION: 2,
    }.get(source_type, 9)
    start_at = item.get("start_at")
    if isinstance(start_at, datetime):
        return (0, start_at, source_priority, str(item.get("title") or ""))
    return (1, datetime.max, source_priority, str(item.get("title") or ""))
