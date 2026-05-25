from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .wishlist_item import WishlistItem


class ScanEvent(Base):
    __tablename__ = "scan_event"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    label_code: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    wishlist_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    scanned_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)

    scanned_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    action_taken: Mapped[str] = mapped_column(
        Enum(
            "LOOKUP",
            "MARK_RECEIVED",
            "MARK_WRAPPED",
            "MARK_READY",
            "MARK_DISTRIBUTED",
            "MARK_PICKED_UP",
            "REPRINT",
            "MARK_EXCEPTION",
            "ERROR",
            name="scan_action_taken",
        ),
        nullable=False,
        default="LOOKUP",
    )

    detail_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    campaign: Mapped["Campaign"] = relationship(back_populates="scan_events")
    wishlist_item: Mapped[Optional["WishlistItem"]] = relationship(back_populates="scan_events")

    __table_args__ = (
        Index("idx_scan_event_campaign", "campaign_id"),
        Index("idx_scan_event_label", "label_code"),
        Index("idx_scan_event_time", "scanned_at"),
        Index("idx_scan_event_item", "wishlist_item_id"),
        Index("idx_scan_event_user", "scanned_by_user_id"),
    )
