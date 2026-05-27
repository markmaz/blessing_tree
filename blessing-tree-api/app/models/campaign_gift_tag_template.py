from __future__ import annotations

import uuid
from datetime import datetime
from decimal import Decimal
from typing import Any, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, JSON, Numeric, String, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign


class CampaignGiftTagTemplate(Base):
    __tablename__ = "campaign_gift_tag_template"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    template_key: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    tag_width_in: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, default=Decimal("3.00"))
    tag_height_in: Mapped[Decimal] = mapped_column(Numeric(4, 2), nullable=False, default=Decimal("2.00"))
    orientation: Mapped[str] = mapped_column(
        Enum("PORTRAIT", "LANDSCAPE", name="campaign_gift_tag_orientation"),
        nullable=False,
        default="LANDSCAPE",
    )
    layout_json: Mapped[dict[str, Any]] = mapped_column(JSON, nullable=False)
    gift_tag_message: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    include_cut_lines_default: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="gift_tag_templates")
    created_by_user: Mapped[Optional["AppUser"]] = relationship()

    __table_args__ = (
        UniqueConstraint("campaign_id", "template_key", name="uq_campaign_gift_tag_template_campaign_key"),
        Index("idx_campaign_gift_tag_template_campaign", "campaign_id"),
        Index("idx_campaign_gift_tag_template_active", "campaign_id", "is_active"),
        Index("idx_campaign_gift_tag_template_created_by", "created_by_user_id"),
    )
