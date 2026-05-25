from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .communication_template import CommunicationTemplate


GIFT_REMINDER_AUDIENCE_COMMITTED_UNRECEIVED = "SPONSORS_WITH_COMMITTED_UNRECEIVED_GIFTS"
GIFT_REMINDER_AUDIENCE_OVERDUE = "SPONSORS_WITH_OVERDUE_GIFTS"
GIFT_REMINDER_AUDIENCE_RECEIVED = "SPONSORS_WITH_RECEIVED_GIFTS"

GIFT_REMINDER_AUDIENCES = (
    GIFT_REMINDER_AUDIENCE_COMMITTED_UNRECEIVED,
    GIFT_REMINDER_AUDIENCE_OVERDUE,
    GIFT_REMINDER_AUDIENCE_RECEIVED,
)


class CampaignGiftReminderRule(Base):
    __tablename__ = "campaign_gift_reminder_rule"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
    )
    rule_key: Mapped[str] = mapped_column(String(100), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    is_enabled: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    audience: Mapped[str] = mapped_column(
        Enum(*GIFT_REMINDER_AUDIENCES, name="campaign_gift_reminder_audience"),
        nullable=False,
    )
    milestone_key: Mapped[Optional[str]] = mapped_column(String(100), nullable=True)
    offset_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    send_time_local: Mapped[str] = mapped_column(String(5), nullable=False, default="09:00")
    template_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("communication_template.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    channel: Mapped[str] = mapped_column(
        Enum("EMAIL", name="campaign_gift_reminder_channel"),
        nullable=False,
        default="EMAIL",
    )
    suppress_if_all_received: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    last_evaluated_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="gift_reminder_rules")
    template: Mapped[Optional["CommunicationTemplate"]] = relationship()

    __table_args__ = (
        UniqueConstraint("campaign_id", "rule_key", name="uq_campaign_gift_reminder_rule_key"),
        Index("idx_campaign_gift_reminder_campaign", "campaign_id"),
        Index("idx_campaign_gift_reminder_enabled", "campaign_id", "is_enabled"),
        Index("idx_campaign_gift_reminder_template", "template_id"),
    )
