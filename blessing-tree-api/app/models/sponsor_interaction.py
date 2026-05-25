from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .sponsor_constants import SPONSOR_INTERACTION_ORIGINS
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .sponsor import Sponsor


class SponsorInteraction(Base):
    __tablename__ = "sponsor_interaction"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    sponsor_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsor.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    channel: Mapped[str] = mapped_column(
        Enum("CALL", "EMAIL", "TEXT", "IN_PERSON", name="interaction_channel"),
        nullable=False,
    )
    direction: Mapped[str] = mapped_column(
        Enum("OUTBOUND", "INBOUND", name="interaction_direction"),
        nullable=False,
        default="OUTBOUND",
    )

    subject: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    origin_type: Mapped[str] = mapped_column(
        Enum(*SPONSOR_INTERACTION_ORIGINS, name="sponsor_interaction_origin_type"),
        nullable=False,
        default="MANUAL",
    )
    outcome: Mapped[str] = mapped_column(
        Enum(
            "LEFT_VM",
            "NO_ANSWER",
            "REACHED",
            "BOUNCED",
            "WRONG_NUMBER",
            "PROMISED_DATE",
            "COMPLETED",
            "OTHER",
            name="interaction_outcome",
        ),
        nullable=False,
        default="OTHER",
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    follow_up_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)

    related_sponsorship_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsorship.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )
    related_schedule_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDBin(), nullable=True, index=True)
    related_delivery_attempt_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    campaign: Mapped["Campaign"] = relationship(back_populates="sponsor_interactions")
    sponsor: Mapped["Sponsor"] = relationship(back_populates="interactions")

    __table_args__ = (
        Index("idx_sponsor_interaction_campaign", "campaign_id"),
        Index("idx_sponsor_interaction_sponsor", "sponsor_id"),
        Index("idx_sponsor_interaction_time", "occurred_at"),
        Index("idx_sponsor_interaction_followup", "follow_up_at"),
        Index("idx_sponsor_interaction_by", "created_by_user_id"),
    )
