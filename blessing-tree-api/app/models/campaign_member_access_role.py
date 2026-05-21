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
    from .campaign_member import CampaignMember


class CampaignMemberAccessRole(Base):
    __tablename__ = "campaign_member_access_role"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_member_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign_member.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    role_key: Mapped[str] = mapped_column(String(64), nullable=False)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign_member: Mapped["CampaignMember"] = relationship(back_populates="access_roles")

    __table_args__ = (
        UniqueConstraint("campaign_member_id", "role_key", name="uq_campaign_member_access_role_scope"),
        Index("idx_campaign_member_access_role_member", "campaign_member_id"),
        Index("idx_campaign_member_access_role_role", "role_key"),
    )
