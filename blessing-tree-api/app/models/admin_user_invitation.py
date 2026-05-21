from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser


class AdminUserInvitation(Base):
    __tablename__ = "admin_user_invitation"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    invited_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    accepted_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    revoked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user: Mapped["AppUser"] = relationship(
        foreign_keys=[user_id],
        passive_deletes=True,
    )
    invited_by_user: Mapped[Optional["AppUser"]] = relationship(
        foreign_keys=[invited_by_user_id],
        passive_deletes=True,
    )
