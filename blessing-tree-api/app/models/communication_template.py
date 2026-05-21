from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy import UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign
    from .campaign_communication_schedule import CampaignCommunicationSchedule


class CommunicationTemplate(Base):
    __tablename__ = "communication_template"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    template_key: Mapped[str] = mapped_column(String(100), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    audience: Mapped[str] = mapped_column(
        Enum("SPONSOR", "VOLUNTEER", "MANAGER", "FAMILY", "GENERAL", name="communication_template_audience"),
        nullable=False,
        default="GENERAL",
    )
    channel: Mapped[str] = mapped_column(
        Enum("EMAIL", name="communication_template_channel"),
        nullable=False,
        default="EMAIL",
    )
    subject_template: Mapped[str] = mapped_column(String(255), nullable=False)
    body_template: Mapped[str] = mapped_column(Text, nullable=False)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="communication_templates")
    created_by_user: Mapped[Optional["AppUser"]] = relationship()
    schedules: Mapped[List["CampaignCommunicationSchedule"]] = relationship(
        back_populates="template",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("campaign_id", "template_key", name="uq_communication_template_campaign_key"),
        Index("idx_communication_template_campaign", "campaign_id"),
        Index("idx_communication_template_audience", "campaign_id", "audience"),
        Index("idx_communication_template_active", "campaign_id", "is_active"),
    )
