from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .campaign_member_constants import (
    APP_ACCESS_STATUS_NONE,
    CAMPAIGN_MEMBER_APP_ACCESS_STATUSES,
    CAMPAIGN_MEMBER_TYPE_VOLUNTEER,
    CAMPAIGN_MEMBER_TYPES,
)
from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign
    from .campaign_member_access_role import CampaignMemberAccessRole
    from .campaign_team_member import CampaignTeamMember


class CampaignMember(Base):
    __tablename__ = "campaign_member"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    member_type: Mapped[str] = mapped_column(
        Enum(*CAMPAIGN_MEMBER_TYPES, name="campaign_member_type"),
        nullable=False,
        default=CAMPAIGN_MEMBER_TYPE_VOLUNTEER,
    )
    app_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    app_access_status: Mapped[str] = mapped_column(
        Enum(*CAMPAIGN_MEMBER_APP_ACCESS_STATUSES, name="campaign_member_app_access_status"),
        nullable=False,
        default=APP_ACCESS_STATUS_NONE,
    )
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="campaign_members")
    app_user: Mapped[Optional["AppUser"]] = relationship(back_populates="campaign_members")
    access_roles: Mapped[list["CampaignMemberAccessRole"]] = relationship(
        back_populates="campaign_member",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    team_memberships: Mapped[list["CampaignTeamMember"]] = relationship(
        back_populates="campaign_member",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("campaign_id", "app_user_id", name="uq_campaign_member_campaign_app_user"),
        Index("idx_campaign_member_campaign", "campaign_id"),
        Index("idx_campaign_member_email", "email"),
        Index("idx_campaign_member_active", "campaign_id", "is_active"),
        Index("idx_campaign_member_app_user", "app_user_id"),
    )
