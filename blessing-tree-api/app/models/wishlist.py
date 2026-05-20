from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
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
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipient: Mapped["Recipient"] = relationship(back_populates="wishlist")

    items: Mapped[List["WishlistItem"]] = relationship(
        back_populates="wishlist",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("campaign_id", "recipient_id", name="uq_wishlist_per_recipient"),
        Index("idx_wishlist_campaign", "campaign_id"),
        Index("idx_wishlist_recipient", "recipient_id"),
    )
