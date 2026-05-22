from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .recipient_constants import (
    WISHLIST_INTAKE_METHOD_FORM,
    WISHLIST_INTAKE_METHOD_IMPORT,
    WISHLIST_INTAKE_METHOD_OTHER,
    WISHLIST_INTAKE_METHOD_PHONE,
    WISHLIST_INTAKE_METHOD_STAFF_ENTRY,
    WISHLIST_STATUS_DRAFT,
    WISHLIST_STATUS_LOCKED,
    WISHLIST_STATUS_READY,
)
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .group_contact import GroupContact
    from .recipient import Recipient
    from .wishlist_item import WishlistItem


class Wishlist(Base):
    __tablename__ = "wishlist"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("recipient.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    wishlist_status: Mapped[str] = mapped_column(
        Enum(WISHLIST_STATUS_DRAFT, WISHLIST_STATUS_READY, WISHLIST_STATUS_LOCKED, name="wishlist_status"),
        nullable=False,
        default=WISHLIST_STATUS_DRAFT,
    )
    intake_method: Mapped[Optional[str]] = mapped_column(
        Enum(
            WISHLIST_INTAKE_METHOD_PHONE,
            WISHLIST_INTAKE_METHOD_FORM,
            WISHLIST_INTAKE_METHOD_STAFF_ENTRY,
            WISHLIST_INTAKE_METHOD_IMPORT,
            WISHLIST_INTAKE_METHOD_OTHER,
            name="wishlist_intake_method",
        ),
        nullable=True,
    )
    submitted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    intake_completed_by_contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("group_contact.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipient: Mapped["Recipient"] = relationship(back_populates="wishlist")
    intake_completed_by_contact: Mapped[Optional["GroupContact"]] = relationship()

    items: Mapped[List["WishlistItem"]] = relationship(
        back_populates="wishlist",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("campaign_id", "recipient_id", name="uq_wishlist_per_recipient"),
        Index("idx_wishlist_campaign", "campaign_id"),
        Index("idx_wishlist_recipient", "recipient_id"),
        Index("idx_wishlist_status", "campaign_id", "wishlist_status"),
    )
