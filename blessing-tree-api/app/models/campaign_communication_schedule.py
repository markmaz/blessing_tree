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
    from .campaign_automation_execution import CampaignAutomationExecution
    from .communication_template import CommunicationTemplate


class CampaignCommunicationSchedule(Base):
    __tablename__ = "campaign_communication_schedule"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("communication_template.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
    )
    milestone_key: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    scheduled_for: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("DRAFT", "SCHEDULED", "DISABLED", name="campaign_communication_schedule_status"),
        nullable=False,
        default="DRAFT",
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    last_attempted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_dispatched_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivery_attempt_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_delivery_status: Mapped[Optional[str]] = mapped_column(
        Enum("SENT", "FAILED", "SKIPPED", name="campaign_schedule_delivery_status"),
        nullable=True,
    )
    last_delivery_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="communication_schedules")
    template: Mapped["CommunicationTemplate"] = relationship(back_populates="schedules")
    automation_executions: Mapped[list["CampaignAutomationExecution"]] = relationship(
        back_populates="schedule",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_campaign_communication_schedule_campaign", "campaign_id"),
        Index("idx_campaign_communication_schedule_template", "template_id"),
        Index("idx_campaign_communication_schedule_status", "status"),
        Index("idx_campaign_communication_schedule_scheduled_for", "scheduled_for"),
        Index("idx_campaign_communication_schedule_last_delivery_status", "last_delivery_status"),
    )
