from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign import Campaign
    from .label_print_item import LabelPrintItem


class LabelPrintJob(Base):
    __tablename__ = "label_print_job"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)

    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    printed_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    printed_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    format: Mapped[str] = mapped_column(String(64), nullable=False, default="TAPE")
    printer_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    campaign: Mapped["Campaign"] = relationship(back_populates="label_print_jobs")

    items: Mapped[List["LabelPrintItem"]] = relationship(
        back_populates="job",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_label_print_job_campaign", "campaign_id"),
        Index("idx_label_print_job_time", "printed_at"),
        Index("idx_label_print_job_by", "printed_by_user_id"),
    )
