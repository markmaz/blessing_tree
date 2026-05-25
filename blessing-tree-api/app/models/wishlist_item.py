from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .recipient_constants import (
    WISHLIST_ITEM_TYPE_CLOTHING,
    WISHLIST_ITEM_TYPE_ESSENTIAL,
    WISHLIST_ITEM_TYPE_EXPERIENCE,
    WISHLIST_ITEM_TYPE_GIFT,
    WISHLIST_ITEM_TYPE_GIFT_CARD,
    WISHLIST_ITEM_TYPE_OTHER,
)
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .fulfillment import Fulfillment
    from .item_event import ItemEvent
    from .label_print_item import LabelPrintItem
    from .pickup_item import PickupItem
    from .scan_event import ScanEvent
    from .sponsorship_item import SponsorshipItem
    from .storage_location import StorageLocation
    from .wishlist import Wishlist


class WishlistItem(Base):
    __tablename__ = "wishlist_item"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    wishlist_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    item_type: Mapped[str] = mapped_column(
        Enum(
            WISHLIST_ITEM_TYPE_GIFT,
            WISHLIST_ITEM_TYPE_CLOTHING,
            WISHLIST_ITEM_TYPE_ESSENTIAL,
            WISHLIST_ITEM_TYPE_GIFT_CARD,
            WISHLIST_ITEM_TYPE_EXPERIENCE,
            WISHLIST_ITEM_TYPE_OTHER,
            name="wishlist_item_type",
        ),
        nullable=False,
        default=WISHLIST_ITEM_TYPE_GIFT,
    )
    description: Mapped[str] = mapped_column(String(512), nullable=False)
    size: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    qty_requested: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    priority: Mapped[str] = mapped_column(
        Enum("LOW", "MEDIUM", "HIGH", name="wishlist_item_priority"),
        nullable=False,
        default="MEDIUM",
    )
    est_cost_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    allow_substitute: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    do_not_substitute_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recipient_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    status: Mapped[str] = mapped_column(
        Enum(
            "OPEN",
            "RESERVED",
            "COMMITTED",
            "RECEIVED",
            "WRAPPED",
            "TAGGED",
            "READY_FOR_DISTRIBUTION",
            "DISTRIBUTED",
            "PICKED_UP",
            "EXCEPTION",
            "CANCELLED",
            name="wishlist_item_status",
        ),
        nullable=False,
        default="OPEN",
        index=True,
    )
    qty_fulfilled: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    storage_location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("storage_location.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    received_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    received_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    wrapped_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    wrapped_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    picked_up_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    picked_up_by_contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("group_contact.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    picked_up_verified_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    label_code: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    label_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    label_last_printed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    label_last_printed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    wishlist: Mapped["Wishlist"] = relationship(back_populates="items")
    storage_location: Mapped[Optional["StorageLocation"]] = relationship()

    sponsorship_item: Mapped[Optional["SponsorshipItem"]] = relationship(
        back_populates="wishlist_item",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    fulfillment_rows: Mapped[List["Fulfillment"]] = relationship(
        back_populates="wishlist_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    pickup_item: Mapped[Optional["PickupItem"]] = relationship(
        back_populates="wishlist_item",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    item_events: Mapped[List["ItemEvent"]] = relationship(
        back_populates="wishlist_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    label_print_items: Mapped[List["LabelPrintItem"]] = relationship(
        back_populates="wishlist_item",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    scan_events: Mapped[List["ScanEvent"]] = relationship(
        back_populates="wishlist_item",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_wishlist_item_wishlist", "wishlist_id"),
        Index("idx_wishlist_item_status", "status"),
        Index("idx_wishlist_item_storage", "storage_location_id"),
    )
