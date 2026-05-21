from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign_member import CampaignMember
    from .campaign_team import CampaignTeam
    from .campaign_team_role import CampaignTeamRole


class CampaignTeamMember(Base):
    __tablename__ = "campaign_team_member"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign_team.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    campaign_member_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign_member.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    team_role_id: Mapped[uuid.UUID | None] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign_team_role.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    team: Mapped["CampaignTeam"] = relationship(back_populates="memberships")
    campaign_member: Mapped["CampaignMember"] = relationship(back_populates="team_memberships")
    team_role: Mapped[Optional["CampaignTeamRole"]] = relationship(
        back_populates="memberships"
    )

    __table_args__ = (
        UniqueConstraint("team_id", "campaign_member_id", name="uq_campaign_team_member_scope"),
        Index("idx_campaign_team_member_team", "team_id"),
        Index("idx_campaign_team_member_member", "campaign_member_id"),
        Index("idx_campaign_team_member_role", "team_role_id"),
    )
