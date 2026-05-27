from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign
    from .wishlist_item import WishlistItem


class CampaignManualGiftLabel(Base):
    __tablename__ = "campaign_manual_gift_label"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    label_code: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        Enum("UNASSIGNED", "ATTACHED", "VOID", name="campaign_manual_gift_label_status"),
        nullable=False,
        default="UNASSIGNED",
    )
    attached_wishlist_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="manual_gift_labels")
    attached_wishlist_item: Mapped[Optional["WishlistItem"]] = relationship()
    created_by_user: Mapped[Optional["AppUser"]] = relationship()

    __table_args__ = (
        UniqueConstraint("label_code", name="uq_campaign_manual_gift_label_code"),
        Index("idx_campaign_manual_gift_label_campaign", "campaign_id"),
        Index("idx_campaign_manual_gift_label_status", "campaign_id", "status"),
        Index("idx_campaign_manual_gift_label_attached_item", "attached_wishlist_item_id"),
        Index("idx_campaign_manual_gift_label_created_by", "created_by_user_id"),
    )
