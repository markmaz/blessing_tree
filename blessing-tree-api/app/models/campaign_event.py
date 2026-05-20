from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign


class CampaignEvent(Base):
    __tablename__ = "campaign_event"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(
        Enum(
            "GENERAL",
            "VOLUNTEER",
            "SPONSOR",
            "DONATION",
            "RECIPIENT",
            "GIFT",
            "PICKUP",
            "COMMUNICATION",
            "MILESTONE",
            name="campaign_event_type",
        ),
        nullable=False,
        default="GENERAL",
    )
    start_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    end_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    all_day: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(
        Enum("manual", "milestone", "communication", name="campaign_event_source_type"),
        nullable=False,
        default="manual",
    )
    source_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDBin(), nullable=True)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="events")
    created_by_user: Mapped[Optional["AppUser"]] = relationship()

    __table_args__ = (
        Index("idx_campaign_event_campaign_start", "campaign_id", "start_at"),
        Index("idx_campaign_event_campaign_type", "campaign_id", "event_type"),
        Index("idx_campaign_event_campaign_source_type", "campaign_id", "source_type"),
    )
