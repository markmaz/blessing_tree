from __future__ import annotations

import uuid
from typing import Optional, TYPE_CHECKING

from sqlalchemy import ForeignKey, Index, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
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
    wishlist_item_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("wishlist_item.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    copies: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    rendered_payload_json: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    job: Mapped["LabelPrintJob"] = relationship(back_populates="items")
    wishlist_item: Mapped["WishlistItem"] = relationship(back_populates="label_print_items")

    __table_args__ = (
        Index("idx_label_print_item_job", "label_print_job_id"),
        Index("idx_label_print_item_item", "wishlist_item_id"),
    )
