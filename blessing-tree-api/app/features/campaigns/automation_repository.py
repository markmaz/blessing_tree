from __future__ import annotations

import json
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

from sqlalchemy import and_, exists, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.features.campaigns.constants import CAMPAIGN_STATUS_ACTIVE, CAMPAIGN_STATUS_DRAFT

from app.features.campaigns.automation_constants import (
    CAMPAIGN_AUTOMATION_STATUS_BLOCKED,
    CAMPAIGN_AUTOMATION_STATUS_FAILED,
    CAMPAIGN_AUTOMATION_STATUS_SKIPPED,
    CAMPAIGN_AUTOMATION_STATUS_STARTED,
    CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED,
)
from app.models.campaign import Campaign
from app.models.campaign_automation_execution import CampaignAutomationExecution
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_milestone import CampaignMilestone


class CampaignAutomationRepository:
    def list_due_schedule_ids(
        self,
        db: Session,
        *,
        now: datetime,
    ) -> list[str]:
        today = now.date()
        milestone_due = exists(
            select(CampaignMilestone.id).where(
                CampaignMilestone.campaign_id == CampaignCommunicationSchedule.campaign_id,
                CampaignMilestone.milestone_key == CampaignCommunicationSchedule.milestone_key,
                CampaignMilestone.occurs_on <= today,
            )
        )

        rows = (
            db.query(CampaignCommunicationSchedule.id)
            .filter(
                CampaignCommunicationSchedule.status == "SCHEDULED",
                CampaignCommunicationSchedule.last_dispatched_at.is_(None),
            )
            .filter(
                or_(
                    and_(
                        CampaignCommunicationSchedule.scheduled_for.isnot(None),
                        CampaignCommunicationSchedule.scheduled_for <= now,
                    ),
                    and_(
                        CampaignCommunicationSchedule.scheduled_for.is_(None),
                        CampaignCommunicationSchedule.milestone_key.isnot(None),
                        milestone_due,
                    ),
                )
            )
            .order_by(
                func.coalesce(
                    CampaignCommunicationSchedule.scheduled_for,
                    CampaignCommunicationSchedule.created_at,
                ).asc(),
                CampaignCommunicationSchedule.created_at.asc(),
            )
            .all()
        )
        return [str(row[0]) for row in rows]

    def get_schedule_for_dispatch(
        self,
        db: Session,
        *,
        schedule_id: str,
    ) -> CampaignCommunicationSchedule | None:
        return (
            db.query(CampaignCommunicationSchedule)
            .options(
                joinedload(CampaignCommunicationSchedule.template),
                joinedload(CampaignCommunicationSchedule.campaign),
            )
            .filter(CampaignCommunicationSchedule.id == schedule_id)
            .one_or_none()
        )

    def get_campaign_milestone(
        self,
        db: Session,
        *,
        campaign_id: str,
        milestone_key: str,
    ) -> CampaignMilestone | None:
        return (
            db.query(CampaignMilestone)
            .filter(
                CampaignMilestone.campaign_id == campaign_id,
                CampaignMilestone.milestone_key == milestone_key,
            )
            .one_or_none()
        )

    def list_campaign_ids_due_for_activation(
        self,
        db: Session,
        *,
        today,
    ) -> list[str]:
        rows = (
            db.query(Campaign.id)
            .filter(
                Campaign.status == CAMPAIGN_STATUS_DRAFT,
                Campaign.start_date.isnot(None),
                Campaign.start_date <= today,
            )
            .order_by(Campaign.start_date.asc(), Campaign.created_at.asc())
            .all()
        )
        return [str(row[0]) for row in rows]

    def list_campaign_ids_due_for_closure(
        self,
        db: Session,
        *,
        today,
    ) -> list[str]:
        rows = (
            db.query(Campaign.id)
            .filter(
                Campaign.status == CAMPAIGN_STATUS_ACTIVE,
                Campaign.end_date.isnot(None),
                Campaign.end_date < today,
            )
            .order_by(Campaign.end_date.asc(), Campaign.created_at.asc())
            .all()
        )
        return [str(row[0]) for row in rows]

    def count_recent_execution_issues(
        self,
        db: Session,
        *,
        campaign_id: str,
        lookback_hours: int = 72,
    ) -> int:
        cutoff = datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=lookback_hours)
        return int(
            db.query(func.count(CampaignAutomationExecution.id))
            .filter(
                CampaignAutomationExecution.campaign_id == campaign_id,
                CampaignAutomationExecution.status.in_(
                    [
                        CAMPAIGN_AUTOMATION_STATUS_FAILED,
                        CAMPAIGN_AUTOMATION_STATUS_BLOCKED,
                    ]
                ),
                CampaignAutomationExecution.created_at >= cutoff,
            )
            .scalar()
            or 0
        )

    def create_execution(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        schedule_id: uuid.UUID | None,
        execution_type: str,
        action_key: str,
    ) -> CampaignAutomationExecution:
        execution = CampaignAutomationExecution(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            schedule_id=schedule_id,
            execution_type=execution_type,
            action_key=action_key,
            status=CAMPAIGN_AUTOMATION_STATUS_STARTED,
        )
        db.add(execution)
        db.flush()
        return execution

    def complete_execution(
        self,
        db: Session,
        *,
        execution: CampaignAutomationExecution,
        status: str,
        details: dict[str, Any] | None = None,
        error_message: str | None = None,
        recipient_count: int = 0,
        delivered_count: int = 0,
        failed_count: int = 0,
    ) -> CampaignAutomationExecution:
        if status not in {
            CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED,
            CAMPAIGN_AUTOMATION_STATUS_FAILED,
            CAMPAIGN_AUTOMATION_STATUS_SKIPPED,
            CAMPAIGN_AUTOMATION_STATUS_BLOCKED,
        }:
            raise ValueError(f"Unsupported execution status: {status}")

        execution.status = status
        execution.details_json = json.dumps(details or {}, sort_keys=True) if details is not None else None
        execution.error_message = error_message
        execution.recipient_count = recipient_count
        execution.delivered_count = delivered_count
        execution.failed_count = failed_count
        execution.completed_at = datetime.now(UTC).replace(tzinfo=None)
        db.flush()
        return execution

    def mark_schedule_attempt(
        self,
        schedule: CampaignCommunicationSchedule,
        *,
        last_delivery_status: str,
        last_delivery_error: str | None = None,
        dispatched: bool,
    ) -> None:
        now = datetime.now(UTC).replace(tzinfo=None)
        schedule.last_attempted_at = now
        schedule.delivery_attempt_count = int(schedule.delivery_attempt_count or 0) + 1
        schedule.last_delivery_status = last_delivery_status
        schedule.last_delivery_error = last_delivery_error
        if dispatched:
            schedule.last_dispatched_at = now
