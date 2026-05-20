from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .donation_line import DonationLine
    from .sponsor import Sponsor


class Donation(Base):
    __tablename__ = "donation"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    sponsor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsor.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    source: Mapped[str] = mapped_column(
        Enum("DROP_OFF", "SHIPMENT", "CHURCH_PURCHASE", "OTHER", name="donation_source"),
        nullable=False,
        default="DROP_OFF",
    )

    received_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    received_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    campaign: Mapped["Campaign"] = relationship(back_populates="donations")
    sponsor: Mapped[Optional["Sponsor"]] = relationship(back_populates="donations")

    lines: Mapped[List["DonationLine"]] = relationship(
        back_populates="donation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_donation_campaign", "campaign_id"),
        Index("idx_donation_sponsor", "sponsor_id"),
        Index("idx_donation_received_at", "received_at"),
        Index("idx_donation_received_by", "received_by_user_id"),
    )
