from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .sponsor import Sponsor


class SponsorReminder(Base):
    __tablename__ = "sponsor_reminder"

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

    reminder_type: Mapped[str] = mapped_column(
        Enum("DROP_OFF_REMINDER_1", "DROP_OFF_REMINDER_2", "FINAL_NOTICE", "CUSTOM", name="reminder_type"),
        nullable=False,
        default="CUSTOM",
    )

    planned_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("PLANNED", "SENT", "SKIPPED", name="reminder_status"),
        nullable=False,
        default="PLANNED",
        index=True,
    )
    sent_via: Mapped[str] = mapped_column(
        Enum("EMAIL", "TEXT", "CALL", "NONE", name="reminder_sent_via"),
        nullable=False,
        default="NONE",
    )

    interaction_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("sponsor_interaction.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="sponsor_reminders")
    sponsor: Mapped["Sponsor"] = relationship(back_populates="reminders")
