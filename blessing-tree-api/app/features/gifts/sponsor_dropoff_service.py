from __future__ import annotations

import base64
import hashlib
from collections import OrderedDict
from datetime import date, datetime, time, timedelta
from io import BytesIO
import secrets
import uuid

from sqlalchemy.orm import Session, joinedload

from app.config import FRONTEND_BASE_URL
from app.exceptions.service_error import ServiceError
from app.models.campaign import Campaign
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.sponsor_dropoff_scan_event import SponsorDropoffScanEvent
from app.models.sponsor_dropoff_token import SponsorDropoffToken
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

RECEIVED_OR_LATER_STATUSES = {
    "RECEIVED",
    "WRAPPED",
    "TAGGED",
    "READY_FOR_DISTRIBUTION",
    "DISTRIBUTED",
    "PICKED_UP",
}


class SponsorDropoffService:
    def get_or_create_active_token(
        self,
        db: Session,
        *,
        sponsorship: Sponsorship,
        created_by_user_id: str | uuid.UUID | None = None,
    ) -> tuple[str, SponsorDropoffToken]:
        now = datetime.utcnow()
        existing_rows = (
            db.query(SponsorDropoffToken)
            .filter(
                SponsorDropoffToken.campaign_id == sponsorship.campaign_id,
                SponsorDropoffToken.sponsorship_id == sponsorship.id,
                SponsorDropoffToken.sponsor_id == sponsorship.sponsor_id,
                SponsorDropoffToken.revoked_at.is_(None),
                SponsorDropoffToken.expires_at > now,
            )
            .all()
        )
        for existing in existing_rows:
            existing.revoked_at = now

        raw_token = secrets.token_urlsafe(32)
        token = SponsorDropoffToken(
            id=uuid.uuid4(),
            campaign_id=sponsorship.campaign_id,
            sponsorship_id=sponsorship.id,
            sponsor_id=sponsorship.sponsor_id,
            token_hash=_hash_token(raw_token),
            expires_at=_expires_at(sponsorship.campaign),
            created_by_user_id=uuid.UUID(str(created_by_user_id)) if created_by_user_id else None,
        )
        db.add(token)
        db.flush()
        return raw_token, token

    def dropoff_url_for_sponsorship(
        self,
        db: Session,
        *,
        sponsorship: Sponsorship,
        created_by_user_id: str | uuid.UUID | None = None,
    ) -> str:
        raw_token, token = self.get_or_create_active_token(
            db,
            sponsorship=sponsorship,
            created_by_user_id=created_by_user_id,
        )
        if raw_token:
            return build_dropoff_url(raw_token)
        raise ServiceError("Unable to create sponsor drop-off link", status_code=500)

    def revoke_token(
        self,
        db: Session,
        *,
        campaign_id: str,
        sponsor_id: str,
        token_id: str,
    ) -> SponsorDropoffToken:
        row = (
            db.query(SponsorDropoffToken)
            .filter(
                SponsorDropoffToken.id == uuid.UUID(str(token_id)),
                SponsorDropoffToken.campaign_id == uuid.UUID(str(campaign_id)),
                SponsorDropoffToken.sponsor_id == uuid.UUID(str(sponsor_id)),
            )
            .one_or_none()
        )
        if row is None:
            raise ServiceError("Drop-off link not found", status_code=404)
        if row.revoked_at is None:
            row.revoked_at = datetime.utcnow()
            db.flush()
        return row

    def resolve_payload(
        self,
        db: Session,
        *,
        campaign_id: str,
        token: str,
        scanned_by_user_id: str | uuid.UUID | None = None,
        user_agent: str | None = None,
    ) -> dict[str, object]:
        now = datetime.utcnow()
        row = (
            db.query(SponsorDropoffToken)
            .options(
                joinedload(SponsorDropoffToken.campaign),
                joinedload(SponsorDropoffToken.sponsor),
                joinedload(SponsorDropoffToken.sponsorship)
                .joinedload(Sponsorship.items)
                .joinedload(SponsorshipItem.wishlist_item)
                .joinedload(WishlistItem.wishlist)
                .joinedload(Wishlist.recipient)
                .joinedload(Recipient.recipient_group),
            )
            .filter(
                SponsorDropoffToken.campaign_id == uuid.UUID(str(campaign_id)),
                SponsorDropoffToken.token_hash == _hash_token(token),
            )
            .one_or_none()
        )
        if row is None:
            raise ServiceError("Drop-off link not found", status_code=404)
        if row.revoked_at is not None:
            raise ServiceError("This drop-off link has been revoked.", status_code=410)
        if row.expires_at <= now:
            raise ServiceError("This drop-off link is expired.", status_code=410)

        row.last_scanned_at = now
        db.add(
            SponsorDropoffScanEvent(
                id=uuid.uuid4(),
                token_id=row.id,
                campaign_id=row.campaign_id,
                sponsorship_id=row.sponsorship_id,
                sponsor_id=row.sponsor_id,
                scanned_by_user_id=uuid.UUID(str(scanned_by_user_id)) if scanned_by_user_id else None,
                scanned_at=now,
                outcome="RESOLVED",
                user_agent=_truncate_user_agent(user_agent),
            )
        )
        db.flush()
        return serialize_dropoff_payload(row)


def serialize_dropoff_payload(row: SponsorDropoffToken) -> dict[str, object]:
    sponsorship = row.sponsorship
    sponsor = row.sponsor
    recipients: "OrderedDict[str, dict[str, object]]" = OrderedDict()

    for sponsorship_item in sorted(
        sponsorship.items or [],
        key=lambda item: _gift_sort_key(item.wishlist_item),
    ):
        item = sponsorship_item.wishlist_item
        if item is None or item.status == "CANCELLED":
            continue
        wishlist = item.wishlist
        recipient = wishlist.recipient if wishlist is not None else None
        recipient_key = str(recipient.id) if recipient is not None else "unassigned"
        if recipient_key not in recipients:
            group = recipient.recipient_group if recipient is not None else None
            recipients[recipient_key] = {
                "id": str(recipient.id) if recipient is not None else None,
                "program_recipient_id": recipient.program_recipient_id if recipient is not None else None,
                "display_label": recipient.display_label if recipient is not None else "Recipient",
                "age": recipient.age if recipient is not None else None,
                "age_unit": recipient.age_unit if recipient is not None else None,
                "gender": recipient.gender if recipient is not None else None,
                "group_label": group.group_name if isinstance(group, RecipientGroup) else None,
                "gifts": [],
            }
        recipients[recipient_key]["gifts"].append(_serialize_dropoff_gift(item))

    return {
        "campaign": {
            "id": str(row.campaign_id),
            "name": row.campaign.name if row.campaign else "",
            "year": row.campaign.year if row.campaign else None,
        },
        "sponsor": {
            "id": str(row.sponsor_id),
            "display_name": sponsor.display_name if sponsor else "Sponsor",
            "email": sponsor.email if sponsor else None,
            "phone": sponsor.phone if sponsor else None,
        },
        "sponsorship": {
            "id": str(row.sponsorship_id),
            "drop_off_status": sponsorship.drop_off_status,
        },
        "recipients": list(recipients.values()),
        "token": {
            "expires_at": row.expires_at.isoformat(),
            "last_scanned_at": row.last_scanned_at.isoformat() if row.last_scanned_at else None,
        },
    }


def build_dropoff_url(token: str) -> str:
    return f"{_frontend_base()}/mobile/receive/dropoff/{token}"


def qr_data_uri(value: str) -> str:
    if not value:
        return ""
    try:
        import qrcode
    except ImportError:
        return ""

    image = qrcode.make(value)
    buffer = BytesIO()
    image.save(buffer, format="PNG")
    encoded = base64.b64encode(buffer.getvalue()).decode("ascii")
    return f"data:image/png;base64,{encoded}"


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _expires_at(campaign: Campaign | None) -> datetime:
    if campaign is not None and campaign.end_date is not None:
        end_date = campaign.end_date if isinstance(campaign.end_date, date) else date.today()
        return datetime.combine(end_date + timedelta(days=7), time.max).replace(microsecond=0)
    return datetime.utcnow() + timedelta(days=90)


def _frontend_base() -> str:
    return str(FRONTEND_BASE_URL or "http://localhost:5173").rstrip("/")


def _serialize_dropoff_gift(item: WishlistItem) -> dict[str, object]:
    status = str(item.status or "")
    return {
        "wishlist_item_id": str(item.id),
        "description": item.description,
        "category": item.category,
        "item_type": item.item_type,
        "size": item.size,
        "status": status,
        "received_at": item.received_at.isoformat() if item.received_at else None,
        "can_receive": status not in RECEIVED_OR_LATER_STATUSES and status != "CANCELLED",
        "can_unreceive": status == "RECEIVED",
    }


def _gift_sort_key(item: WishlistItem | None) -> tuple[str, str, str]:
    if item is None or item.wishlist is None or item.wishlist.recipient is None:
        return ("", "", "")
    recipient = item.wishlist.recipient
    return (
        str(recipient.program_recipient_id or ""),
        str(recipient.display_label or ""),
        str(item.description or ""),
    )


def _truncate_user_agent(value: str | None) -> str | None:
    if not value:
        return None
    return value[:512]
