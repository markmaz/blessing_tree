from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, Index, String, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from .recipient_constants import RECIPIENT_KIND_ADULT, RECIPIENT_KIND_CHILD
from .uuid_bin import UUIDBin


class OrganizationType(Base):
    __tablename__ = "organization_type"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True, default=uuid.uuid4)
    code: Mapped[str] = mapped_column(String(64), nullable=False)
    label: Mapped[str] = mapped_column(String(120), nullable=False)
    recipient_category: Mapped[str] = mapped_column(
        Enum(RECIPIENT_KIND_CHILD, RECIPIENT_KIND_ADULT, "FAMILY", name="organization_type_recipient_category"),
        nullable=False,
        default=RECIPIENT_KIND_ADULT,
    )
    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    sort_order: Mapped[int] = mapped_column(nullable=False, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("code", name="uq_organization_type_code"),
        Index("idx_organization_type_active_sort", "is_active", "sort_order", "label"),
    )
