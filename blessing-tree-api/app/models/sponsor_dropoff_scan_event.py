from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign
    from .sponsor import Sponsor
    from .sponsor_dropoff_token import SponsorDropoffToken
    from .sponsorship import Sponsorship


class SponsorDropoffScanEvent(Base):
    __tablename__ = "sponsor_dropoff_scan_event"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    token_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsor_dropoff_token.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    sponsorship_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsorship.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsor.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    scanned_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    scanned_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    outcome: Mapped[str] = mapped_column(String(32), nullable=False)
    user_agent: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    token: Mapped["SponsorDropoffToken"] = relationship(back_populates="scan_events")
    campaign: Mapped["Campaign"] = relationship()
    sponsorship: Mapped["Sponsorship"] = relationship()
    sponsor: Mapped["Sponsor"] = relationship()
    scanned_by_user: Mapped["AppUser | None"] = relationship()

    __table_args__ = (
        Index("idx_sponsor_dropoff_scan_event_token", "token_id"),
        Index("idx_sponsor_dropoff_scan_event_campaign", "campaign_id"),
        Index("idx_sponsor_dropoff_scan_event_sponsor", "sponsor_id"),
        Index("idx_sponsor_dropoff_scan_event_scanned_at", "scanned_at"),
    )
