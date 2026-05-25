from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import Date, DateTime, Enum, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign_automation_execution import CampaignAutomationExecution
    from .campaign_event import CampaignEvent
    from .campaign_member import CampaignMember
    from .campaign_team import CampaignTeam
    from .campaign_communication_schedule import CampaignCommunicationSchedule
    from .campaign_gift_reminder_rule import CampaignGiftReminderRule
    from .communication_template import CommunicationTemplate
    from .campaign_milestone import CampaignMilestone
    from app.features.rbac.models.campaign_user_role import CampaignUserRole
    from .donation import Donation
    from .label_print_job import LabelPrintJob
    from .pickup import Pickup
    from .pending_sponsor_registration import PendingSponsorRegistration
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
    season_theme: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    public_sponsor_slug: Mapped[Optional[str]] = mapped_column(String(120), nullable=True, unique=True, index=True)
    public_sponsor_signup_enabled: Mapped[bool] = mapped_column(nullable=False, default=False)
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

    campaign_members: Mapped[List["CampaignMember"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    teams: Mapped[List["CampaignTeam"]] = relationship(
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
    pending_sponsor_registrations: Mapped[List["PendingSponsorRegistration"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    milestones: Mapped[List["CampaignMilestone"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    communication_schedules: Mapped[List["CampaignCommunicationSchedule"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    communication_templates: Mapped[List["CommunicationTemplate"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    gift_reminder_rules: Mapped[List["CampaignGiftReminderRule"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    events: Mapped[List["CampaignEvent"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    automation_executions: Mapped[List["CampaignAutomationExecution"]] = relationship(
        back_populates="campaign",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_campaign_year", "year"),
    )
