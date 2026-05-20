from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Index, String, Text
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .donation import Donation
    from .sponsor_interaction import SponsorInteraction
    from .sponsor_reminder import SponsorReminder
    from .sponsorship import Sponsorship


class Sponsor(Base):
    __tablename__ = "sponsor"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    preferred_contact: Mapped[str] = mapped_column(
        Enum("EMAIL", "PHONE", "TEXT", "NONE", name="sponsor_preferred_contact"),
        nullable=False,
        default="NONE",
    )
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    sponsorships: Mapped[List["Sponsorship"]] = relationship(back_populates="sponsor")
    donations: Mapped[List["Donation"]] = relationship(back_populates="sponsor")

    interactions: Mapped[List["SponsorInteraction"]] = relationship(back_populates="sponsor")
    reminders: Mapped[List["SponsorReminder"]] = relationship(back_populates="sponsor")

    __table_args__ = (
        Index("idx_sponsor_name", "display_name"),
        Index("idx_sponsor_email", "email"),
        Index("idx_sponsor_phone", "phone"),
    )
