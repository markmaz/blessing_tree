from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, Index, String, Text
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .sponsor_constants import SPONSOR_SOURCES
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .donation import Donation
    from .pending_sponsor_registration import PendingSponsorRegistration
    from .sponsor_interaction import SponsorInteraction
    from .sponsor_reminder import SponsorReminder
    from .sponsorship import Sponsorship


class Sponsor(Base):
    __tablename__ = "sponsor"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    organization_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    preferred_contact: Mapped[str] = mapped_column(
        Enum("EMAIL", "PHONE", "TEXT", "NONE", name="sponsor_preferred_contact"),
        nullable=False,
        default="NONE",
    )
    source: Mapped[str] = mapped_column(
        Enum(*SPONSOR_SOURCES, name="sponsor_source"),
        nullable=False,
        default="STAFF_ENTRY",
    )
    source_detail: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    self_registered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    last_contacted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    do_not_contact: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=0)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    sponsorships: Mapped[List["Sponsorship"]] = relationship(back_populates="sponsor")
    donations: Mapped[List["Donation"]] = relationship(back_populates="sponsor")

    interactions: Mapped[List["SponsorInteraction"]] = relationship(back_populates="sponsor")
    reminders: Mapped[List["SponsorReminder"]] = relationship(back_populates="sponsor")
    pending_registrations: Mapped[List["PendingSponsorRegistration"]] = relationship(back_populates="matched_sponsor")

    __table_args__ = (
        Index("idx_sponsor_name", "display_name"),
        Index("idx_sponsor_email", "email"),
        Index("idx_sponsor_phone", "phone"),
    )
