from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional, TYPE_CHECKING

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .base import Base
from .campaign_communication_send import COMMUNICATION_SEND_STATUSES
from .uuid_bin import UUIDBin

if TYPE_CHECKING:
    from .campaign_communication_send import CampaignCommunicationSend


COMMUNICATION_SEND_RECIPIENT_TYPE_SPONSOR = "SPONSOR"
COMMUNICATION_SEND_RECIPIENT_TYPE_TEAM = "TEAM"
COMMUNICATION_SEND_RECIPIENT_TYPE_MEMBER = "MEMBER"
COMMUNICATION_SEND_RECIPIENT_TYPE_CONTACT = "CONTACT"
COMMUNICATION_SEND_RECIPIENT_TYPE_MANUAL = "MANUAL"

COMMUNICATION_SEND_RECIPIENT_TYPES = (
    COMMUNICATION_SEND_RECIPIENT_TYPE_SPONSOR,
    COMMUNICATION_SEND_RECIPIENT_TYPE_TEAM,
    COMMUNICATION_SEND_RECIPIENT_TYPE_MEMBER,
    COMMUNICATION_SEND_RECIPIENT_TYPE_CONTACT,
    COMMUNICATION_SEND_RECIPIENT_TYPE_MANUAL,
)


class CampaignCommunicationSendRecipient(Base):
    __tablename__ = "campaign_communication_send_recipient"

    id: Mapped[uuid.UUID] = mapped_column(UUIDBin(), primary_key=True)
    send_id: Mapped[uuid.UUID] = mapped_column(
        UUIDBin(),
        ForeignKey("campaign_communication_send.id", ondelete="CASCADE", onupdate="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_type: Mapped[str] = mapped_column(
        Enum(*COMMUNICATION_SEND_RECIPIENT_TYPES, name="campaign_communication_send_recipient_type"),
        nullable=False,
    )
    recipient_ref_id: Mapped[Optional[uuid.UUID]] = mapped_column(UUIDBin(), nullable=True, index=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[str] = mapped_column(
        Enum(*COMMUNICATION_SEND_STATUSES, name="campaign_communication_send_recipient_status"),
        nullable=False,
        default="PENDING",
    )
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False, default=datetime.utcnow)

    send: Mapped["CampaignCommunicationSend"] = relationship(back_populates="recipients")

    __table_args__ = (
        Index("idx_campaign_communication_send_recipient_send", "send_id"),
        Index("idx_campaign_communication_send_recipient_ref", "recipient_type", "recipient_ref_id"),
        Index("idx_campaign_communication_send_recipient_status", "status"),
    )
