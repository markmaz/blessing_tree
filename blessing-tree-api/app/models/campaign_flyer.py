from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, JSON, String, Text, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign


class CampaignFlyer(Base):
    __tablename__ = "campaign_flyer"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    flyer_key: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    flyer_type: Mapped[str] = mapped_column(
        Enum("SPONSOR_RECRUITMENT", "CUSTOM", name="campaign_flyer_type"),
        nullable=False,
        default="SPONSOR_RECRUITMENT",
    )
    headline: Mapped[str] = mapped_column(String(255), nullable=False)
    subheadline: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    body_text: Mapped[str] = mapped_column(Text, nullable=False)
    call_to_action: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_info: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    qr_target_type: Mapped[str] = mapped_column(
        Enum("PUBLIC_SPONSOR_SIGNUP", "CUSTOM_URL", "NONE", name="campaign_flyer_qr_target_type"),
        nullable=False,
        default="PUBLIC_SPONSOR_SIGNUP",
    )
    qr_custom_url: Mapped[Optional[str]] = mapped_column(String(1024), nullable=True)
    theme_mode: Mapped[str] = mapped_column(
        Enum("CAMPAIGN_PURPOSE", "BLESSING_TREE", "CUSTOM", "NONE", name="campaign_flyer_theme_mode"),
        nullable=False,
        default="CAMPAIGN_PURPOSE",
    )
    image_prompt: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    layout_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="flyers")
    created_by_user: Mapped[Optional["AppUser"]] = relationship()

    __table_args__ = (
        UniqueConstraint("campaign_id", "flyer_key", name="uq_campaign_flyer_campaign_key"),
        Index("idx_campaign_flyer_campaign", "campaign_id"),
        Index("idx_campaign_flyer_type", "campaign_id", "flyer_type"),
        Index("idx_campaign_flyer_active", "campaign_id", "is_active"),
    )
