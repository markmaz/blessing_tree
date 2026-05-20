from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .pickup import Pickup
    from .wishlist_item import WishlistItem


class PickupItem(Base):
    __tablename__ = "pickup_item"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    pickup_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("pickup.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    wishlist_item_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        unique=True,  # one wishlist_item can be picked up once
    )

    pickup: Mapped["Pickup"] = relationship(back_populates="items")
    wishlist_item: Mapped["WishlistItem"] = relationship(back_populates="pickup_item")

    __table_args__ = (
        UniqueConstraint("wishlist_item_id", name="uq_pickup_item_once"),
        Index("idx_pickup_item_pickup", "pickup_id"),
    )
