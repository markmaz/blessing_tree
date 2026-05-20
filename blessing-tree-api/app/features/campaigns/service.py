from __future__ import annotations

import uuid
from collections.abc import Mapping

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.campaigns.constants import CAMPAIGN_STATUS_ARCHIVED
from app.features.campaigns.validation import (
    parse_optional_date,
    require_campaign_name,
    require_campaign_year,
    validate_create_status,
    validate_date_order,
    validate_status_transition,
)
from app.features.rbac.constants import CAMPAIGN_MANAGER_ROLE
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.features.rbac.services.authorization_service import AuthorizationService
from app.models.campaign import Campaign
from app.models.donation import Donation
from app.models.donation_line import DonationLine
from app.models.fulfillment import Fulfillment
from app.models.pickup import Pickup
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem


class CampaignService:
    def __init__(self, authorization_service: AuthorizationService | None = None) -> None:
        self.authorization = authorization_service or AuthorizationService()

    def list_visible_campaigns(
        self,
        db: Session,
        user_id: str,
        *,
        status: str | None = None,
        year: str | None = None,
        search: str | None = None,
        include_archived: bool = False,
    ) -> list[Campaign]:
        query = db.query(Campaign)
        if not self.authorization.user_is_app_admin(db, user_id):
            query = (
                query.join(CampaignUserRole, CampaignUserRole.campaign_id == Campaign.id)
                .filter(
                    CampaignUserRole.user_id == user_id,
                    CampaignUserRole.is_active == 1,
                )
                .distinct()
            )

        if not include_archived:
            query = query.filter(Campaign.status != CAMPAIGN_STATUS_ARCHIVED)
        if status:
            query = query.filter(Campaign.status == str(status).strip().upper())
        if year:
            query = query.filter(Campaign.year == require_campaign_year(year))
        if search:
            pattern = f"%{str(search).strip()}%"
            query = query.filter(Campaign.name.ilike(pattern))

        return query.order_by(Campaign.year.desc(), Campaign.name.asc()).all()

    def get_campaign(self, db: Session, campaign_id: str) -> Campaign:
        campaign = db.query(Campaign).filter(Campaign.id == campaign_id).one_or_none()
        if campaign is None:
            raise ServiceError("Campaign not found", status_code=404, details={"campaign_id": campaign_id})
        return campaign

    def get_campaign_access_payload(self, db: Session, user_id: str, campaign_id: str) -> dict[str, object]:
        user = self.authorization._get_user(db, user_id)
        global_app_role = self.authorization.get_global_app_role(user)
        role_keys = self.authorization.get_campaign_role_keys(db, user_id, campaign_id)
        capabilities = self.authorization.get_campaign_capabilities(db, user_id, campaign_id)
        return {
            "campaign_id": campaign_id,
            "global_app_role": global_app_role,
            "role_keys": role_keys,
            "capabilities": capabilities,
        }

    def get_campaign_summary_counts(self, db: Session, campaign_id: str) -> dict[str, int]:
        return {
            "recipient_groups": self._count(db, db.query(RecipientGroup.id).filter(RecipientGroup.campaign_id == campaign_id)),
            "recipients": self._count(db, db.query(Recipient.id).filter(Recipient.campaign_id == campaign_id)),
            "wishlists": self._count(db, db.query(Wishlist.id).filter(Wishlist.campaign_id == campaign_id)),
            "wishlist_items": self._count(
                db,
                db.query(WishlistItem.id).join(Wishlist, WishlistItem.wishlist_id == Wishlist.id).filter(Wishlist.campaign_id == campaign_id),
            ),
            "donations": self._count(db, db.query(Donation.id).filter(Donation.campaign_id == campaign_id)),
            "sponsorships": self._count(db, db.query(Sponsorship.id).filter(Sponsorship.campaign_id == campaign_id)),
            "sponsorship_items": self._count(
                db,
                db.query(SponsorshipItem.id)
                .join(Sponsorship, SponsorshipItem.sponsorship_id == Sponsorship.id)
                .filter(Sponsorship.campaign_id == campaign_id),
            ),
            "fulfillments": self._count(
                db,
                db.query(Fulfillment.id)
                .join(DonationLine, Fulfillment.donation_line_id == DonationLine.id)
                .join(Donation, DonationLine.donation_id == Donation.id)
                .filter(Donation.campaign_id == campaign_id),
            ),
            "pickups": self._count(db, db.query(Pickup.id).filter(Pickup.campaign_id == campaign_id)),
        }

    def create_campaign(self, db: Session, user_id: str, payload: Mapping[str, object]) -> Campaign:
        start_date = parse_optional_date(payload.get("start_date"), "start_date")
        end_date = parse_optional_date(payload.get("end_date"), "end_date")
        validate_date_order(start_date, end_date)

        campaign = Campaign(
            id=uuid.uuid4(),
            name=require_campaign_name(payload.get("name")),
            year=require_campaign_year(payload.get("year")),
            description=_optional_text(payload.get("description")),
            start_date=start_date,
            end_date=end_date,
            status=validate_create_status(payload.get("status")),
        )
        db.add(campaign)
        db.flush()

        db.add(
            CampaignUserRole(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                user_id=user_id,
                role_key=CAMPAIGN_MANAGER_ROLE,
                is_active=True,
            )
        )
        db.commit()
        db.refresh(campaign)
        return campaign

    def update_campaign(
        self,
        db: Session,
        campaign: Campaign,
        payload: Mapping[str, object],
        *,
        is_app_admin: bool,
    ) -> Campaign:
        if "name" in payload:
            campaign.name = require_campaign_name(payload.get("name"))
        if "year" in payload:
            campaign.year = require_campaign_year(payload.get("year"))
        if "description" in payload:
            campaign.description = _optional_text(payload.get("description"))

        start_date = parse_optional_date(payload.get("start_date"), "start_date") if "start_date" in payload else campaign.start_date
        end_date = parse_optional_date(payload.get("end_date"), "end_date") if "end_date" in payload else campaign.end_date
        validate_date_order(start_date, end_date)
        campaign.start_date = start_date
        campaign.end_date = end_date

        if "status" in payload:
            campaign.status = validate_status_transition(
                campaign.status,
                str(payload.get("status")),
                is_app_admin=is_app_admin,
            )

        db.commit()
        db.refresh(campaign)
        return campaign

    @staticmethod
    def _count(db: Session, query) -> int:
        return int(query.with_entities(func.count()).scalar() or 0)


def _optional_text(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None
