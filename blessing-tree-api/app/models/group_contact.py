from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .recipient_constants import (
    GROUP_CONTACT_ROLE_COORDINATOR,
    GROUP_CONTACT_ROLE_GUARDIAN,
    GROUP_CONTACT_ROLE_OTHER,
    GROUP_CONTACT_ROLE_PARENT,
    GROUP_CONTACT_ROLE_SOCIAL_WORKER,
    GROUP_CONTACT_ROLE_STAFF,
    PREFERRED_CONTACT_EMAIL,
    PREFERRED_CONTACT_NONE,
    PREFERRED_CONTACT_PHONE,
    PREFERRED_CONTACT_TEXT,
)
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .recipient_group import RecipientGroup


class GroupContact(Base):
    __tablename__ = "group_contact"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    recipient_group_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("recipient_group.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    contact_role: Mapped[str] = mapped_column(
        Enum(
            GROUP_CONTACT_ROLE_PARENT,
            GROUP_CONTACT_ROLE_GUARDIAN,
            GROUP_CONTACT_ROLE_COORDINATOR,
            GROUP_CONTACT_ROLE_SOCIAL_WORKER,
            GROUP_CONTACT_ROLE_STAFF,
            GROUP_CONTACT_ROLE_OTHER,
            name="group_contact_role",
        ),
        nullable=False,
        default=GROUP_CONTACT_ROLE_OTHER,
    )
    relationship_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    first_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    last_name: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True, index=True)
    phone: Mapped[Optional[str]] = mapped_column(String(64), nullable=True, index=True)
    preferred_contact: Mapped[str] = mapped_column(
        Enum(
            PREFERRED_CONTACT_EMAIL,
            PREFERRED_CONTACT_PHONE,
            PREFERRED_CONTACT_TEXT,
            PREFERRED_CONTACT_NONE,
            name="preferred_contact",
        ),
        nullable=False,
        default=PREFERRED_CONTACT_NONE,
    )
    is_primary: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=0)
    can_pick_up: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=0)
    is_emergency_contact: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=0)
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    recipient_group: Mapped["RecipientGroup"] = relationship(back_populates="contacts")

    __table_args__ = (
        Index("idx_group_contact_group", "recipient_group_id"),
        Index("idx_group_contact_primary", "recipient_group_id", "is_primary"),
        Index("idx_group_contact_email", "email"),
        Index("idx_group_contact_phone", "phone"),
    )
