from __future__ import annotations

import re
import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.models.donation import Donation
from app.models.donation_line import DonationLine
from app.models.fulfillment import Fulfillment
from app.models.item_event import ItemEvent
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

GIFT_POOL_INVENTORY_STATUSES = (
    "AVAILABLE",
    "PARTIALLY_ASSIGNED",
    "ASSIGNED",
    "CONSUMED",
    "ARCHIVED",
)

DONATION_SOURCES = {"DROP_OFF", "SHIPMENT", "CHURCH_PURCHASE", "OTHER"}
DONATION_LINE_TYPES = {"GOODS", "GIFT_CARD", "MONEY"}
GIFT_CONDITIONS = {"NEW", "LIKE_NEW", "USED_ACCEPTABLE"}
GENDER_FITS = {"ANY", "F", "M", "X", "U", "UNSPECIFIED"}


class GiftPoolService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def get_pool(
        self,
        db: Session,
        campaign_id: str,
        *,
        status: str | None = None,
        search: str | None = None,
    ) -> dict[str, Any]:
        self.campaigns.get_campaign(db, campaign_id)
        campaign_uuid = uuid.UUID(campaign_id)
        query = self._base_line_query(db, campaign_uuid)
        if status:
            query = query.filter(DonationLine.inventory_status == _enum_value(status, GIFT_POOL_INVENTORY_STATUSES, "status"))
        if search:
            pattern = f"%{search.strip().lower()}%"
            query = query.filter(
                func.lower(DonationLine.description).like(pattern)
                | func.lower(func.coalesce(DonationLine.category, "")).like(pattern)
                | func.lower(func.coalesce(DonationLine.source_label, "")).like(pattern)
            )
        lines = query.order_by(DonationLine.updated_at.desc(), DonationLine.created_at.desc()).all()
        return {
            "campaign_id": campaign_id,
            "counts": self._status_counts(db, campaign_uuid),
            "lines": lines,
        }

    def create_donation(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        payload: dict[str, Any],
    ) -> Donation:
        self.campaigns.get_campaign(db, str(campaign_id))
        donation = Donation(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            sponsor_id=_optional_uuid(payload.get("sponsor_id"), "sponsor_id"),
            source=_enum_value(payload.get("source") or "DROP_OFF", DONATION_SOURCES, "source"),
            received_at=_now(),
            received_by_user_id=actor_user_id,
            notes=_clean_text(payload.get("notes")),
        )
        db.add(donation)
        db.flush()

        for line_payload in payload.get("lines") or []:
            self._create_line(db, donation, campaign_id, actor_user_id, line_payload)

        db.commit()
        db.refresh(donation)
        return donation

    def update_donation_line(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        line_id: uuid.UUID,
        payload: dict[str, Any],
    ) -> DonationLine:
        line = self._load_line(db, campaign_id, line_id)
        mutable_fields = {
            "line_type",
            "description",
            "category",
            "size",
            "quantity",
            "estimated_value_cents",
            "age_min",
            "age_max",
            "gender_fit",
            "gift_condition",
            "source_label",
            "inventory_status",
            "notes",
        }
        for field in mutable_fields.intersection(payload.keys()):
            self._apply_line_field(line, field, payload[field])
        self._normalize_line_quantities(line)
        db.commit()
        db.refresh(line)
        return line

    def create_donation_line(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        donation_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        payload: dict[str, Any],
    ) -> DonationLine:
        donation = (
            db.query(Donation)
            .filter(Donation.id == donation_id, Donation.campaign_id == campaign_id)
            .one_or_none()
        )
        if donation is None:
            raise ServiceError("Donation not found", status_code=404)
        line = self._create_line(db, donation, campaign_id, actor_user_id, payload)
        db.commit()
        db.refresh(line)
        return line

    def get_matches(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        line_id: uuid.UUID,
        limit: int = 25,
        mode: str = "suggested",
        query: str | None = None,
    ) -> list[dict[str, Any]]:
        line = self._load_line(db, campaign_id, line_id)
        self._normalize_line_quantities(line)
        if line.inventory_status == "ARCHIVED" or line.quantity_available <= 0:
            return []
        mode = _match_mode(mode)
        items = (
            db.query(WishlistItem)
            .options(
                joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient).joinedload(Recipient.recipient_group),
                joinedload(WishlistItem.fulfillment_rows),
                joinedload(WishlistItem.sponsorship_item),
            )
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .join(Recipient, Recipient.id == Wishlist.recipient_id)
            .join(RecipientGroup, RecipientGroup.id == Recipient.recipient_group_id)
            .filter(
                Wishlist.campaign_id == campaign_id,
                WishlistItem.status == "OPEN",
                ~WishlistItem.sponsorship_item.has(),
            )
            .all()
        )
        if mode == "needs_gifts":
            covered_recipient_ids = self._covered_recipient_ids(db, campaign_id)
            items = [item for item in items if item.wishlist.recipient_id not in covered_recipient_ids]
        search_terms = _keywords(query)
        if mode == "search" and not search_terms:
            return []
        matches = [
            {
                "wishlist_item": item,
                "score": score,
                "reasons": reasons,
            }
            for item in items
            for score, reasons in [self._candidate_score(line, item, mode, search_terms)]
            if (score > 0 or (mode != "suggested" and not search_terms)) and _remaining_quantity(item) > 0
        ]
        if mode == "needs_gifts":
            matches.sort(key=lambda row: _recipient_need_sort_key(row["wishlist_item"]))
        else:
            matches.sort(key=lambda row: (-int(row["score"]), row["wishlist_item"].priority, row["wishlist_item"].description))
        return matches[:limit]

    def assign_line(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        line_id: uuid.UUID,
        wishlist_item_id: uuid.UUID,
        quantity: object,
        actor_user_id: uuid.UUID | None,
        notes: str | None = None,
    ) -> Fulfillment:
        line = self._load_line(db, campaign_id, line_id)
        item = self._load_wishlist_item(db, campaign_id, wishlist_item_id)
        self._normalize_line_quantities(line)
        if line.inventory_status == "ARCHIVED":
            raise ServiceError("Archived inventory cannot be assigned", status_code=409)
        assignment_quantity = _positive_int(quantity, "quantity")
        if assignment_quantity > line.quantity_available:
            raise ServiceError("Not enough inventory is available", status_code=409)
        if assignment_quantity > _remaining_quantity(item):
            raise ServiceError("Wishlist item does not need that many gifts", status_code=409)

        fulfillment = (
            db.query(Fulfillment)
            .filter(Fulfillment.donation_line_id == line.id, Fulfillment.wishlist_item_id == item.id)
            .one_or_none()
        )
        if fulfillment is None:
            fulfillment = Fulfillment(
                id=uuid.uuid4(),
                donation_line=line,
                wishlist_item=item,
                quantity_fulfilled=assignment_quantity,
                fulfilled_by_user_id=actor_user_id,
                notes=notes,
            )
            db.add(fulfillment)
        else:
            fulfillment.quantity_fulfilled += assignment_quantity
            fulfillment.fulfilled_by_user_id = actor_user_id
            fulfillment.notes = notes or fulfillment.notes

        item.qty_fulfilled = min((item.qty_fulfilled or 0) + assignment_quantity, item.qty_requested or assignment_quantity)
        if item.qty_fulfilled >= (item.qty_requested or 1):
            item.status = "RECEIVED"
            item.received_at = item.received_at or _now()
            item.received_by_user_id = item.received_by_user_id or actor_user_id

        self._record_event(
            db,
            item,
            actor_user_id,
            detail={
                "source": "gift_pool_assignment",
                "donation_line_id": str(line.id),
                "quantity": assignment_quantity,
                **({"notes": notes} if notes else {}),
            },
        )
        try:
            db.flush()
        except IntegrityError as exc:
            raise ServiceError("Gift pool assignment conflict", status_code=409) from exc
        self._normalize_line_quantities(line)
        db.commit()
        db.refresh(fulfillment)
        return fulfillment

    def unassign_fulfillment(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        line_id: uuid.UUID,
        fulfillment_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        quantity: object | None = None,
        notes: str | None = None,
    ) -> dict[str, Any]:
        fulfillment = (
            db.query(Fulfillment)
            .options(
                joinedload(Fulfillment.donation_line).joinedload(DonationLine.fulfillments),
                joinedload(Fulfillment.wishlist_item).joinedload(WishlistItem.wishlist),
                joinedload(Fulfillment.wishlist_item).joinedload(WishlistItem.fulfillment_rows),
            )
            .join(DonationLine, DonationLine.id == Fulfillment.donation_line_id)
            .join(WishlistItem, WishlistItem.id == Fulfillment.wishlist_item_id)
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(
                DonationLine.campaign_id == campaign_id,
                DonationLine.id == line_id,
                Fulfillment.id == fulfillment_id,
                Wishlist.campaign_id == campaign_id,
            )
            .one_or_none()
        )
        if fulfillment is None:
            raise ServiceError("Gift pool assignment not found", status_code=404)
        item = fulfillment.wishlist_item
        line = fulfillment.donation_line
        if item.status not in {"OPEN", "RECEIVED"}:
            raise ServiceError("Only open or received gift pool assignments can be removed", status_code=409)

        removal_quantity = (
            _positive_int(quantity, "quantity")
            if quantity not in (None, "")
            else int(fulfillment.quantity_fulfilled or 0)
        )
        if removal_quantity > int(fulfillment.quantity_fulfilled or 0):
            raise ServiceError("quantity cannot exceed assigned quantity", status_code=409)

        previous_item_status = item.status
        previous_item_quantity = item.qty_fulfilled or 0
        if removal_quantity == fulfillment.quantity_fulfilled:
            if fulfillment in line.fulfillments:
                line.fulfillments.remove(fulfillment)
            db.delete(fulfillment)
        else:
            fulfillment.quantity_fulfilled -= removal_quantity
            fulfillment.notes = notes or fulfillment.notes

        item.qty_fulfilled = max((item.qty_fulfilled or 0) - removal_quantity, 0)
        if item.qty_fulfilled < (item.qty_requested or 1):
            item.status = "OPEN"
            item.received_at = None
            item.received_by_user_id = None

        self._record_event(
            db,
            item,
            actor_user_id,
            event_type="STATUS_CHANGED",
            detail={
                "source": "gift_pool_unassignment",
                "donation_line_id": str(line.id),
                "fulfillment_id": str(fulfillment_id),
                "quantity": removal_quantity,
                "from_status": previous_item_status,
                "to_status": item.status,
                "from_qty_fulfilled": previous_item_quantity,
                "to_qty_fulfilled": item.qty_fulfilled,
                **({"notes": notes} if notes else {}),
            },
        )
        try:
            db.flush()
        except IntegrityError as exc:
            raise ServiceError("Gift pool unassignment conflict", status_code=409) from exc
        self._normalize_line_quantities(line)
        db.commit()
        db.refresh(line)
        db.refresh(item)
        return {
            "line": line,
            "gift": item,
            "fulfillment_id": fulfillment_id,
            "quantity": removal_quantity,
            "previous_item_status": previous_item_status,
            "previous_item_quantity": previous_item_quantity,
        }

    def _base_line_query(self, db: Session, campaign_id: uuid.UUID):
        return (
            db.query(DonationLine)
            .options(joinedload(DonationLine.donation), joinedload(DonationLine.fulfillments))
            .join(Donation, Donation.id == DonationLine.donation_id)
            .filter(Donation.campaign_id == campaign_id)
        )

    def _load_line(self, db: Session, campaign_id: uuid.UUID, line_id: uuid.UUID) -> DonationLine:
        line = self._base_line_query(db, campaign_id).filter(DonationLine.id == line_id).one_or_none()
        if line is None:
            raise ServiceError("Donation line not found", status_code=404)
        self._sync_line_quantities(line)
        return line

    def _load_wishlist_item(self, db: Session, campaign_id: uuid.UUID, wishlist_item_id: uuid.UUID) -> WishlistItem:
        item = (
            db.query(WishlistItem)
            .options(joinedload(WishlistItem.wishlist), joinedload(WishlistItem.fulfillment_rows))
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(Wishlist.campaign_id == campaign_id, WishlistItem.id == wishlist_item_id)
            .one_or_none()
        )
        if item is None:
            raise ServiceError("Wishlist item not found", status_code=404)
        if item.status not in {"OPEN", "RECEIVED"}:
            raise ServiceError("Wishlist item is not available for gift pool assignment", status_code=409)
        return item

    def _create_line(
        self,
        db: Session,
        donation: Donation,
        campaign_id: uuid.UUID,
        actor_user_id: uuid.UUID | None,
        payload: dict[str, Any],
    ) -> DonationLine:
        description = _clean_text(payload.get("description"))
        if not description:
            raise ServiceError("description is required", status_code=400, details={"field": "description"})
        quantity = _positive_int(payload.get("quantity"), "quantity", default=1)
        line = DonationLine(
            id=uuid.uuid4(),
            donation_id=donation.id,
            campaign_id=campaign_id,
            line_type=_enum_value(payload.get("line_type") or "GOODS", DONATION_LINE_TYPES, "line_type"),
            description=description,
            category=_clean_text(payload.get("category")),
            size=_clean_text(payload.get("size")),
            quantity=quantity,
            quantity_available=quantity,
            quantity_assigned=0,
            estimated_value_cents=_optional_int(payload.get("estimated_value_cents"), "estimated_value_cents"),
            age_min=_optional_int(payload.get("age_min"), "age_min"),
            age_max=_optional_int(payload.get("age_max"), "age_max"),
            gender_fit=_enum_value(payload.get("gender_fit") or "ANY", GENDER_FITS, "gender_fit"),
            gift_condition=_enum_value(payload.get("gift_condition") or "NEW", GIFT_CONDITIONS, "gift_condition"),
            source_label=_clean_text(payload.get("source_label")),
            storage_location_id=_optional_uuid(payload.get("storage_location_id"), "storage_location_id"),
            status="UNASSIGNED",
            inventory_status="AVAILABLE",
            received_by_user_id=actor_user_id,
            notes=_clean_text(payload.get("notes")),
        )
        self._normalize_line_quantities(line)
        db.add(line)
        db.flush()
        return line

    def _apply_line_field(self, line: DonationLine, field: str, value: Any) -> None:
        if field in {"description"}:
            text = _clean_text(value)
            if not text:
                raise ServiceError("description is required", status_code=400, details={"field": field})
            setattr(line, field, text)
        elif field in {"category", "size", "source_label", "notes"}:
            setattr(line, field, _clean_text(value))
        elif field == "quantity":
            quantity = _positive_int(value, field)
            if quantity < line.quantity_assigned:
                raise ServiceError("quantity cannot be less than assigned quantity", status_code=409)
            line.quantity = quantity
        elif field in {"estimated_value_cents", "age_min", "age_max"}:
            setattr(line, field, _optional_int(value, field))
        elif field == "line_type":
            line.line_type = _enum_value(value, DONATION_LINE_TYPES, field)
        elif field == "gender_fit":
            line.gender_fit = _enum_value(value, GENDER_FITS, field)
        elif field == "gift_condition":
            line.gift_condition = _enum_value(value, GIFT_CONDITIONS, field)
        elif field == "inventory_status":
            line.inventory_status = _enum_value(value, GIFT_POOL_INVENTORY_STATUSES, field)

    def _normalize_line_quantities(self, line: DonationLine) -> None:
        self._sync_line_quantities(line)
        if line.inventory_status == "ARCHIVED":
            return
        if line.quantity_available <= 0:
            line.inventory_status = "ASSIGNED"
            line.status = "ASSIGNED"
        elif line.quantity_assigned > 0:
            line.inventory_status = "PARTIALLY_ASSIGNED"
            line.status = "ASSIGNED"
        else:
            line.inventory_status = "AVAILABLE"
            line.status = "UNASSIGNED"

    def _sync_line_quantities(self, line: DonationLine) -> None:
        assigned = sum(row.quantity_fulfilled or 0 for row in list(line.fulfillments or []))
        line.quantity_assigned = assigned
        line.quantity_available = max((line.quantity or 0) - assigned, 0)

    def _status_counts(self, db: Session, campaign_id: uuid.UUID) -> dict[str, int]:
        rows = (
            db.query(DonationLine.inventory_status, func.count(DonationLine.id))
            .join(Donation, Donation.id == DonationLine.donation_id)
            .filter(Donation.campaign_id == campaign_id)
            .group_by(DonationLine.inventory_status)
            .all()
        )
        counts = {status: 0 for status in GIFT_POOL_INVENTORY_STATUSES}
        counts.update({status: int(count) for status, count in rows})
        counts["TOTAL"] = sum(counts.values())
        return counts

    def _score_match(self, line: DonationLine, item: WishlistItem) -> tuple[int, list[str]]:
        score = 0
        reasons: list[str] = []
        if _same_text(line.category, item.category):
            score += 30
            reasons.append("category")
        keyword_overlap = _keywords(line.description).intersection(_keywords(item.description))
        if keyword_overlap:
            score += 30
            reasons.append("description")
        if line.size and item.size and _same_text(line.size, item.size):
            score += 20
            reasons.append("size")
        recipient = item.wishlist.recipient if item.wishlist is not None else None
        if recipient is not None and _age_compatible(line, recipient):
            score += 20
            reasons.append("age")
        if recipient is not None and _gender_compatible(line.gender_fit, recipient.gender):
            score += 15
            reasons.append("gender")
        if item.priority == "HIGH":
            score += 10
            reasons.append("high priority")
        return score, reasons

    def _candidate_score(
        self,
        line: DonationLine,
        item: WishlistItem,
        mode: str,
        search_terms: set[str],
    ) -> tuple[int, list[str]]:
        score, reasons = self._score_match(line, item)
        if search_terms:
            haystack = _candidate_haystack(item)
            if not search_terms.intersection(haystack):
                return 0, []
            score += 100
            reasons = ["search", *reasons]
        if mode == "needs_gifts":
            reasons = ["no gift coverage", *reasons]
        elif mode == "search" and not search_terms:
            score += 1
        return score, reasons

    def _covered_recipient_ids(self, db: Session, campaign_id: uuid.UUID) -> set[uuid.UUID]:
        rows = (
            db.query(Wishlist.recipient_id)
            .join(WishlistItem, WishlistItem.wishlist_id == Wishlist.id)
            .filter(
                Wishlist.campaign_id == campaign_id,
                or_(
                    WishlistItem.qty_fulfilled > 0,
                    WishlistItem.status.in_(
                        (
                            "COMMITTED",
                            "RECEIVED",
                            "WRAPPED",
                            "TAGGED",
                            "READY_FOR_DISTRIBUTION",
                            "DISTRIBUTED",
                            "PICKED_UP",
                        )
                    ),
                    WishlistItem.sponsorship_item.has(),
                ),
            )
            .distinct()
            .all()
        )
        return {row[0] for row in rows}

    def _record_event(
        self,
        db: Session,
        item: WishlistItem,
        actor_user_id: uuid.UUID | None,
        *,
        event_type: str = "RECEIVED",
        detail: dict[str, Any],
    ) -> None:
        db.add(
            ItemEvent(
                id=uuid.uuid4(),
                wishlist_item_id=item.id,
                event_type=event_type,
                actor_user_id=actor_user_id,
                detail_json=detail,
            )
        )


def _clean_text(value: Any) -> str | None:
    text = str(value or "").strip()
    return text or None


def _positive_int(value: Any, field: str, *, default: int | None = None) -> int:
    if value is None and default is not None:
        return default
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ServiceError(f"{field} must be a number", status_code=400, details={"field": field}) from exc
    if parsed < 1:
        raise ServiceError(f"{field} must be at least 1", status_code=400, details={"field": field})
    return parsed


def _optional_int(value: Any, field: str) -> int | None:
    if value in (None, ""):
        return None
    try:
        parsed = int(value)
    except (TypeError, ValueError) as exc:
        raise ServiceError(f"{field} must be a number", status_code=400, details={"field": field}) from exc
    if parsed < 0:
        raise ServiceError(f"{field} cannot be negative", status_code=400, details={"field": field})
    return parsed


def _optional_uuid(value: Any, field: str) -> uuid.UUID | None:
    if value in (None, ""):
        return None
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ServiceError(f"{field} must be a valid UUID", status_code=400, details={"field": field}) from exc


def _enum_value(value: Any, allowed: set[str] | tuple[str, ...], field: str) -> str:
    normalized = str(value or "").strip().upper()
    if normalized not in allowed:
        raise ServiceError(f"{field} is invalid", status_code=400, details={"field": field, "allowed": sorted(allowed)})
    return normalized


def _match_mode(value: object) -> str:
    mode = str(value or "suggested").strip().lower()
    if mode in {"suggested", "needs_gifts", "search"}:
        return mode
    raise ServiceError(
        "mode is invalid",
        status_code=400,
        details={"field": "mode", "allowed": ["suggested", "needs_gifts", "search"]},
    )


def _remaining_quantity(item: WishlistItem) -> int:
    fulfilled = max(item.qty_fulfilled or 0, sum(row.quantity_fulfilled or 0 for row in list(item.fulfillment_rows or [])))
    return max((item.qty_requested or 1) - fulfilled, 0)


def _same_text(left: str | None, right: str | None) -> bool:
    return bool(left and right and left.strip().lower() == right.strip().lower())


def _keywords(value: str | None) -> set[str]:
    return {token for token in re.findall(r"[a-z0-9]+", (value or "").lower()) if len(token) > 2}


def _candidate_haystack(item: WishlistItem) -> set[str]:
    wishlist = item.wishlist
    recipient = wishlist.recipient if wishlist is not None else None
    group = recipient.recipient_group if recipient is not None else None
    values = [
        item.description,
        item.category,
        item.item_type,
        item.size,
        item.priority,
        item.recipient_note,
        item.notes,
        recipient.display_label if recipient is not None else None,
        recipient.program_recipient_id if recipient is not None else None,
        recipient.first_name if recipient is not None else None,
        recipient.last_name if recipient is not None else None,
        group.group_name if group is not None else None,
        group.program_group_id if group is not None else None,
        group.program_abbreviation if group is not None else None,
    ]
    return set().union(*(_keywords(value) for value in values))


def _recipient_need_sort_key(item: WishlistItem) -> tuple[str, str, str, str]:
    wishlist = item.wishlist
    recipient = wishlist.recipient if wishlist is not None else None
    group = recipient.recipient_group if recipient is not None else None
    group_id = group.program_group_id if group is not None and group.program_group_id else ""
    recipient_id = recipient.program_recipient_id if recipient is not None and recipient.program_recipient_id else ""
    priority_rank = {"HIGH": "0", "MEDIUM": "1", "LOW": "2"}.get(item.priority, "3")
    return (group_id, recipient_id, priority_rank, item.description.lower())


def _age_compatible(line: DonationLine, recipient: Recipient) -> bool:
    if recipient.age is None or (line.age_min is None and line.age_max is None):
        return False
    minimum = line.age_min if line.age_min is not None else recipient.age
    maximum = line.age_max if line.age_max is not None else recipient.age
    return minimum <= recipient.age <= maximum


def _gender_compatible(gender_fit: str | None, recipient_gender: str | None) -> bool:
    if not gender_fit or gender_fit in {"ANY", "UNSPECIFIED"}:
        return True
    if not recipient_gender or recipient_gender in {"U", "X"}:
        return gender_fit in {"ANY", "UNSPECIFIED", "U", "X"}
    return gender_fit == recipient_gender


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)
