from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign
    from .pending_sponsor_registration import PendingSponsorRegistration
    from .sponsor import Sponsor
    from .wishlist_item import WishlistItem


GIFT_RESERVATION_STATUS_ACTIVE = "ACTIVE"
GIFT_RESERVATION_STATUS_COMMITTED = "COMMITTED"
GIFT_RESERVATION_STATUS_RELEASED = "RELEASED"
GIFT_RESERVATION_STATUS_EXPIRED = "EXPIRED"

GIFT_RESERVATION_STATUSES = (
    GIFT_RESERVATION_STATUS_ACTIVE,
    GIFT_RESERVATION_STATUS_COMMITTED,
    GIFT_RESERVATION_STATUS_RELEASED,
    GIFT_RESERVATION_STATUS_EXPIRED,
)

GIFT_RESERVATION_SOURCE_PUBLIC_SIGNUP = "PUBLIC_SIGNUP"
GIFT_RESERVATION_SOURCE_STAFF = "STAFF"

GIFT_RESERVATION_SOURCES = (
    GIFT_RESERVATION_SOURCE_PUBLIC_SIGNUP,
    GIFT_RESERVATION_SOURCE_STAFF,
)


class GiftReservation(Base):
    __tablename__ = "gift_reservation"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    wishlist_item_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    active_wishlist_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True,
    )
    sponsor_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsor.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    pending_sponsor_registration_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("pending_sponsor_registration.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    reserved_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    reservation_source: Mapped[str] = mapped_column(
        Enum(*GIFT_RESERVATION_SOURCES, name="gift_reservation_source"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Enum(*GIFT_RESERVATION_STATUSES, name="gift_reservation_status"),
        nullable=False,
        default=GIFT_RESERVATION_STATUS_ACTIVE,
        index=True,
    )
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    committed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    released_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship()
    wishlist_item: Mapped["WishlistItem"] = relationship(foreign_keys=[wishlist_item_id])
    active_wishlist_item: Mapped[Optional["WishlistItem"]] = relationship(foreign_keys=[active_wishlist_item_id])
    sponsor: Mapped[Optional["Sponsor"]] = relationship()
    pending_sponsor_registration: Mapped[Optional["PendingSponsorRegistration"]] = relationship()
    reserved_by_user: Mapped[Optional["AppUser"]] = relationship()

    __table_args__ = (
        UniqueConstraint("active_wishlist_item_id", name="uq_active_gift_reservation_item"),
        Index("idx_gift_reservation_campaign_status", "campaign_id", "status"),
        Index("idx_gift_reservation_registration", "pending_sponsor_registration_id"),
        Index("idx_gift_reservation_item_status", "wishlist_item_id", "status"),
    )
