from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .sponsor_constants import (
    SPONSORSHIP_DROP_OFF_STATUSES,
    SPONSORSHIP_INTEREST_STATUSES,
    SPONSORSHIP_STATUSES,
)
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .sponsor import Sponsor
    from .sponsorship_item import SponsorshipItem


class Sponsorship(Base):
    __tablename__ = "sponsorship"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsor.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    sponsor_code: Mapped[str | None] = mapped_column(String(64), nullable=True)

    status: Mapped[str] = mapped_column(
        Enum(*SPONSORSHIP_STATUSES, name="sponsorship_status"),
        nullable=False,
        default="ACTIVE",
    )
    interest_status: Mapped[str] = mapped_column(
        Enum(*SPONSORSHIP_INTEREST_STATUSES, name="sponsorship_interest_status"),
        nullable=False,
        default="NEW",
    )
    drop_off_status: Mapped[str] = mapped_column(
        Enum(*SPONSORSHIP_DROP_OFF_STATUSES, name="sponsorship_drop_off_status"),
        nullable=False,
        default="NOT_STARTED",
    )
    drop_off_due_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    drop_off_completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    self_registered: Mapped[bool] = mapped_column(nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    campaign: Mapped["Campaign"] = relationship(back_populates="sponsorships")
    sponsor: Mapped["Sponsor"] = relationship(back_populates="sponsorships")

    items: Mapped[List["SponsorshipItem"]] = relationship(
        back_populates="sponsorship",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_sponsorship_campaign", "campaign_id"),
        Index("idx_sponsorship_sponsor", "sponsor_id"),
        Index("idx_sponsorship_status", "campaign_id", "status"),
    )
