from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign


class AuditEvent(Base):
    __tablename__ = "audit_event"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    occurred_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    actor_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    actor_display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    actor_email: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    campaign_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    area: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    action: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_type: Mapped[str] = mapped_column(String(96), nullable=False)
    entity_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDBin(), nullable=True)
    entity_label: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    summary: Mapped[str] = mapped_column(String(500), nullable=False)
    change_set_json: Mapped[list[dict[str, Any]] | None] = mapped_column(JSON, nullable=True)
    metadata_json: Mapped[dict[str, Any] | None] = mapped_column(JSON, nullable=True)
    correlation_id: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    ip_address: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    user_agent: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    actor_user: Mapped[Optional["AppUser"]] = relationship()
    campaign: Mapped[Optional["Campaign"]] = relationship()

    __table_args__ = (
        Index("idx_audit_event_campaign_occurred", "campaign_id", "occurred_at"),
        Index("idx_audit_event_actor_occurred", "actor_user_id", "occurred_at"),
        Index("idx_audit_event_area_occurred", "area", "occurred_at"),
        Index("idx_audit_event_action_occurred", "action", "occurred_at"),
        Index("idx_audit_event_entity", "entity_type", "entity_id"),
    )
