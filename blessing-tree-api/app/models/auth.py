from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import String, DateTime, Enum, ForeignKey, Index, UniqueConstraint
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser


class AuthIdentity(Base):
    __tablename__ = "auth_identity"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )

    provider: Mapped[str] = mapped_column(
        Enum("GOOGLE", "YAHOO", "LOCAL", name="auth_provider"),
        nullable=False,
    )

    provider_sub: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)
    email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # LOCAL only
    password_hash: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    is_active: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)

    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    user: Mapped["AppUser"] = relationship(back_populates="auth_identities")

    __table_args__ = (
        UniqueConstraint("provider", "provider_sub", name="uq_auth_identity_provider_sub"),
        UniqueConstraint("provider", "email", name="uq_auth_identity_provider_email"),
        Index("idx_auth_identity_user", "user_id"),
        Index("idx_auth_identity_email", "email"),
    )
