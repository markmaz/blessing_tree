from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .sponsorship import Sponsorship
    from .wishlist_item import WishlistItem


class SponsorshipItem(Base):
    __tablename__ = "sponsorship_item"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    sponsorship_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsorship.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    wishlist_item_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        unique=True,  # one owner per wishlist_item
    )

    qty_committed: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    committed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    sponsorship: Mapped["Sponsorship"] = relationship(back_populates="items")
    wishlist_item: Mapped["WishlistItem"] = relationship(back_populates="sponsorship_item")

    __table_args__ = (
        Index("idx_sponsorship_item_sponsorship", "sponsorship_id"),
    )
