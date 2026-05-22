from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .recipient_constants import (
    RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_GROUP_STATUS_ARCHIVED,
    RECIPIENT_GROUP_STATUS_INACTIVE,
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
)
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .group_contact import GroupContact
    from .pickup import Pickup
    from .recipient import Recipient


class RecipientGroup(Base):
    __tablename__ = "recipient_group"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    group_type: Mapped[str] = mapped_column(
        Enum(
            RECIPIENT_GROUP_TYPE_HOUSEHOLD,
            RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
            name="recipient_group_type",
        ),
        nullable=False,
    )
    group_name: Mapped[str] = mapped_column(String(255), nullable=False)
    intake_source: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    external_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(
            RECIPIENT_GROUP_STATUS_ACTIVE,
            RECIPIENT_GROUP_STATUS_INACTIVE,
            RECIPIENT_GROUP_STATUS_ARCHIVED,
            name="recipient_group_status",
        ),
        nullable=False,
        default=RECIPIENT_GROUP_STATUS_ACTIVE,
    )

    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship(back_populates="recipient_groups")

    contacts: Mapped[List["GroupContact"]] = relationship(
        back_populates="recipient_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    recipients: Mapped[List["Recipient"]] = relationship(
        back_populates="recipient_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    pickups: Mapped[List["Pickup"]] = relationship(
        back_populates="recipient_group",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_recipient_group_campaign", "campaign_id"),
        Index("idx_recipient_group_type", "campaign_id", "group_type"),
        Index("idx_recipient_group_name", "campaign_id", "group_name"),
        Index("idx_recipient_group_status", "campaign_id", "status"),
    )
