from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .pickup_item import PickupItem
    from .recipient_group import RecipientGroup


class Pickup(Base):
    __tablename__ = "pickup"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_group_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("recipient_group.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    method: Mapped[str] = mapped_column(
        Enum("PICKUP", "DELIVERED", name="pickup_method"),
        nullable=False,
        default="PICKUP",
    )

    picked_up_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    picked_up_by_contact_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("group_contact.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    verified_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    campaign: Mapped["Campaign"] = relationship(back_populates="pickups")
    recipient_group: Mapped["RecipientGroup"] = relationship(back_populates="pickups")

    items: Mapped[List["PickupItem"]] = relationship(
        back_populates="pickup",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_pickup_campaign", "campaign_id"),
        Index("idx_pickup_group", "recipient_group_id"),
        Index("idx_pickup_time", "picked_up_at"),
        Index("idx_pickup_verified_by", "verified_by_user_id"),
    )
