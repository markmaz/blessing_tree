from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .wishlist_item import WishlistItem


class ItemEvent(Base):
    __tablename__ = "item_event"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)

    wishlist_item_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    event_type: Mapped[str] = mapped_column(
        Enum(
            "COMMITTED",
            "UNCOMMITTED",
            "RECEIVED",
            "WRAPPED",
            "LABEL_PRINTED",
            "PICKED_UP",
            "STATUS_CHANGED",
            "NOTE",
            name="item_event_type",
        ),
        nullable=False,
        index=True,
    )

    event_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    detail_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    wishlist_item: Mapped["WishlistItem"] = relationship(back_populates="item_events")

    __table_args__ = (
        Index("idx_item_event_item", "wishlist_item_id"),
        Index("idx_item_event_time", "event_at"),
        Index("idx_item_event_type", "event_type"),
        Index("idx_item_event_actor", "actor_user_id"),
    )
