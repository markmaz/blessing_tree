from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.gift_policy_service import CampaignGiftPolicyService
from app.models.item_event import ItemEvent
from app.models.gift_reservation import (
    GIFT_RESERVATION_SOURCE_PUBLIC_SIGNUP,
    GIFT_RESERVATION_SOURCE_STAFF,
    GIFT_RESERVATION_STATUS_ACTIVE,
    GIFT_RESERVATION_STATUS_COMMITTED,
    GIFT_RESERVATION_STATUS_EXPIRED,
    GIFT_RESERVATION_STATUS_RELEASED,
    GiftReservation,
)
from app.models.pending_sponsor_registration import PendingSponsorRegistration
from app.models.sponsor import Sponsor
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem


class GiftReservationService:
    def __init__(self, gift_policy: CampaignGiftPolicyService | None = None) -> None:
        self.gift_policy = gift_policy or CampaignGiftPolicyService()

    def expire_reservations(self, db: Session, campaign_id: uuid.UUID | str | None = None) -> int:
        now = _now()
        query = db.query(GiftReservation).filter(
            GiftReservation.status == GIFT_RESERVATION_STATUS_ACTIVE,
            GiftReservation.active_wishlist_item_id.is_not(None),
            GiftReservation.expires_at.is_not(None),
            GiftReservation.expires_at < now,
        )
        if campaign_id is not None:
            query = query.filter(GiftReservation.campaign_id == uuid.UUID(str(campaign_id)))
        reservations = query.all()
        for reservation in reservations:
            self._mark_inactive(reservation, GIFT_RESERVATION_STATUS_EXPIRED)
        if reservations:
            db.flush()
        return len(reservations)

    def reserve_public_items(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        registration: PendingSponsorRegistration,
        selected_item_ids: list[str],
        expires_at: datetime,
    ) -> list[WishlistItem]:
        self.expire_reservations(db, campaign_id)
        self.release_registration_reservations(db, registration.id)
        selected_items = self.load_available_items_by_id(db, campaign_id, selected_item_ids)
        if len(selected_items) != len(selected_item_ids):
            raise ServiceError(
                "One or more selected gift items are not available",
                status_code=409,
                details={"field": "selected_wishlist_item_ids"},
            )
        for item in selected_items:
            db.add(
                GiftReservation(
                    id=uuid.uuid4(),
                    campaign_id=campaign_id,
                    wishlist_item_id=item.id,
                    active_wishlist_item_id=item.id,
                    pending_sponsor_registration_id=registration.id,
                    reservation_source=GIFT_RESERVATION_SOURCE_PUBLIC_SIGNUP,
                    status=GIFT_RESERVATION_STATUS_ACTIVE,
                    expires_at=expires_at,
                    notes="Reserved during public sponsor email verification.",
                )
            )
        try:
            db.flush()
        except IntegrityError as exc:
            db.rollback()
            raise ServiceError(
                "One or more selected gift items are not available",
                status_code=409,
                details={"unavailable_wishlist_item_ids": selected_item_ids},
            ) from exc
        return selected_items

    def load_available_items_by_id(
        self,
        db: Session,
        campaign_id: uuid.UUID,
        selected_item_ids: list[str],
    ) -> list[WishlistItem]:
        if not selected_item_ids:
            return []
        item_ids = [uuid.UUID(item_id) for item_id in selected_item_ids]
        items = (
            db.query(WishlistItem)
            .options(joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient))
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .outerjoin(SponsorshipItem, SponsorshipItem.wishlist_item_id == WishlistItem.id)
            .outerjoin(
                GiftReservation,
                GiftReservation.active_wishlist_item_id == WishlistItem.id,
            )
            .filter(
                Wishlist.campaign_id == campaign_id,
                WishlistItem.id.in_(item_ids),
                WishlistItem.status == "OPEN",
                SponsorshipItem.id.is_(None),
                GiftReservation.id.is_(None),
            )
            .all()
        )
        indexed = {str(item.id): item for item in items}
        return [indexed[item_id] for item_id in selected_item_ids if item_id in indexed]

    def load_active_registration_items(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        registration_id: uuid.UUID,
    ) -> list[WishlistItem]:
        self.expire_reservations(db, campaign_id)
        reservations = (
            db.query(GiftReservation)
            .options(joinedload(GiftReservation.wishlist_item).joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient))
            .filter(
                GiftReservation.campaign_id == campaign_id,
                GiftReservation.pending_sponsor_registration_id == registration_id,
                GiftReservation.status == GIFT_RESERVATION_STATUS_ACTIVE,
                GiftReservation.active_wishlist_item_id.is_not(None),
            )
            .order_by(GiftReservation.created_at.asc())
            .all()
        )
        return [reservation.wishlist_item for reservation in reservations if reservation.wishlist_item is not None]

    def mark_registration_committed(
        self,
        db: Session,
        *,
        registration_id: uuid.UUID,
        sponsor_id: uuid.UUID,
    ) -> None:
        reservations = (
            db.query(GiftReservation)
            .filter(
                GiftReservation.pending_sponsor_registration_id == registration_id,
                GiftReservation.status == GIFT_RESERVATION_STATUS_ACTIVE,
            )
            .all()
        )
        for reservation in reservations:
            reservation.sponsor_id = sponsor_id
            reservation.status = GIFT_RESERVATION_STATUS_COMMITTED
            reservation.committed_at = _now()
            reservation.active_wishlist_item_id = None
        if reservations:
            db.flush()

    def release_registration_reservations(self, db: Session, registration_id: uuid.UUID) -> int:
        reservations = (
            db.query(GiftReservation)
            .filter(
                GiftReservation.pending_sponsor_registration_id == registration_id,
                GiftReservation.status == GIFT_RESERVATION_STATUS_ACTIVE,
            )
            .all()
        )
        for reservation in reservations:
            self._mark_inactive(reservation, GIFT_RESERVATION_STATUS_RELEASED)
        if reservations:
            db.flush()
        return len(reservations)

    def extend_registration_reservations(
        self,
        db: Session,
        *,
        registration_id: uuid.UUID,
        expires_at: datetime,
    ) -> int:
        reservations = (
            db.query(GiftReservation)
            .filter(
                GiftReservation.pending_sponsor_registration_id == registration_id,
                GiftReservation.status == GIFT_RESERVATION_STATUS_ACTIVE,
            )
            .all()
        )
        for reservation in reservations:
            reservation.expires_at = expires_at
        if reservations:
            db.flush()
        return len(reservations)

    def staff_commit_gift(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
        sponsor_id: uuid.UUID,
        committed_by_user_id: uuid.UUID | None,
        notes: str | None = None,
    ) -> SponsorshipItem:
        self.expire_reservations(db, campaign_id)
        item = self._load_available_item(db, campaign_id, wishlist_item_id)
        sponsor = db.query(Sponsor).filter(Sponsor.id == sponsor_id).one_or_none()
        if sponsor is None:
            raise ServiceError("Sponsor not found", status_code=404, details={"sponsor_id": str(sponsor_id)})
        self.gift_policy.enforce_sponsor_gift_limit(
            db,
            campaign_id=campaign_id,
            sponsor_id=sponsor_id,
            additional_item_count=1,
        )

        sponsorship = (
            db.query(Sponsorship)
            .filter(Sponsorship.campaign_id == campaign_id, Sponsorship.sponsor_id == sponsor_id)
            .one_or_none()
        )
        if sponsorship is None:
            sponsorship = Sponsorship(
                id=uuid.uuid4(),
                campaign_id=campaign_id,
                sponsor_id=sponsor_id,
                status="ACTIVE",
                interest_status="COMMITTED",
                drop_off_status="NOT_STARTED",
            )
            db.add(sponsorship)
            db.flush()
        else:
            sponsorship.status = "ACTIVE"
            sponsorship.interest_status = "COMMITTED"

        sponsorship_item = SponsorshipItem(
            id=uuid.uuid4(),
            sponsorship_id=sponsorship.id,
            wishlist_item_id=item.id,
            qty_committed=item.qty_requested,
            notes=notes,
        )
        db.add(sponsorship_item)
        item.status = "COMMITTED"
        self._record_event(db, item, "COMMITTED", committed_by_user_id, notes=notes)

        active_reservation = self._active_reservation_for_item(db, item.id)
        if active_reservation is not None:
            active_reservation.sponsor_id = sponsor_id
            active_reservation.reserved_by_user_id = committed_by_user_id
            active_reservation.status = GIFT_RESERVATION_STATUS_COMMITTED
            active_reservation.committed_at = _now()
            active_reservation.active_wishlist_item_id = None
        else:
            db.add(
                GiftReservation(
                    id=uuid.uuid4(),
                    campaign_id=campaign_id,
                    wishlist_item_id=item.id,
                    active_wishlist_item_id=None,
                    sponsor_id=sponsor_id,
                    reserved_by_user_id=committed_by_user_id,
                    reservation_source=GIFT_RESERVATION_SOURCE_STAFF,
                    status=GIFT_RESERVATION_STATUS_COMMITTED,
                    committed_at=_now(),
                    notes=notes,
                )
            )
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ServiceError("Gift is no longer available", status_code=409) from exc
        return sponsorship_item

    def release_gift(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
    ) -> WishlistItem:
        item = (
            db.query(WishlistItem)
            .options(joinedload(WishlistItem.sponsorship_item), joinedload(WishlistItem.wishlist))
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(Wishlist.campaign_id == campaign_id, WishlistItem.id == wishlist_item_id)
            .one_or_none()
        )
        if item is None:
            raise ServiceError("Gift not found", status_code=404, details={"wishlist_item_id": str(wishlist_item_id)})

        active_reservation = self._active_reservation_for_item(db, item.id)
        if active_reservation is not None:
            self._mark_inactive(active_reservation, GIFT_RESERVATION_STATUS_RELEASED)

        if item.sponsorship_item is not None:
            db.delete(item.sponsorship_item)
            self._record_event(db, item, "UNCOMMITTED", None)
        if item.status == "COMMITTED":
            item.status = "OPEN"
        db.commit()
        db.refresh(item)
        return item

    def _load_available_item(
        self,
        db: Session,
        campaign_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
    ) -> WishlistItem:
        item = (
            db.query(WishlistItem)
            .options(joinedload(WishlistItem.wishlist), joinedload(WishlistItem.sponsorship_item))
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(
                Wishlist.campaign_id == campaign_id,
                WishlistItem.id == wishlist_item_id,
                WishlistItem.status == "OPEN",
            )
            .one_or_none()
        )
        if item is None or item.sponsorship_item is not None:
            raise ServiceError("Gift is not available", status_code=409, details={"wishlist_item_id": str(wishlist_item_id)})
        active_reservation = self._active_reservation_for_item(db, item.id)
        if active_reservation is not None:
            raise ServiceError("Gift is currently reserved", status_code=409, details={"wishlist_item_id": str(wishlist_item_id)})
        return item

    def _active_reservation_for_item(self, db: Session, wishlist_item_id: uuid.UUID) -> GiftReservation | None:
        return (
            db.query(GiftReservation)
            .filter(
                GiftReservation.active_wishlist_item_id == wishlist_item_id,
                GiftReservation.status == GIFT_RESERVATION_STATUS_ACTIVE,
            )
            .one_or_none()
        )

    def _mark_inactive(self, reservation: GiftReservation, status: str) -> None:
        reservation.status = status
        reservation.active_wishlist_item_id = None
        if status == GIFT_RESERVATION_STATUS_RELEASED:
            reservation.released_at = _now()

    def _record_event(
        self,
        db: Session,
        item: WishlistItem,
        event_type: str,
        actor_user_id: uuid.UUID | None,
        *,
        notes: str | None = None,
    ) -> None:
        db.add(
            ItemEvent(
                id=uuid.uuid4(),
                wishlist_item_id=item.id,
                event_type=event_type,
                actor_user_id=actor_user_id,
                detail_json={"notes": notes} if notes else None,
            )
        )


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)
