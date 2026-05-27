from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING, Optional

from sqlalchemy import DateTime, ForeignKey, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser


class AuthPasswordResetToken(Base):
    __tablename__ = "auth_password_reset_token"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    token_hash: Mapped[str] = mapped_column(String(64), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    used_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    user: Mapped["AppUser"] = relationship(passive_deletes=True)

    __table_args__ = (
        Index("idx_auth_password_reset_token_user_status", "user_id", "used_at", "expires_at"),
    )
