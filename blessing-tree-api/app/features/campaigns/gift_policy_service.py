from __future__ import annotations

import uuid
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.models.campaign_gift_policy import CampaignGiftPolicy, RECIPIENT_COVERAGE_RULES
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem


class CampaignGiftPolicyService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def get_policy(self, db: Session, campaign_id: str | uuid.UUID) -> CampaignGiftPolicy:
        campaign_uuid = uuid.UUID(str(campaign_id))
        policy = (
            db.query(CampaignGiftPolicy)
            .filter(CampaignGiftPolicy.campaign_id == campaign_uuid)
            .one_or_none()
        )
        if policy is not None:
            return policy
        self.campaigns.get_campaign(db, str(campaign_uuid))
        policy = CampaignGiftPolicy(id=uuid.uuid4(), campaign_id=campaign_uuid)
        db.add(policy)
        db.flush()
        return policy

    def update_policy(
        self,
        db: Session,
        campaign_id: str,
        payload: Mapping[str, object],
    ) -> CampaignGiftPolicy:
        policy = self.get_policy(db, campaign_id)
        if "max_gifts_per_sponsor" in payload:
            policy.max_gifts_per_sponsor = _validate_int(
                payload.get("max_gifts_per_sponsor"),
                "max_gifts_per_sponsor",
                minimum=1,
                maximum=100,
            )
        if "max_wishlist_items_per_recipient" in payload:
            policy.max_wishlist_items_per_recipient = _validate_int(
                payload.get("max_wishlist_items_per_recipient"),
                "max_wishlist_items_per_recipient",
                minimum=1,
                maximum=100,
            )
        if "recipient_coverage_rule" in payload:
            policy.recipient_coverage_rule = _validate_coverage_rule(payload.get("recipient_coverage_rule"))
        if "recipient_coverage_required_count" in payload:
            policy.recipient_coverage_required_count = _validate_int(
                payload.get("recipient_coverage_required_count"),
                "recipient_coverage_required_count",
                minimum=1,
                maximum=100,
            )
        if "allow_partial_sponsor_commitments" in payload:
            policy.allow_partial_sponsor_commitments = _validate_bool(
                payload.get("allow_partial_sponsor_commitments"),
                "allow_partial_sponsor_commitments",
            )
        if "reservation_hold_minutes" in payload:
            policy.reservation_hold_minutes = _validate_int(
                payload.get("reservation_hold_minutes"),
                "reservation_hold_minutes",
                minimum=5,
                maximum=10080,
            )
        if (
            policy.recipient_coverage_rule == "MIN_GIFTS_SPONSORED"
            and policy.recipient_coverage_required_count > policy.max_wishlist_items_per_recipient
        ):
            raise ServiceError(
                "recipient_coverage_required_count cannot exceed max_wishlist_items_per_recipient",
                status_code=400,
                details={
                    "field": "recipient_coverage_required_count",
                    "max_wishlist_items_per_recipient": policy.max_wishlist_items_per_recipient,
                },
            )
        db.commit()
        db.refresh(policy)
        return policy

    def enforce_wishlist_item_limit(self, db: Session, *, campaign_id: str, wishlist: Wishlist) -> None:
        policy = self.get_policy(db, campaign_id)
        existing_count = len(list(wishlist.items or []))
        if existing_count >= policy.max_wishlist_items_per_recipient:
            raise ServiceError(
                f"This campaign allows up to {policy.max_wishlist_items_per_recipient} wishlist gifts per person",
                status_code=409,
                details={
                    "field": "wishlist_items",
                    "max_wishlist_items_per_recipient": policy.max_wishlist_items_per_recipient,
                },
            )

    def enforce_sponsor_gift_limit(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        sponsor_id: uuid.UUID,
        additional_item_count: int,
    ) -> None:
        policy = self.get_policy(db, campaign_id)
        existing_count = (
            db.query(SponsorshipItem.id)
            .join(Sponsorship, Sponsorship.id == SponsorshipItem.sponsorship_id)
            .filter(Sponsorship.campaign_id == campaign_id, Sponsorship.sponsor_id == sponsor_id)
            .count()
        )
        if existing_count + additional_item_count > policy.max_gifts_per_sponsor:
            raise ServiceError(
                f"This campaign allows up to {policy.max_gifts_per_sponsor} gifts per sponsor",
                status_code=409,
                details={
                    "field": "selected_wishlist_item_ids",
                    "max_gifts_per_sponsor": policy.max_gifts_per_sponsor,
                    "existing_gift_count": existing_count,
                    "requested_gift_count": additional_item_count,
                },
            )

    def is_recipient_covered(self, policy: CampaignGiftPolicy, items: list[WishlistItem]) -> bool:
        if not items:
            return False
        sponsored_count = sum(1 for item in items if item.sponsorship_item is not None)
        if policy.recipient_coverage_rule == "ONE_GIFT_SPONSORED":
            return sponsored_count >= 1
        if policy.recipient_coverage_rule == "MIN_GIFTS_SPONSORED":
            return sponsored_count >= policy.recipient_coverage_required_count
        return sponsored_count >= len(items)


def _validate_int(value: object, field: str, *, minimum: int, maximum: int) -> int:
    try:
        parsed = int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError) as exc:
        raise ServiceError(f"{field} must be an integer", status_code=400, details={"field": field}) from exc
    if parsed < minimum or parsed > maximum:
        raise ServiceError(
            f"{field} must be between {minimum} and {maximum}",
            status_code=400,
            details={"field": field, "minimum": minimum, "maximum": maximum},
        )
    return parsed


def _validate_coverage_rule(value: object) -> str:
    normalized = str(value or "").strip().upper()
    if normalized not in RECIPIENT_COVERAGE_RULES:
        raise ServiceError(
            "recipient_coverage_rule is invalid",
            status_code=400,
            details={"field": "recipient_coverage_rule"},
        )
    return normalized


def _validate_bool(value: object, field: str) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and value in (0, 1):
        return bool(value)
    if isinstance(value, str) and value.strip().lower() in {"true", "false", "1", "0"}:
        return value.strip().lower() in {"true", "1"}
    raise ServiceError(f"{field} must be a boolean", status_code=400, details={"field": field})
