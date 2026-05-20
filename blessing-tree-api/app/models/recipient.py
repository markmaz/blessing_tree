from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
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

    recipient_type: Mapped[str] = mapped_column(
        Enum("CHILD", "ADULT", "SENIOR", name="recipient_type"),
        nullable=False,
    )
    privacy_level: Mapped[str] = mapped_column(
        Enum("ANONYMOUS", "INITIALS", "FULL_NAME", name="privacy_level"),
        nullable=False,
        default="ANONYMOUS",
    )

    display_label: Mapped[str] = mapped_column(String(255), nullable=False)

    first_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    age: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    gender: Mapped[Optional[str]] = mapped_column(Enum("M", "F", "X", "U", name="gender"), nullable=True)

    subgroup_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        Enum("ACTIVE", "INACTIVE", name="recipient_status"),
        nullable=False,
        default="ACTIVE",
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
        Index("idx_recipient_group", "recipient_group_id"),
        Index("idx_recipient_campaign", "campaign_id"),
        Index("idx_recipient_type", "campaign_id", "recipient_type"),
        Index("idx_recipient_status", "campaign_id", "status"),
    )
