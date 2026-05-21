from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import Date, DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign


class CampaignMilestone(Base):
    __tablename__ = "campaign_milestone"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    milestone_key: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    occurs_on: Mapped[date] = mapped_column(Date, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="milestones")

    __table_args__ = (
        UniqueConstraint("campaign_id", "milestone_key", name="uq_campaign_milestone_scope"),
        Index("idx_campaign_milestone_campaign", "campaign_id"),
        Index("idx_campaign_milestone_occurs_on", "occurs_on"),
    )
