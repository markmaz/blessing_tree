from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, Integer, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .donation_line import DonationLine
    from .wishlist_item import WishlistItem


class Fulfillment(Base):
    __tablename__ = "fulfillment"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)

    wishlist_item_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    donation_line_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("donation_line.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    quantity_fulfilled: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    fulfilled_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    fulfilled_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    wishlist_item: Mapped["WishlistItem"] = relationship(back_populates="fulfillment_rows")
    donation_line: Mapped["DonationLine"] = relationship(back_populates="fulfillments")

    __table_args__ = (
        UniqueConstraint("wishlist_item_id", "donation_line_id", name="uq_fulfillment_pair"),
        Index("idx_fulfillment_item", "wishlist_item_id"),
        Index("idx_fulfillment_line", "donation_line_id"),
        Index("idx_fulfillment_time", "fulfilled_at"),
        Index("idx_fulfillment_by", "fulfilled_by_user_id"),
    )
