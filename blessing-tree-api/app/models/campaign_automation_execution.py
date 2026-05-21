from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .campaign_communication_schedule import CampaignCommunicationSchedule


class CampaignAutomationExecution(Base):
    __tablename__ = "campaign_automation_execution"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    schedule_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign_communication_schedule.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    execution_type: Mapped[str] = mapped_column(
        Enum("COMMUNICATION_DISPATCH", "LIFECYCLE_TRANSITION", name="campaign_automation_execution_type"),
        nullable=False,
    )
    action_key: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("STARTED", "SUCCEEDED", "FAILED", "SKIPPED", "BLOCKED", name="campaign_automation_execution_status"),
        nullable=False,
        default="STARTED",
    )
    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    delivered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    details_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    campaign: Mapped["Campaign"] = relationship(back_populates="automation_executions")
    schedule: Mapped[Optional["CampaignCommunicationSchedule"]] = relationship(
        back_populates="automation_executions"
    )

    __table_args__ = (
        Index("idx_campaign_automation_execution_campaign", "campaign_id"),
        Index("idx_campaign_automation_execution_schedule", "schedule_id"),
        Index("idx_campaign_automation_execution_type", "execution_type"),
        Index("idx_campaign_automation_execution_status", "status"),
        Index("idx_campaign_automation_execution_created", "created_at"),
    )
