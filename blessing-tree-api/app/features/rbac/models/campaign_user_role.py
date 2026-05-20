from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base
from app.models.uuid_bin import UUIDBin

if TYPE_CHECKING:
    from app.models.app_user import AppUser
    from app.models.campaign import Campaign


class CampaignUserRole(Base):
    __tablename__ = "campaign_user_role"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    role_key: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="campaign_user_roles")
    user: Mapped["AppUser"] = relationship(back_populates="campaign_user_roles")

    __table_args__ = (
        UniqueConstraint("campaign_id", "user_id", "role_key", name="uq_campaign_user_role_scope"),
        Index("idx_campaign_user_role_scope", "campaign_id", "user_id"),
        Index("idx_campaign_user_role_role", "campaign_id", "role_key"),
        Index("idx_campaign_user_role_user", "user_id"),
    )
