from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Index, JSON, String, Text
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from .uuid_bin import UUIDBin


class CampaignReadinessRuleDefinition(Base):
    __tablename__ = "campaign_readiness_rule_definition"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True, default=uuid.uuid4)
    rule_key: Mapped[str] = mapped_column(String(120), nullable=False, unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    rule_type: Mapped[str] = mapped_column(Enum("MISSING_MILESTONE", name="campaign_readiness_rule_type"), nullable=False)
    feature_area: Mapped[str] = mapped_column(
        Enum("GENERAL", "RECIPIENTS", "SPONSORS", "GIFTS", "PICKUP", "COMMUNICATIONS", name="campaign_readiness_feature_area"),
        nullable=False,
        default="GENERAL",
    )
    condition_type: Mapped[str] = mapped_column(
        Enum("ALWAYS", "CAMPAIGN_FIELD_TRUE", "CAMPAIGN_STATUS_IS", "FEATURE_ENABLED", name="campaign_readiness_condition_type"),
        nullable=False,
        default="ALWAYS",
    )
    condition_config_json: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    milestone_key: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    severity: Mapped[str] = mapped_column(Enum("error", "warning", "info", name="campaign_readiness_severity"), nullable=False)
    category: Mapped[str] = mapped_column(
        Enum("blockers", "launch_checks", "planning_gaps", "operational_health", name="campaign_readiness_category"),
        nullable=False,
    )
    blocking_for_json: Mapped[list[str]] = mapped_column(JSON, nullable=False)
    section: Mapped[str] = mapped_column(String(64), nullable=False)
    action_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    message: Mapped[str] = mapped_column(String(512), nullable=False)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    is_system: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        Index("idx_campaign_readiness_rule_active_type", "is_active", "rule_type"),
        Index("idx_campaign_readiness_rule_milestone", "milestone_key"),
    )
