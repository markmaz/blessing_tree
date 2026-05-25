from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.models.item_event import ItemEvent
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

GIFT_OPERATION_STATUSES = (
    "COMMITTED",
    "RECEIVED",
    "WRAPPED",
    "TAGGED",
    "READY_FOR_DISTRIBUTION",
    "DISTRIBUTED",
    "PICKED_UP",
    "EXCEPTION",
)

RECEIVED_OR_LATER_STATUSES = {
    "RECEIVED",
    "WRAPPED",
    "TAGGED",
    "READY_FOR_DISTRIBUTION",
    "DISTRIBUTED",
    "PICKED_UP",
}


class GiftOperationsService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def get_operations_payload(
        self,
        db: Session,
        campaign_id: str,
        *,
        status: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        self.campaigns.get_campaign(db, campaign_id)
        campaign_uuid = uuid.UUID(campaign_id)
        query = self._base_operations_query(db, campaign_uuid)
        if status:
            query = query.filter(WishlistItem.status == status.strip().upper())
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.filter(
                func.lower(WishlistItem.description).like(pattern)
                | func.lower(func.coalesce(WishlistItem.category, "")).like(pattern)
                | func.lower(func.coalesce(WishlistItem.label_code, "")).like(pattern)
            )
        items = query.order_by(WishlistItem.updated_at.desc(), WishlistItem.created_at.asc()).all()
        counts = self._status_counts(db, campaign_uuid)
        return {
            "campaign_id": campaign_id,
            "counts": counts,
            "items": items,
        }

    def receive_gift(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        storage_location_id: uuid.UUID | None = None,
        notes: str | None = None,
    ) -> WishlistItem:
        item = self._load_operations_item(db, campaign_id, wishlist_item_id)
        if item.status not in {"COMMITTED", "EXCEPTION"}:
            raise ServiceError("Gift must be committed before it can be received", status_code=409)
        item.status = "RECEIVED"
        item.received_at = _now()
        item.received_by_user_id = actor_user_id
        if storage_location_id is not None:
            item.storage_location_id = storage_location_id
        self._record_event(db, item, "RECEIVED", actor_user_id, notes=notes)
        self._refresh_sponsor_drop_off_status(item)
        db.commit()
        db.refresh(item)
        return item

    def wrap_gift(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        notes: str | None = None,
    ) -> WishlistItem:
        item = self._load_operations_item(db, campaign_id, wishlist_item_id)
        if item.status not in {"RECEIVED", "EXCEPTION"}:
            raise ServiceError("Gift must be received before it can be wrapped", status_code=409)
        item.status = "WRAPPED"
        item.wrapped_at = _now()
        item.wrapped_by_user_id = actor_user_id
        self._record_event(db, item, "WRAPPED", actor_user_id, notes=notes)
        self._refresh_sponsor_drop_off_status(item)
        db.commit()
        db.refresh(item)
        return item

    def mark_ready(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        notes: str | None = None,
    ) -> WishlistItem:
        item = self._load_operations_item(db, campaign_id, wishlist_item_id)
        if item.status not in {"WRAPPED", "TAGGED", "EXCEPTION"}:
            raise ServiceError("Gift must be wrapped before it can be marked ready", status_code=409)
        previous_status = item.status
        item.status = "READY_FOR_DISTRIBUTION"
        self._record_event(
            db,
            item,
            "STATUS_CHANGED",
            actor_user_id,
            notes=notes,
            detail={"from_status": previous_status, "to_status": item.status},
        )
        self._refresh_sponsor_drop_off_status(item)
        db.commit()
        db.refresh(item)
        return item

    def mark_picked_up(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        notes: str | None = None,
    ) -> WishlistItem:
        item = self._load_operations_item(db, campaign_id, wishlist_item_id)
        if item.status not in {"READY_FOR_DISTRIBUTION", "DISTRIBUTED", "EXCEPTION"}:
            raise ServiceError("Gift must be ready or distributed before it can be marked picked up", status_code=409)
        previous_status = item.status
        item.status = "PICKED_UP"
        item.picked_up_at = _now()
        item.picked_up_verified_by_user_id = actor_user_id
        self._record_event(
            db,
            item,
            "STATUS_CHANGED",
            actor_user_id,
            notes=notes,
            detail={"from_status": previous_status, "to_status": item.status},
        )
        db.commit()
        db.refresh(item)
        return item

    def mark_exception(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        notes: str | None = None,
    ) -> WishlistItem:
        item = self._load_operations_item(db, campaign_id, wishlist_item_id)
        if item.status in {"DISTRIBUTED", "PICKED_UP", "CANCELLED"}:
            raise ServiceError("Gift cannot be marked exception from its current status", status_code=409)
        previous_status = item.status
        item.status = "EXCEPTION"
        self._record_event(
            db,
            item,
            "STATUS_CHANGED",
            actor_user_id,
            notes=notes,
            detail={"from_status": previous_status, "to_status": item.status},
        )
        db.commit()
        db.refresh(item)
        return item

    def _base_operations_query(self, db: Session, campaign_id: uuid.UUID):
        return (
            db.query(WishlistItem)
            .options(
                joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient),
                joinedload(WishlistItem.fulfillment_rows),
                joinedload(WishlistItem.sponsorship_item)
                .joinedload(SponsorshipItem.sponsorship)
                .joinedload(Sponsorship.sponsor),
            )
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(
                Wishlist.campaign_id == campaign_id,
                WishlistItem.status.in_(GIFT_OPERATION_STATUSES),
            )
        )

    def _load_operations_item(self, db: Session, campaign_id: uuid.UUID, wishlist_item_id: uuid.UUID) -> WishlistItem:
        item = (
            self._base_operations_query(db, campaign_id)
            .filter(WishlistItem.id == wishlist_item_id)
            .one_or_none()
        )
        if item is None:
            raise ServiceError("Gift not found in operations workflow", status_code=404)
        return item

    def _status_counts(self, db: Session, campaign_id: uuid.UUID) -> dict[str, int]:
        rows = (
            db.query(WishlistItem.status, func.count(WishlistItem.id))
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(Wishlist.campaign_id == campaign_id, WishlistItem.status.in_(GIFT_OPERATION_STATUSES))
            .group_by(WishlistItem.status)
            .all()
        )
        counts = {status: 0 for status in GIFT_OPERATION_STATUSES}
        counts.update({status: int(count) for status, count in rows})
        counts["TOTAL"] = sum(counts.values())
        return counts

    def _record_event(
        self,
        db: Session,
        item: WishlistItem,
        event_type: str,
        actor_user_id: uuid.UUID | None,
        *,
        notes: str | None = None,
        detail: dict[str, Any] | None = None,
    ) -> None:
        payload = dict(detail or {})
        if notes:
            payload["notes"] = notes
        db.add(
            ItemEvent(
                id=uuid.uuid4(),
                wishlist_item_id=item.id,
                event_type=event_type,
                actor_user_id=actor_user_id,
                detail_json=payload or None,
            )
        )

    def _refresh_sponsor_drop_off_status(self, item: WishlistItem) -> None:
        sponsorship = item.sponsorship_item.sponsorship if item.sponsorship_item is not None else None
        if sponsorship is None:
            return
        sponsored_items = [
            sponsorship_item.wishlist_item
            for sponsorship_item in list(sponsorship.items or [])
            if sponsorship_item.wishlist_item is not None
        ]
        if sponsored_items and all(row.status in RECEIVED_OR_LATER_STATUSES for row in sponsored_items):
            sponsorship.drop_off_status = "RECEIVED"
            sponsorship.drop_off_completed_at = sponsorship.drop_off_completed_at or _now()


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)
