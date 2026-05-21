from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, String, Text
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.orm import Mapped, mapped_column

from .base import Base
from .uuid_bin import UUIDBin


class AdminLlmConfiguration(Base):
    __tablename__ = "admin_llm_configuration"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True, default=uuid.uuid4)
    provider: Mapped[str] = mapped_column(
        Enum("OPENAI_COMPATIBLE", "OPENAI", name="admin_llm_provider"),
        nullable=False,
        default="OPENAI_COMPATIBLE",
    )
    label: Mapped[str] = mapped_column(String(120), nullable=False, default="Primary LLM")
    base_url: Mapped[str] = mapped_column(String(512), nullable=False)
    model: Mapped[str] = mapped_column(String(255), nullable=False)
    api_key_encrypted: Mapped[Text | None] = mapped_column(Text, nullable=True)
    is_enabled: Mapped[bool] = mapped_column(TINYINT(1), nullable=False, default=1)
    last_tested_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    last_test_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    last_test_message: Mapped[str | None] = mapped_column(String(512), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime,
        nullable=False,
        default=datetime.utcnow,
        onupdate=datetime.utcnow,
    )
