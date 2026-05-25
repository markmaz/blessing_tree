from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Integer, String, Text
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from .uuid_bin import UUIDBin


class CampaignMilestoneDefinition(Base):
    __tablename__ = "campaign_milestone_definition"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True, default=uuid.uuid4)
    milestone_key: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    feature_area: Mapped[str] = mapped_column(
        Enum("GENERAL", "RECIPIENTS", "SPONSORS", "GIFTS", "PICKUP", "COMMUNICATIONS", name="campaign_milestone_feature_area"),
        nullable=False,
        default="GENERAL",
    )
    default_sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    is_system: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
