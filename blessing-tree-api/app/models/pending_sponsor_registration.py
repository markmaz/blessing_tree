from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .sponsor_constants import (
    PENDING_SPONSOR_REGISTRATION_STATUSES,
    SPONSOR_SOURCES,
)
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .sponsor import Sponsor


class PendingSponsorRegistration(Base):
    __tablename__ = "pending_sponsor_registration"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    matched_sponsor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsor.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    organization_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    preferred_contact: Mapped[str] = mapped_column(
        Enum("EMAIL", "PHONE", "TEXT", "NONE", name="pending_sponsor_preferred_contact"),
        nullable=False,
        default="EMAIL",
    )
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    source: Mapped[str] = mapped_column(
        Enum(*SPONSOR_SOURCES, name="pending_sponsor_source"),
        nullable=False,
        default="PUBLIC_LINK",
    )
    selected_wishlist_item_ids_json: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verification_token: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    verification_sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    status: Mapped[str] = mapped_column(
        Enum(*PENDING_SPONSOR_REGISTRATION_STATUSES, name="pending_sponsor_registration_status"),
        nullable=False,
        default="PENDING",
        index=True,
    )
    submitted_ip: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="pending_sponsor_registrations")
    matched_sponsor: Mapped[Optional["Sponsor"]] = relationship(back_populates="pending_registrations")

    __table_args__ = (
        Index("idx_pending_sponsor_registration_campaign_status", "campaign_id", "status"),
        Index("idx_pending_sponsor_registration_campaign_email", "campaign_id", "email"),
    )
