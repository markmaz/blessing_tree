from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign_team import CampaignTeam
    from .campaign_team_member import CampaignTeamMember


class CampaignTeamRole(Base):
    __tablename__ = "campaign_team_role"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    team_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign_team.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    team: Mapped["CampaignTeam"] = relationship(back_populates="roles")
    memberships: Mapped[list["CampaignTeamMember"]] = relationship(
        back_populates="team_role"
    )

    __table_args__ = (
        UniqueConstraint("team_id", "name", name="uq_campaign_team_role_team_name"),
        Index("idx_campaign_team_role_team", "team_id"),
        Index("idx_campaign_team_role_active", "team_id", "is_active"),
        Index("idx_campaign_team_role_sort", "team_id", "sort_order"),
    )
