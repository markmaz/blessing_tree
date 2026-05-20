from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from app.features.rbac.models.campaign_user_role import CampaignUserRole
    from .donation import Donation
    from .label_print_job import LabelPrintJob
    from .pickup import Pickup
    from .recipient_group import RecipientGroup
    from .scan_event import ScanEvent
    from .sponsor_interaction import SponsorInteraction
    from .sponsor_reminder import SponsorReminder
    from .sponsorship import Sponsorship
    from .storage_location import StorageLocation


class Campaign(Base):
    __tablename__ = "campaign"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    year: Mapped[int] = mapped_column(Integer, nullable=False)

    start_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    end_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)

    status: Mapped[str] = mapped_column(
        Enum("DRAFT", "ACTIVE", "CLOSED", "ARCHIVED", name="campaign_status"),
        nullable=False,
        default="DRAFT",
        index=True,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    storage_locations: Mapped[List["StorageLocation"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    campaign_user_roles: Mapped[List["CampaignUserRole"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    recipient_groups: Mapped[List["RecipientGroup"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    # sponsorships/donations/pickups/labels/scans/reminders/interactions
    sponsorships: Mapped[List["Sponsorship"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    donations: Mapped[List["Donation"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    pickups: Mapped[List["Pickup"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    label_print_jobs: Mapped[List["LabelPrintJob"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    scan_events: Mapped[List["ScanEvent"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    sponsor_interactions: Mapped[List["SponsorInteraction"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    sponsor_reminders: Mapped[List["SponsorReminder"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_campaign_year", "year"),
    )
