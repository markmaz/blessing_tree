from __future__ import annotations

import uuid
from datetime import datetime
from typing import List, Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .app_user import AppUser
    from .campaign import Campaign
    from .communication_template import CommunicationTemplate
    from .campaign_communication_send_recipient import CampaignCommunicationSendRecipient


COMMUNICATION_SEND_STATUS_PENDING = "PENDING"
COMMUNICATION_SEND_STATUS_SENT = "SENT"
COMMUNICATION_SEND_STATUS_FAILED = "FAILED"
COMMUNICATION_SEND_STATUS_PARTIAL = "PARTIAL"

COMMUNICATION_SEND_STATUSES = (
    COMMUNICATION_SEND_STATUS_PENDING,
    COMMUNICATION_SEND_STATUS_SENT,
    COMMUNICATION_SEND_STATUS_FAILED,
    COMMUNICATION_SEND_STATUS_PARTIAL,
)

COMMUNICATION_SEND_TARGET_CONTEXT_SPONSOR = "CONTEXT_SPONSOR"
COMMUNICATION_SEND_TARGET_AUDIENCE = "AUDIENCE"
COMMUNICATION_SEND_TARGET_TEAM = "TEAM"
COMMUNICATION_SEND_TARGET_SELECTED_SPONSORS = "SELECTED_SPONSORS"
COMMUNICATION_SEND_TARGET_SELECTED_CONTACTS = "SELECTED_CONTACTS"
COMMUNICATION_SEND_TARGET_SELECTED_MEMBERS = "SELECTED_MEMBERS"
COMMUNICATION_SEND_TARGET_MANUAL_EMAIL = "MANUAL_EMAIL"

COMMUNICATION_SEND_TARGET_MODES = (
    COMMUNICATION_SEND_TARGET_CONTEXT_SPONSOR,
    COMMUNICATION_SEND_TARGET_AUDIENCE,
    COMMUNICATION_SEND_TARGET_TEAM,
    COMMUNICATION_SEND_TARGET_SELECTED_SPONSORS,
    COMMUNICATION_SEND_TARGET_SELECTED_CONTACTS,
    COMMUNICATION_SEND_TARGET_SELECTED_MEMBERS,
    COMMUNICATION_SEND_TARGET_MANUAL_EMAIL,
)


class CampaignCommunicationSend(Base):
    __tablename__ = "campaign_communication_send"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    template_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("communication_template.id", ondelete="RESTRICT", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    target_mode: Mapped[str] = mapped_column(
        Enum(*COMMUNICATION_SEND_TARGET_MODES, name="campaign_communication_send_target_mode"),
        nullable=False,
    )
    status: Mapped[str] = mapped_column(
        Enum(*COMMUNICATION_SEND_STATUSES, name="campaign_communication_send_status"),
        nullable=False,
        default=COMMUNICATION_SEND_STATUS_PENDING,
        index=True,
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    recipient_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    delivered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_by_user_id: Mapped[Optional[uuid.UUID]] = mapped_column(
        UUIDBin(),
        ForeignKey("app_user.id", ondelete="SET NULL", onupdate="CASCADE"),
        nullable=True,
        index=True,
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)

    campaign: Mapped["Campaign"] = relationship()
    template: Mapped["CommunicationTemplate"] = relationship()
    created_by_user: Mapped[Optional["AppUser"]] = relationship()
    recipients: Mapped[List["CampaignCommunicationSendRecipient"]] = relationship(
        back_populates="send",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )

    __table_args__ = (
        Index("idx_campaign_communication_send_campaign", "campaign_id"),
        Index("idx_campaign_communication_send_template", "template_id"),
        Index("idx_campaign_communication_send_status", "status"),
        Index("idx_campaign_communication_send_created", "created_at"),
    )
