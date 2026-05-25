from __future__ import annotations

import uuid
from datetime import datetime
from typing import TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, String
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser


class AppUserSettings(Base):
    __tablename__ = "app_user_settings"

    user_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="CASCADE", onupdate="CASCADE"),
        primary_key=True,
    )
    timezone: Mapped[str] = mapped_column(String(64), nullable=False, default="America/Chicago")
    date_format: Mapped[str] = mapped_column(
        Enum("MM_DD_YYYY", "YYYY_MM_DD", name="app_user_date_format"),
        nullable=False,
        default="MM_DD_YYYY",
    )
    default_landing_page: Mapped[str] = mapped_column(
        Enum("DASHBOARD", "CAMPAIGNS", "CURRENT_CAMPAIGN", name="app_user_default_landing_page"),
        nullable=False,
        default="DASHBOARD",
    )
    email_notifications_enabled: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )

    user: Mapped["AppUser"] = relationship(back_populates="settings")
