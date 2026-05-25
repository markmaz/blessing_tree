from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.gifts.operations_service import GiftOperationsService
from app.models.campaign import Campaign
from app.models.item_event import ItemEvent
from app.models.label_print_item import LabelPrintItem
from app.models.label_print_job import LabelPrintJob
from app.models.recipient import Recipient
from app.models.scan_event import ScanEvent
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

SCAN_ACTIONS = {"RECEIVE", "WRAP", "READY", "DISTRIBUTE", "PICKUP", "EXCEPTION", "REPRINT"}
SCAN_EVENT_ACTIONS = {
    "RECEIVE": "MARK_RECEIVED",
    "WRAP": "MARK_WRAPPED",
    "READY": "MARK_READY",
    "DISTRIBUTE": "MARK_DISTRIBUTED",
    "PICKUP": "MARK_PICKED_UP",
    "EXCEPTION": "MARK_EXCEPTION",
    "REPRINT": "REPRINT",
}


class GiftLabelService:
    def __init__(
        self,
        campaign_service: CampaignService | None = None,
        operations_service: GiftOperationsService | None = None,
    ) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.operations = operations_service or GiftOperationsService(self.campaigns)

    def create_print_job(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        wishlist_item_ids: list[uuid.UUID],
        actor_user_id: uuid.UUID | None,
        copies: int = 1,
        label_format: str = "TAPE",
        printer_name: str | None = None,
        notes: str | None = None,
    ) -> LabelPrintJob:
        campaign = self.campaigns.get_campaign(db, str(campaign_id))
        unique_item_ids = list(dict.fromkeys(wishlist_item_ids))
        if not unique_item_ids:
            raise ServiceError("wishlist_item_ids is required", status_code=400, details={"field": "wishlist_item_ids"})
        copies = max(int(copies or 1), 1)
        items = self._load_items_by_ids(db, campaign_id, unique_item_ids)
        if len(items) != len(unique_item_ids):
            raise ServiceError("One or more gifts were not found", status_code=404)

        job = LabelPrintJob(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            printed_by_user_id=actor_user_id,
            format=(label_format or "TAPE").strip().upper(),
            printer_name=(printer_name or "").strip() or None,
            notes=(notes or "").strip() or None,
        )
        db.add(job)
        now = _now()
        for item in items:
            payload = build_label_payload(campaign, item)
            db.add(
                LabelPrintItem(
                    id=uuid.uuid4(),
                    job=job,
                    wishlist_item=item,
                    copies=copies,
                    rendered_payload_json=payload,
                )
            )
            item.label_last_printed_at = now
            item.label_last_printed_by_user_id = actor_user_id
            self._record_item_event(
                db,
                item,
                "LABEL_PRINTED",
                actor_user_id,
                detail={"label_print_job_id": str(job.id), "copies": copies},
            )
        db.commit()
        db.refresh(job)
        return job

    def get_print_job(self, db: Session, *, campaign_id: uuid.UUID, job_id: uuid.UUID) -> LabelPrintJob:
        self.campaigns.get_campaign(db, str(campaign_id))
        job = (
            db.query(LabelPrintJob)
            .options(
                joinedload(LabelPrintJob.items)
                .joinedload(LabelPrintItem.wishlist_item)
                .joinedload(WishlistItem.wishlist)
                .joinedload(Wishlist.recipient),
            )
            .filter(LabelPrintJob.id == job_id, LabelPrintJob.campaign_id == campaign_id)
            .one_or_none()
        )
        if job is None:
            raise ServiceError("Label print job not found", status_code=404)
        return job

    def scan_lookup(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        label_code: str,
        actor_user_id: uuid.UUID | None,
    ) -> WishlistItem:
        item = self._load_item_by_label(db, campaign_id, label_code)
        self._record_scan_event(db, campaign_id, label_code, actor_user_id, "LOOKUP", item=item)
        db.commit()
        db.refresh(item)
        return item

    def public_scan_lookup(
        self,
        db: Session,
        *,
        label_code: str,
    ) -> WishlistItem:
        item = self._load_item_by_label_without_campaign(db, label_code)
        self._record_scan_event(db, item.wishlist.campaign_id, label_code, None, "LOOKUP", item=item)
        db.commit()
        db.refresh(item)
        return item

    def scan_action(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        label_code: str,
        action: str,
        actor_user_id: uuid.UUID | None,
        notes: str | None = None,
    ) -> WishlistItem:
        normalized_action = (action or "").strip().upper()
        if normalized_action not in SCAN_ACTIONS:
            raise ServiceError("action is invalid", status_code=400, details={"allowed": sorted(SCAN_ACTIONS)})
        item = self._load_item_by_label(db, campaign_id, label_code)
        event_action = SCAN_EVENT_ACTIONS[normalized_action]

        if normalized_action == "RECEIVE":
            item = self.operations.receive_gift(
                db,
                campaign_id=campaign_id,
                wishlist_item_id=item.id,
                actor_user_id=actor_user_id,
                notes=notes,
            )
        elif normalized_action == "WRAP":
            item = self.operations.wrap_gift(
                db,
                campaign_id=campaign_id,
                wishlist_item_id=item.id,
                actor_user_id=actor_user_id,
                notes=notes,
            )
        elif normalized_action == "READY":
            item = self.operations.mark_ready(
                db,
                campaign_id=campaign_id,
                wishlist_item_id=item.id,
                actor_user_id=actor_user_id,
                notes=notes,
            )
        elif normalized_action == "EXCEPTION":
            item = self.operations.mark_exception(
                db,
                campaign_id=campaign_id,
                wishlist_item_id=item.id,
                actor_user_id=actor_user_id,
                notes=notes,
            )
        elif normalized_action == "DISTRIBUTE":
            item = self._mark_distributed(db, campaign_id, item, actor_user_id, notes=notes)
        elif normalized_action == "PICKUP":
            item = self.operations.mark_picked_up(
                db,
                campaign_id=campaign_id,
                wishlist_item_id=item.id,
                actor_user_id=actor_user_id,
                notes=notes,
            )
        elif normalized_action == "REPRINT":
            item = self._mark_reprint_requested(db, item, actor_user_id, notes=notes)

        self._record_scan_event(
            db,
            campaign_id,
            label_code,
            actor_user_id,
            event_action,
            item=item,
            detail={"notes": notes} if notes else None,
        )
        db.commit()
        db.refresh(item)
        return item

    def public_scan_action(
        self,
        db: Session,
        *,
        label_code: str,
        action: str,
        notes: str | None = None,
    ) -> WishlistItem:
        item = self._load_item_by_label_without_campaign(db, label_code)
        return self.scan_action(
            db,
            campaign_id=item.wishlist.campaign_id,
            label_code=label_code,
            action=action,
            actor_user_id=None,
            notes=notes,
        )

    def _load_items_by_ids(self, db: Session, campaign_id: uuid.UUID, item_ids: list[uuid.UUID]) -> list[WishlistItem]:
        items = (
            db.query(WishlistItem)
            .options(
                joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient).joinedload(Recipient.recipient_group),
                joinedload(WishlistItem.label_print_items),
            )
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(Wishlist.campaign_id == campaign_id, WishlistItem.id.in_(item_ids))
            .all()
        )
        by_id = {item.id: item for item in items}
        return [by_id[item_id] for item_id in item_ids if item_id in by_id]

    def _load_item_by_label(self, db: Session, campaign_id: uuid.UUID, label_code: str) -> WishlistItem:
        label = (label_code or "").strip()
        if not label:
            raise ServiceError("label_code is required", status_code=400)
        item = (
            db.query(WishlistItem)
            .options(
                joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient).joinedload(Recipient.recipient_group),
                joinedload(WishlistItem.fulfillment_rows),
                joinedload(WishlistItem.sponsorship_item),
            )
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(Wishlist.campaign_id == campaign_id, WishlistItem.label_code == label)
            .one_or_none()
        )
        if item is None:
            self._record_scan_event(db, campaign_id, label, None, "ERROR", detail={"reason": "not_found"})
            db.commit()
            raise ServiceError("Gift label not found", status_code=404)
        return item

    def _load_item_by_label_without_campaign(self, db: Session, label_code: str) -> WishlistItem:
        label = (label_code or "").strip()
        if not label:
            raise ServiceError("label_code is required", status_code=400)
        item = (
            db.query(WishlistItem)
            .options(
                joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient).joinedload(Recipient.recipient_group),
                joinedload(WishlistItem.fulfillment_rows),
                joinedload(WishlistItem.sponsorship_item),
            )
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(WishlistItem.label_code == label)
            .one_or_none()
        )
        if item is None:
            raise ServiceError("Gift label not found", status_code=404)
        return item

    def _mark_distributed(
        self,
        db: Session,
        campaign_id: uuid.UUID,
        item: WishlistItem,
        actor_user_id: uuid.UUID | None,
        *,
        notes: str | None,
    ) -> WishlistItem:
        if item.status not in {"READY_FOR_DISTRIBUTION", "WRAPPED", "TAGGED", "EXCEPTION"}:
            raise ServiceError("Gift must be ready before it can be distributed", status_code=409)
        previous_status = item.status
        item.status = "DISTRIBUTED"
        self._record_item_event(
            db,
            item,
            "STATUS_CHANGED",
            actor_user_id,
            detail={"from_status": previous_status, "to_status": item.status, **({"notes": notes} if notes else {})},
        )
        db.flush()
        return self._load_item_by_label(db, campaign_id, item.label_code)

    def _mark_reprint_requested(
        self,
        db: Session,
        item: WishlistItem,
        actor_user_id: uuid.UUID | None,
        *,
        notes: str | None,
    ) -> WishlistItem:
        self._record_item_event(
            db,
            item,
            "LABEL_PRINTED",
            actor_user_id,
            detail={"source": "scan_reprint", **({"notes": notes} if notes else {})},
        )
        db.flush()
        return item

    def _record_scan_event(
        self,
        db: Session,
        campaign_id: uuid.UUID,
        label_code: str,
        actor_user_id: uuid.UUID | None,
        action_taken: str,
        *,
        item: WishlistItem | None = None,
        detail: dict[str, Any] | None = None,
    ) -> None:
        db.add(
            ScanEvent(
                id=uuid.uuid4(),
                campaign_id=campaign_id,
                label_code=label_code,
                wishlist_item_id=item.id if item is not None else None,
                scanned_by_user_id=actor_user_id,
                action_taken=action_taken,
                detail_json=detail,
            )
        )

    def _record_item_event(
        self,
        db: Session,
        item: WishlistItem,
        event_type: str,
        actor_user_id: uuid.UUID | None,
        *,
        detail: dict[str, Any] | None = None,
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


def build_label_payload(campaign: Campaign, item: WishlistItem) -> dict[str, Any]:
    wishlist = item.wishlist
    recipient = wishlist.recipient if wishlist is not None else None
    group = recipient.recipient_group if recipient is not None else None
    return {
        "campaign": {
            "name": campaign.name,
            "year": campaign.year,
        },
        "recipient": {
            "display_label": recipient.display_label if recipient is not None else None,
            "program_recipient_id": recipient.program_recipient_id if recipient is not None else None,
            "group_label": group.group_name if group is not None else None,
            "age": recipient.age if recipient is not None else None,
            "age_unit": recipient.age_unit if recipient is not None else None,
            "gender": recipient.gender if recipient is not None else None,
        },
        "gift": {
            "description": item.description,
            "category": item.category,
            "size": item.size,
            "label_code": item.label_code,
        },
        "theme": _build_tag_theme(campaign),
        "scan_path": f"/public/gifts/scan/{item.label_code}",
    }


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _build_tag_theme(campaign: Campaign) -> dict[str, str | None]:
    purpose = (campaign.season_theme or campaign.name or "").strip()
    normalized = purpose.lower()
    if any(term in normalized for term in ("christmas", "advent", "holiday", "blessing tree")):
        return {"purpose": purpose or None, "icon": "bi-tree-fill", "accent": "#1f7a4d"}
    if any(term in normalized for term in ("easter", "lent", "resurrection")):
        return {"purpose": purpose or None, "icon": "bi-sunrise", "accent": "#8a6f35"}
    if any(term in normalized for term in ("catholic", "charity", "charities", "mercy")):
        return {"purpose": purpose or None, "icon": "bi-heart-fill", "accent": "#7b5bb7"}
    if any(term in normalized for term in ("gift", "giving", "donation", "donate")):
        return {"purpose": purpose or None, "icon": "bi-gift-fill", "accent": "#2b6cb0"}
    return {"purpose": purpose or None, "icon": "bi-stars", "accent": "#5d3581"}
