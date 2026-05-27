from __future__ import annotations

import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign_manual_gift_label import CampaignManualGiftLabel
    from .label_print_job import LabelPrintJob
    from .wishlist_item import WishlistItem


class LabelPrintItem(Base):
    __tablename__ = "label_print_item"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    label_print_job_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("label_print_job.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    wishlist_item_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    manual_label_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign_manual_gift_label.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )

    copies: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    rendered_payload_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    job: Mapped["LabelPrintJob"] = relationship(back_populates="items")
    wishlist_item: Mapped[Optional["WishlistItem"]] = relationship(back_populates="label_print_items")
    manual_label: Mapped[Optional["CampaignManualGiftLabel"]] = relationship()

    __table_args__ = (
        Index("idx_label_print_item_job", "label_print_job_id"),
        Index("idx_label_print_item_item", "wishlist_item_id"),
        Index("idx_label_print_item_manual_label", "manual_label_id"),
    )
