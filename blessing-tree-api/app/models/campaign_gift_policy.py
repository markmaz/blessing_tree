from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Integer
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign


RECIPIENT_COVERAGE_RULES = (
    "ONE_GIFT_SPONSORED",
    "MIN_GIFTS_SPONSORED",
    "ALL_GIFTS_SPONSORED",
)


class CampaignGiftPolicy(Base):
    __tablename__ = "campaign_gift_policy"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        unique=True,
        index=True,
    )
    max_gifts_per_sponsor: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    max_wishlist_items_per_recipient: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    recipient_coverage_rule: Mapped[str] = mapped_column(
        Enum(*RECIPIENT_COVERAGE_RULES, name="recipient_coverage_rule"),
        nullable=False,
        default="ALL_GIFTS_SPONSORED",
    )
    recipient_coverage_required_count: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    allow_partial_sponsor_commitments: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=0)
    reservation_hold_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=1440)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship()
