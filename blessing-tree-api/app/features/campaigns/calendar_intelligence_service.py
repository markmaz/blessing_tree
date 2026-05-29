from __future__ import annotations

from collections import defaultdict
from collections.abc import Callable
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_constants import (
    CAMPAIGN_EVENT_SOURCE_COMMUNICATION,
    CAMPAIGN_EVENT_SOURCE_MANUAL,
    CAMPAIGN_EVENT_SOURCE_MILESTONE,
    MILESTONE_DEFINITIONS,
    PUBLIC_SPONSOR_REQUIRED_MILESTONE_KEYS,
    REQUIRED_MILESTONE_KEYS,
)
from app.features.campaigns.studio_schedule_service import CampaignStudioScheduleService
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_milestone import CampaignMilestone
from app.models.campaign_milestone_definition import CampaignMilestoneDefinition
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsorship import Sponsorship

CRITICAL_MILESTONE_KEYS = (
    "sponsor_registration_start",
    "sponsor_registration_end",
    "sponsor_outreach_start",
    "gift_intake_start",
    "gift_intake_end",
    "gift_turn_in_due",
    "pickup_start",
    "pickup_end",
    "campaign_close",
)
ALWAYS_BLOCKING_MILESTONE_KEYS = frozenset(
    {
        "sponsor_registration_start",
        "sponsor_registration_end",
        "sponsor_outreach_start",
        "gift_turn_in_due",
        "gift_intake_end",
        "pickup_start",
        "pickup_end",
        "campaign_close",
    }
)
AGENDA_GROUPS = (
    ("needs_attention", "Needs Attention"),
    ("overdue", "Overdue"),
    ("next_7_days", "Next 7 Days"),
    ("next_30_days", "Next 30 Days"),
    ("missing", "Missing Important Dates"),
)


class CampaignCalendarIntelligenceService:
    def __init__(
        self,
        *,
        campaign_service: CampaignService | None = None,
        schedule_service: CampaignStudioScheduleService | None = None,
        today_provider: Callable[[], date] | None = None,
    ) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.schedule = schedule_service or CampaignStudioScheduleService(self.campaigns)
        self.today_provider = today_provider or date.today

    def get_calendar_intelligence(self, db: Session, campaign_id: str) -> dict[str, Any]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        today = self.today_provider()
        generated_at = datetime.utcnow()
        milestones = self._list_milestones(db, campaign_id)
        definitions = self._list_milestone_definitions(db)
        schedules = self._list_communication_schedules(db, campaign_id)
        schedule_items = self.schedule.list_schedule_items(db, campaign_id)

        items: list[dict[str, Any]] = []
        items.extend(self._campaign_date_items(campaign, today))
        items.extend(self._schedule_items(schedule_items, today))
        items.extend(self._missing_critical_date_items(campaign, milestones, definitions, today))
        items.extend(self._sponsor_dropoff_items(db, campaign_id, today))
        items.extend(self._sponsor_followup_items(db, campaign_id, today))

        critical_dates = self._critical_dates(campaign, milestones, definitions, today)
        warnings = self._warnings(items, campaign)
        agenda_groups = self._agenda_groups(items)

        return {
            "campaign_id": str(campaign.id),
            "generated_at": generated_at,
            "summary": self._summary(items, schedules),
            "critical_dates": critical_dates,
            "agenda_groups": agenda_groups,
            "items": sorted(items, key=_calendar_item_sort_key),
            "warnings": warnings,
        }

    @staticmethod
    def _list_milestones(db: Session, campaign_id: str) -> list[CampaignMilestone]:
        return (
            db.query(CampaignMilestone)
            .filter(CampaignMilestone.campaign_id == campaign_id)
            .order_by(CampaignMilestone.sort_order.asc(), CampaignMilestone.occurs_on.asc())
            .all()
        )

    @staticmethod
    def _list_milestone_definitions(db: Session) -> list[CampaignMilestoneDefinition]:
        return (
            db.query(CampaignMilestoneDefinition)
            .filter(CampaignMilestoneDefinition.is_active == 1)
            .order_by(CampaignMilestoneDefinition.default_sort_order.asc(), CampaignMilestoneDefinition.label.asc())
            .all()
        )

    @staticmethod
    def _list_communication_schedules(db: Session, campaign_id: str) -> list[CampaignCommunicationSchedule]:
        return (
            db.query(CampaignCommunicationSchedule)
            .filter(CampaignCommunicationSchedule.campaign_id == campaign_id)
            .all()
        )

    def _campaign_date_items(self, campaign, today: date) -> list[dict[str, Any]]:
        return [
            self._build_item(
                item_id="campaign:start_date",
                title="Campaign Start",
                item_type="campaign_date",
                source_type="campaign",
                source_id=str(campaign.id),
                date_value=campaign.start_date,
                all_day=True,
                is_blocker=campaign.start_date is None,
                is_missing=campaign.start_date is None,
                urgency=_urgency_for_date(campaign.start_date, today, is_missing=campaign.start_date is None),
                description="The first day of the campaign window.",
                route_name="campaign_studio_settings",
            ),
            self._build_item(
                item_id="campaign:end_date",
                title="Campaign End",
                item_type="campaign_date",
                source_type="campaign",
                source_id=str(campaign.id),
                date_value=campaign.end_date,
                all_day=True,
                is_blocker=campaign.end_date is None,
                is_missing=campaign.end_date is None,
                urgency=_urgency_for_date(campaign.end_date, today, is_missing=campaign.end_date is None),
                description="The last day of the campaign window.",
                route_name="campaign_studio_settings",
            ),
        ]

    def _schedule_items(self, schedule_items: list[dict[str, Any]], today: date) -> list[dict[str, Any]]:
        items: list[dict[str, Any]] = []
        for item in schedule_items:
            source_type = str(item.get("source_type") or "")
            item_type = {
                CAMPAIGN_EVENT_SOURCE_MANUAL: "manual_event",
                CAMPAIGN_EVENT_SOURCE_MILESTONE: "milestone",
                CAMPAIGN_EVENT_SOURCE_COMMUNICATION: "communication",
            }.get(source_type, "manual_event")
            date_value = _date_from_value(item.get("start_at"))
            items.append(
                self._build_item(
                    item_id=str(item.get("id")),
                    title=str(item.get("title") or "Schedule Item"),
                    item_type=item_type,
                    source_type=source_type,
                    source_id=str(item.get("source_id")) if item.get("source_id") is not None else None,
                    date_value=date_value,
                    starts_at=item.get("start_at") if isinstance(item.get("start_at"), datetime) else None,
                    ends_at=item.get("end_at") if isinstance(item.get("end_at"), datetime) else None,
                    all_day=bool(item.get("all_day")),
                    is_blocker=source_type == CAMPAIGN_EVENT_SOURCE_MILESTONE and _milestone_key_from_item(item) in ALWAYS_BLOCKING_MILESTONE_KEYS,
                    is_missing=False,
                    urgency=_urgency_for_date(date_value, today),
                    description=str(item.get("notes") or ""),
                    count=None,
                    route_name="campaign_studio_schedule",
                    metadata={"event_type": item.get("event_type")},
                )
            )
        return items

    def _missing_critical_date_items(
        self,
        campaign,
        milestones: list[CampaignMilestone],
        definitions: list[CampaignMilestoneDefinition],
        today: date,
    ) -> list[dict[str, Any]]:
        milestone_keys = {milestone.milestone_key for milestone in milestones}
        definition_by_key = _definition_by_key(definitions)
        blocker_keys = _blocker_milestone_keys(campaign)
        items: list[dict[str, Any]] = []
        for milestone_key in CRITICAL_MILESTONE_KEYS:
            if milestone_key in milestone_keys:
                continue
            definition = definition_by_key.get(milestone_key)
            label = definition.label if definition else MILESTONE_DEFINITIONS.get(milestone_key, milestone_key.replace("_", " ").title())
            is_blocker = milestone_key in blocker_keys
            items.append(
                self._build_item(
                    item_id=f"missing:{milestone_key}",
                    title=f"{label} is missing",
                    item_type="missing_date",
                    source_type="milestone_definition",
                    source_id=milestone_key,
                    date_value=None,
                    all_day=True,
                    is_blocker=is_blocker,
                    is_missing=True,
                    urgency="missing",
                    description="This important campaign date has not been placed on the calendar.",
                    route_name="campaign_studio_schedule",
                    metadata={"milestone_key": milestone_key},
                )
            )
        return items

    def _sponsor_dropoff_items(self, db: Session, campaign_id: str, today: date) -> list[dict[str, Any]]:
        sponsorships = (
            db.query(Sponsorship)
            .options(joinedload(Sponsorship.sponsor))
            .filter(
                Sponsorship.campaign_id == campaign_id,
                Sponsorship.drop_off_due_at.isnot(None),
                Sponsorship.status != "CANCELLED",
            )
            .order_by(Sponsorship.drop_off_due_at.asc())
            .all()
        )
        grouped: dict[date, list[Sponsorship]] = defaultdict(list)
        for sponsorship in sponsorships:
            due_date = _date_from_value(sponsorship.drop_off_due_at)
            if due_date:
                grouped[due_date].append(sponsorship)

        items: list[dict[str, Any]] = []
        for due_date, day_sponsorships in grouped.items():
            incomplete = [item for item in day_sponsorships if item.drop_off_completed_at is None and item.drop_off_status != "RECEIVED"]
            if not incomplete:
                continue
            sample_names = [item.sponsor.display_name for item in incomplete[:5] if item.sponsor is not None]
            count = len(incomplete)
            items.append(
                self._build_item(
                    item_id=f"sponsor_dropoff:{due_date.isoformat()}",
                    title=f"{count} sponsor drop-off{'s' if count != 1 else ''} due",
                    item_type="sponsor_dropoff",
                    source_type="sponsorship",
                    source_id=None,
                    date_value=due_date,
                    all_day=True,
                    is_blocker=False,
                    is_missing=False,
                    urgency=_urgency_for_date(due_date, today),
                    description=", ".join(sample_names),
                    count=count,
                    route_name="sponsor_follow_up_queue",
                    metadata={"sample_sponsors": sample_names},
                )
            )
        return items

    def _sponsor_followup_items(self, db: Session, campaign_id: str, today: date) -> list[dict[str, Any]]:
        interactions = (
            db.query(SponsorInteraction)
            .options(joinedload(SponsorInteraction.sponsor))
            .filter(SponsorInteraction.campaign_id == campaign_id, SponsorInteraction.follow_up_at.isnot(None))
            .order_by(SponsorInteraction.follow_up_at.asc())
            .all()
        )
        grouped: dict[date, list[SponsorInteraction]] = defaultdict(list)
        for interaction in interactions:
            follow_up_date = _date_from_value(interaction.follow_up_at)
            if follow_up_date:
                grouped[follow_up_date].append(interaction)

        items: list[dict[str, Any]] = []
        for follow_up_date, day_interactions in grouped.items():
            sample_names = [item.sponsor.display_name for item in day_interactions[:5] if item.sponsor is not None]
            count = len(day_interactions)
            items.append(
                self._build_item(
                    item_id=f"sponsor_followup:{follow_up_date.isoformat()}",
                    title=f"{count} sponsor follow-up{'s' if count != 1 else ''} due",
                    item_type="sponsor_followup",
                    source_type="sponsor_interaction",
                    source_id=None,
                    date_value=follow_up_date,
                    all_day=True,
                    is_blocker=False,
                    is_missing=False,
                    urgency=_urgency_for_date(follow_up_date, today),
                    description=", ".join(sample_names),
                    count=count,
                    route_name="sponsor_follow_up_queue",
                    metadata={"sample_sponsors": sample_names},
                )
            )
        return items

    def _critical_dates(
        self,
        campaign,
        milestones: list[CampaignMilestone],
        definitions: list[CampaignMilestoneDefinition],
        today: date,
    ) -> list[dict[str, Any]]:
        milestone_by_key = {milestone.milestone_key: milestone for milestone in milestones}
        definition_by_key = _definition_by_key(definitions)
        blocker_keys = _blocker_milestone_keys(campaign)
        critical_dates = [
            {
                "key": "campaign_start",
                "label": "Campaign Start",
                "date": campaign.start_date,
                "status": _urgency_for_date(campaign.start_date, today, is_missing=campaign.start_date is None),
                "is_blocker": campaign.start_date is None,
                "source_type": "campaign",
                "source_id": str(campaign.id),
                "route_name": "campaign_studio_settings",
            }
        ]
        for milestone_key in CRITICAL_MILESTONE_KEYS:
            milestone = milestone_by_key.get(milestone_key)
            definition = definition_by_key.get(milestone_key)
            date_value = milestone.occurs_on if milestone else None
            critical_dates.append(
                {
                    "key": milestone_key,
                    "label": milestone.label if milestone else (definition.label if definition else MILESTONE_DEFINITIONS.get(milestone_key, milestone_key.replace("_", " ").title())),
                    "date": date_value,
                    "status": _urgency_for_date(date_value, today, is_missing=date_value is None),
                    "is_blocker": milestone_key in blocker_keys,
                    "source_type": CAMPAIGN_EVENT_SOURCE_MILESTONE if milestone else "milestone_definition",
                    "source_id": str(milestone.id) if milestone else milestone_key,
                    "route_name": "campaign_studio_schedule",
                }
            )
        critical_dates.append(
            {
                "key": "campaign_end",
                "label": "Campaign End",
                "date": campaign.end_date,
                "status": _urgency_for_date(campaign.end_date, today, is_missing=campaign.end_date is None),
                "is_blocker": campaign.end_date is None,
                "source_type": "campaign",
                "source_id": str(campaign.id),
                "route_name": "campaign_studio_settings",
            }
        )
        return critical_dates

    @staticmethod
    def _build_item(
        *,
        item_id: str,
        title: str,
        item_type: str,
        source_type: str,
        source_id: str | None,
        date_value: date | None,
        all_day: bool,
        is_blocker: bool,
        is_missing: bool,
        urgency: str,
        description: str = "",
        starts_at: datetime | None = None,
        ends_at: datetime | None = None,
        count: int | None = None,
        route_name: str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        starts_at = starts_at or (datetime.combine(date_value, time.min) if date_value else None)
        return {
            "id": item_id,
            "title": title,
            "description": description,
            "item_type": item_type,
            "urgency": urgency,
            "date": date_value,
            "starts_at": starts_at,
            "ends_at": ends_at,
            "all_day": all_day,
            "is_blocker": bool(is_blocker),
            "is_missing": bool(is_missing),
            "is_overdue": urgency == "overdue",
            "count": count,
            "source_type": source_type,
            "source_id": source_id,
            "route_name": route_name,
            "metadata": metadata or {},
        }

    @staticmethod
    def _summary(items: list[dict[str, Any]], schedules: list[CampaignCommunicationSchedule]) -> dict[str, int]:
        return {
            "total_items": len(items),
            "overdue_count": sum(1 for item in items if item["urgency"] == "overdue"),
            "due_soon_count": sum(1 for item in items if item["urgency"] in {"today", "due_soon"}),
            "missing_critical_dates_count": sum(1 for item in items if item["item_type"] == "missing_date"),
            "scheduled_communications_count": sum(1 for schedule in schedules if schedule.status == "SCHEDULED"),
            "blocker_count": sum(1 for item in items if item["is_blocker"] and item["urgency"] in {"missing", "overdue"}),
        }

    @staticmethod
    def _agenda_groups(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
        sorted_items = sorted(items, key=_calendar_item_sort_key)
        groups = []
        for key, label in AGENDA_GROUPS:
            if key == "needs_attention":
                group_items = [
                    item
                    for item in sorted_items
                    if item["urgency"] in {"missing", "overdue", "today", "due_soon"} or item["is_blocker"]
                ]
            elif key == "overdue":
                group_items = [item for item in sorted_items if item["urgency"] == "overdue"]
            elif key == "next_7_days":
                group_items = [item for item in sorted_items if item["urgency"] in {"today", "due_soon"}]
            elif key == "next_30_days":
                group_items = [item for item in sorted_items if item["urgency"] == "upcoming"]
            else:
                group_items = [item for item in sorted_items if item["urgency"] == "missing"]
            groups.append({"key": key, "label": label, "items": group_items[:25]})
        return groups

    @staticmethod
    def _warnings(items: list[dict[str, Any]], campaign) -> list[dict[str, Any]]:
        warnings = []
        for item in items:
            if item["urgency"] == "missing":
                warnings.append(
                    {
                        "code": f"missing_{item['source_id']}",
                        "message": item["title"],
                        "severity": "blocker" if item["is_blocker"] else "warning",
                    }
                )
            elif item["urgency"] == "overdue":
                warnings.append(
                    {
                        "code": f"overdue_{item['id']}",
                        "message": f"{item['title']} is overdue.",
                        "severity": "blocker" if item["is_blocker"] else "warning",
                    }
                )
            date_value = item.get("date")
            if (
                isinstance(date_value, date)
                and item.get("item_type") != "campaign_date"
                and (
                    (campaign.start_date is not None and date_value < campaign.start_date)
                    or (campaign.end_date is not None and date_value > campaign.end_date)
                )
            ):
                warnings.append(
                    {
                        "code": f"date_outside_campaign_window_{item['id']}",
                        "message": f"{item['title']} is outside the campaign date range.",
                        "severity": "warning",
                    }
                )
        return warnings[:25]


def _urgency_for_date(value: date | None, today: date, *, is_missing: bool = False) -> str:
    if is_missing or value is None:
        return "missing"
    if value < today:
        return "overdue"
    if value == today:
        return "today"
    days_until = (value - today).days
    if days_until <= 7:
        return "due_soon"
    if days_until <= 30:
        return "upcoming"
    return "future"


def _date_from_value(value: object) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    return None


def _calendar_item_sort_key(item: dict[str, Any]) -> tuple[int, date, str]:
    urgency_priority = {
        "missing": 0,
        "overdue": 1,
        "today": 2,
        "due_soon": 3,
        "upcoming": 4,
        "future": 5,
        "complete": 6,
        "informational": 7,
    }.get(str(item.get("urgency") or ""), 9)
    item_date = item.get("date")
    return (urgency_priority, item_date if isinstance(item_date, date) else date.max, str(item.get("title") or ""))


def _definition_by_key(definitions: list[CampaignMilestoneDefinition]) -> dict[str, CampaignMilestoneDefinition]:
    return {definition.milestone_key: definition for definition in definitions}


def _blocker_milestone_keys(campaign) -> set[str]:
    keys = set(REQUIRED_MILESTONE_KEYS)
    keys.update(ALWAYS_BLOCKING_MILESTONE_KEYS)
    if getattr(campaign, "public_sponsor_signup_enabled", False):
        keys.update(PUBLIC_SPONSOR_REQUIRED_MILESTONE_KEYS)
    return keys


def _milestone_key_from_item(item: dict[str, Any]) -> str | None:
    metadata = item.get("metadata")
    if isinstance(metadata, dict):
        key = metadata.get("milestone_key")
        return str(key) if key else None
    return None
