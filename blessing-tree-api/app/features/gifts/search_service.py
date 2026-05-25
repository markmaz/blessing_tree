from __future__ import annotations

import uuid

from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.gifts.search_parser import GiftSearchFilters, parse_gift_search_text
from app.models.campaign import Campaign
from app.models.gift_reservation import GiftReservation
from app.models.recipient import Recipient
from app.models.recipient_constants import WISHLIST_STATUS_READY
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem


class GiftSearchService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def parse(self, query: object) -> GiftSearchFilters:
        return parse_gift_search_text(query)

    def search_staff_gifts(
        self,
        db: Session,
        campaign_id: str,
        *,
        query: object = "",
        filters: dict[str, object] | None = None,
        limit: int = 100,
    ) -> tuple[GiftSearchFilters, list[WishlistItem]]:
        self.campaigns.get_campaign(db, campaign_id)
        parsed = self._merge_filters(parse_gift_search_text(query), filters or {})
        results = self._query_gifts(
            db,
            campaign_id=uuid.UUID(campaign_id),
            parsed=parsed,
            public=False,
            limit=limit,
        )
        return parsed, results

    def search_public_gifts(
        self,
        db: Session,
        public_slug: str,
        *,
        query: object = "",
        filters: dict[str, object] | None = None,
        limit: int = 100,
    ) -> tuple[Campaign, GiftSearchFilters, list[WishlistItem]]:
        campaign = self._get_public_campaign(db, public_slug)
        parsed = self._merge_filters(parse_gift_search_text(query), filters or {})
        results = self._query_gifts(
            db,
            campaign_id=campaign.id,
            parsed=parsed,
            public=True,
            limit=limit,
        )
        return campaign, parsed, results

    def _query_gifts(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        parsed: GiftSearchFilters,
        public: bool,
        limit: int,
    ) -> list[WishlistItem]:
        query = (
            db.query(WishlistItem)
            .options(
                joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient),
                joinedload(WishlistItem.sponsorship_item),
                joinedload(WishlistItem.fulfillment_rows),
            )
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .join(Recipient, Recipient.id == Wishlist.recipient_id)
            .outerjoin(SponsorshipItem, SponsorshipItem.wishlist_item_id == WishlistItem.id)
            .outerjoin(GiftReservation, GiftReservation.active_wishlist_item_id == WishlistItem.id)
            .filter(Wishlist.campaign_id == campaign_id)
        )

        if public:
            query = query.filter(
                Wishlist.wishlist_status == WISHLIST_STATUS_READY,
                WishlistItem.status == "OPEN",
                SponsorshipItem.id.is_(None),
                GiftReservation.id.is_(None),
            )

        if parsed.age_min is not None:
            query = query.filter(or_(Recipient.age.is_(None), Recipient.age >= parsed.age_min))
        if parsed.age_max is not None:
            query = query.filter(or_(Recipient.age.is_(None), Recipient.age <= parsed.age_max))
        if parsed.gender:
            query = query.filter(or_(Recipient.gender == parsed.gender, Recipient.gender.is_(None), Recipient.gender == "U"))
        if parsed.item_types and not parsed.categories:
            query = query.filter(WishlistItem.item_type.in_(parsed.item_types))
        if parsed.categories:
            category_filters = [
                func.lower(func.coalesce(WishlistItem.category, "")).like(f"%{category.replace('_', ' ')}%")
                for category in parsed.categories
            ]
            category_filters.extend(
                func.lower(WishlistItem.description).like(f"%{category.replace('_', ' ')}%")
                for category in parsed.categories
            )
            if parsed.item_types:
                category_filters.append(WishlistItem.item_type.in_(parsed.item_types))
            query = query.filter(or_(*category_filters))
        if parsed.sizes:
            size_filters = [
                func.lower(func.coalesce(WishlistItem.size, "")).like(f"%{size.lower()}%")
                for size in parsed.sizes
            ]
            query = query.filter(or_(*size_filters))
        if parsed.min_cost_cents is not None:
            query = query.filter(WishlistItem.est_cost_cents.is_(None) | (WishlistItem.est_cost_cents >= parsed.min_cost_cents))
        if parsed.max_cost_cents is not None:
            query = query.filter(WishlistItem.est_cost_cents.is_(None) | (WishlistItem.est_cost_cents <= parsed.max_cost_cents))

        text_terms = list(parsed.terms)
        if parsed.query and not text_terms and not self._has_structured_filters(parsed):
            text_terms = [parsed.query]
        for term in text_terms:
            pattern = f"%{term.lower()}%"
            text_filters = [
                func.lower(WishlistItem.description).like(pattern),
                func.lower(func.coalesce(WishlistItem.category, "")).like(pattern),
                func.lower(func.coalesce(WishlistItem.size, "")).like(pattern),
            ]
            if not public:
                text_filters.extend(
                    [
                        func.lower(func.coalesce(WishlistItem.recipient_note, "")).like(pattern),
                        func.lower(func.coalesce(WishlistItem.notes, "")).like(pattern),
                    ]
                )
            query = query.filter(or_(*text_filters))

        return (
            query.order_by(WishlistItem.priority.desc(), WishlistItem.created_at.asc())
            .limit(max(1, min(limit, 250)))
            .all()
        )

    def _get_public_campaign(self, db: Session, public_slug: str) -> Campaign:
        slug = str(public_slug or "").strip().lower()
        campaign = db.query(Campaign).filter(Campaign.public_sponsor_slug == slug).one_or_none()
        if campaign is None:
            raise ServiceError("Public sponsor campaign not found", status_code=404)
        return campaign

    def _merge_filters(self, parsed: GiftSearchFilters, filters: dict[str, object]) -> GiftSearchFilters:
        age_min = _optional_int(filters.get("age_min"), parsed.age_min)
        age_max = _optional_int(filters.get("age_max"), parsed.age_max)
        min_cost_cents = _optional_int(filters.get("min_cost_cents"), parsed.min_cost_cents)
        max_cost_cents = _optional_int(filters.get("max_cost_cents"), parsed.max_cost_cents)
        gender = _optional_string(filters.get("gender"), parsed.gender)
        categories = _list_filter(filters.get("categories"), parsed.categories)
        item_types = [value.upper() for value in _list_filter(filters.get("item_types"), parsed.item_types)]
        sizes = _list_filter(filters.get("sizes"), parsed.sizes)
        return GiftSearchFilters(
            query=parsed.query,
            age_min=age_min,
            age_max=age_max,
            gender=gender.upper() if gender else None,
            categories=categories,
            item_types=item_types,
            sizes=sizes,
            min_cost_cents=min_cost_cents,
            max_cost_cents=max_cost_cents,
            terms=parsed.terms,
            warnings=parsed.warnings,
        )

    def _has_structured_filters(self, parsed: GiftSearchFilters) -> bool:
        return any(
            [
                parsed.age_min is not None,
                parsed.age_max is not None,
                parsed.gender,
                parsed.categories,
                parsed.item_types,
                parsed.sizes,
                parsed.min_cost_cents is not None,
                parsed.max_cost_cents is not None,
            ]
        )


def _optional_int(value: object, default: int | None) -> int | None:
    if value in (None, ""):
        return default
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ServiceError("Invalid numeric filter", status_code=400) from exc


def _optional_string(value: object, default: str | None) -> str | None:
    if value in (None, ""):
        return default
    return str(value).strip()


def _list_filter(value: object, default: list[str]) -> list[str]:
    if value in (None, ""):
        return list(default)
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    if isinstance(value, list):
        return [str(part).strip() for part in value if str(part).strip()]
    raise ServiceError("Invalid list filter", status_code=400)
