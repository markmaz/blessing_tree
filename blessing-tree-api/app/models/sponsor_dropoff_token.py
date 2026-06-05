from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign
    from .sponsor import Sponsor
    from .sponsor_dropoff_scan_event import SponsorDropoffScanEvent
    from .sponsorship import Sponsorship


class SponsorDropoffToken(Base):
    __tablename__ = "sponsor_dropoff_token"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
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
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_scanned_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    created_by_user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship()
    sponsorship: Mapped["Sponsorship"] = relationship(back_populates="dropoff_tokens")
    sponsor: Mapped["Sponsor"] = relationship()
    created_by_user: Mapped["AppUser | None"] = relationship()
    scan_events: Mapped[List["SponsorDropoffScanEvent"]] = relationship(
        back_populates="token",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_sponsor_dropoff_token_campaign", "campaign_id"),
        Index("idx_sponsor_dropoff_token_sponsorship", "sponsorship_id"),
        Index("idx_sponsor_dropoff_token_sponsor", "sponsor_id"),
        Index("idx_sponsor_dropoff_token_expires", "expires_at"),
    )
