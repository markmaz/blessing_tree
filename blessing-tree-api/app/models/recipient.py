from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .recipient_constants import (
    RECIPIENT_AGE_UNIT_MONTHS,
    RECIPIENT_AGE_UNIT_YEARS,
    RECIPIENT_KIND_ADULT,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
    RECIPIENT_PRIVACY_LEVEL_INITIALS,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT,
    RECIPIENT_PROGRAM_TYPE_ORGANIZATION_CHILD,
    RECIPIENT_STATUS_ACTIVE,
    RECIPIENT_STATUS_INACTIVE,
)
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .recipient_group import RecipientGroup
    from .wishlist import Wishlist


class Recipient(Base):
    __tablename__ = "recipient"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_group_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("recipient_group.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    recipient_kind: Mapped[str] = mapped_column(
        Enum(RECIPIENT_KIND_CHILD, RECIPIENT_KIND_ADULT, name="recipient_kind"),
        nullable=False,
    )
    program_type: Mapped[str] = mapped_column(
        Enum(
            RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
            RECIPIENT_PROGRAM_TYPE_ORGANIZATION_CHILD,
            RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT,
            name="recipient_program_type",
        ),
        nullable=False,
    )
    privacy_level: Mapped[str] = mapped_column(
        Enum(
            RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
            RECIPIENT_PRIVACY_LEVEL_INITIALS,
            RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
            name="privacy_level",
        ),
        nullable=False,
        default=RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
    )

    display_label: Mapped[str] = mapped_column(String(255), nullable=False)
    public_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    program_recipient_number: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    program_recipient_id: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)

    first_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    birth_year: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    age_unit: Mapped[Optional[str]] = mapped_column(
        Enum(RECIPIENT_AGE_UNIT_MONTHS, RECIPIENT_AGE_UNIT_YEARS, name="recipient_age_unit"),
        nullable=True,
    )
    gender: Mapped[Optional[str]] = mapped_column(Enum("M", "F", "X", "U", name="gender"), nullable=True)
    address_line1: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    address_line2: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    city: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    state: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    postal_code: Mapped[Optional[str]] = mapped_column(String(32), nullable=True)
    direct_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    direct_phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    facility_room: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    subgroup_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    mobility_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(RECIPIENT_STATUS_ACTIVE, RECIPIENT_STATUS_INACTIVE, name="recipient_status"),
        nullable=False,
        default=RECIPIENT_STATUS_ACTIVE,
    )

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipient_group: Mapped["RecipientGroup"] = relationship(back_populates="recipients")

    wishlist: Mapped[Optional["Wishlist"]] = relationship(
        back_populates="recipient",
        uselist=False,
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        UniqueConstraint("campaign_id", "recipient_group_id", "display_label", name="uq_recipient_label"),
        UniqueConstraint("campaign_id", "program_recipient_id", name="uq_recipient_program_id"),
        Index("idx_recipient_group", "recipient_group_id"),
        Index("idx_recipient_campaign", "campaign_id"),
        Index("idx_recipient_program_id", "campaign_id", "program_recipient_id"),
        Index("idx_recipient_kind", "campaign_id", "recipient_kind"),
        Index("idx_recipient_program_type", "campaign_id", "program_type"),
        Index("idx_recipient_status", "campaign_id", "status"),
    )
