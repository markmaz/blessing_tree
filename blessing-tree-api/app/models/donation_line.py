from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .donation import Donation
    from .fulfillment import Fulfillment


class DonationLine(Base):
    __tablename__ = "donation_line"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    donation_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("donation.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    line_type: Mapped[str] = mapped_column(
        Enum("GOODS", "GIFT_CARD", "MONEY", name="donation_line_type"),
        nullable=False,
        default="GOODS",
    )

    description: Mapped[str] = mapped_column(String(512), nullable=False)
    category: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    size: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    quantity: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    estimated_value_cents: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    storage_location_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("storage_location.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    status: Mapped[str] = mapped_column(
        Enum("UNASSIGNED", "ASSIGNED", "CONSUMED", name="donation_line_status"),
        nullable=False,
        default="UNASSIGNED",
        index=True,
    )

    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    donation: Mapped["Donation"] = relationship(back_populates="lines")

    fulfillments: Mapped[List["Fulfillment"]] = relationship(
        back_populates="donation_line",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_donation_line_donation", "donation_id"),
        Index("idx_donation_line_status", "status"),
        Index("idx_donation_line_storage", "storage_location_id"),
    )
