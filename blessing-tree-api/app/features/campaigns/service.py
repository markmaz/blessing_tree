from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Mapping
from datetime import date, datetime

from sqlalchemy import distinct, func, or_
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.constants import CAMPAIGN_STATUS_ARCHIVED
from app.features.campaigns.validation import (
    parse_optional_date,
    parse_optional_bool,
    parse_optional_public_sponsor_slug,
    parse_optional_season_theme,
    require_campaign_name,
    require_campaign_year,
    validate_create_status,
    validate_date_order,
    validate_status_transition,
)
from app.features.rbac.constants import CAMPAIGN_MANAGER_ROLE
from app.features.rbac.models.campaign_user_role import CampaignUserRole
from app.features.rbac.services.authorization_service import AuthorizationService
from app.models.app_user import AppUser
from app.models.ask_prompt_log import AskPromptLog
from app.models.campaign import Campaign
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_event import CampaignEvent
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.campaign_milestone import CampaignMilestone
from app.models.campaign_team import CampaignTeam
from app.models.campaign_team_member import CampaignTeamMember
from app.models.campaign_team_role import CampaignTeamRole
from app.models.communication_template import CommunicationTemplate
from app.models.donation import Donation
from app.models.donation_line import DonationLine
from app.models.fulfillment import Fulfillment
from app.models.pickup import Pickup
from app.models.recipient import Recipient
from app.models.recipient_constants import RECIPIENT_KIND_ADULT, RECIPIENT_KIND_CHILD
from app.models.recipient_group import RecipientGroup
from app.models.sponsor import Sponsor
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
            member_visibility = (
                db.query(CampaignMemberAccessRole.id)
                .join(CampaignMember, CampaignMember.id == CampaignMemberAccessRole.campaign_member_id)
                .filter(
                    CampaignMember.campaign_id == Campaign.id,
                    CampaignMember.app_user_id == user_id,
                    CampaignMember.is_active == 1,
                    CampaignMember.app_access_status == "active",
                    CampaignMemberAccessRole.is_active == 1,
                )
                .exists()
            )
            legacy_visibility = (
                db.query(CampaignUserRole.id)
                .filter(
                    CampaignUserRole.campaign_id == Campaign.id,
                    CampaignUserRole.user_id == user_id,
                    CampaignUserRole.is_active == 1,
                )
                .exists()
            )
            query = (
                query.filter(or_(member_visibility, legacy_visibility)).distinct()
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

    def get_campaign_summary(self, db: Session, campaign_id: str, *, user_id: str | None = None) -> dict[str, object]:
        return {
            "counts": self.get_campaign_summary_counts(db, campaign_id),
            "widgets": self.get_dashboard_widgets(db, campaign_id, user_id=user_id),
        }

    def get_dashboard_widgets(self, db: Session, campaign_id: str, *, user_id: str | None = None) -> dict[str, object]:
        population = self.get_population_summary(db, campaign_id)
        unsponsored = self.get_unsponsored_gift_summary(db, campaign_id)
        return {
            "population": {
                **population,
                "gifts": self.get_gift_count(db, campaign_id),
                "unsponsored_gifts": unsponsored["count"],
            },
            "popular_gifts_by_gender": self.get_popular_gifts_by_gender(db, campaign_id),
            "sponsor_recipient_counts": self.get_sponsor_recipient_counts(db, campaign_id),
            "unsponsored_gifts": unsponsored,
            "continue_where_left_off": self.get_user_continue_items(db, campaign_id, user_id=user_id),
            "calendar_upcoming": self.get_calendar_upcoming_widget(db, campaign_id),
        }

    def get_calendar_upcoming_widget(self, db: Session, campaign_id: str, *, limit: int = 5) -> dict[str, object]:
        from app.features.campaigns.calendar_intelligence_service import CampaignCalendarIntelligenceService

        intelligence = CampaignCalendarIntelligenceService(campaign_service=self).get_calendar_intelligence(db, campaign_id)
        upcoming_items = [
            item
            for item in intelligence.get("items", [])
            if item.get("urgency") in {"today", "due_soon", "upcoming", "future"}
        ]
        return {
            "total_count": len(upcoming_items),
            "due_soon_count": int(intelligence.get("summary", {}).get("due_soon_count", 0)),
            "scheduled_communications_count": int(intelligence.get("summary", {}).get("scheduled_communications_count", 0)),
            "items": [self._serialize_calendar_widget_item(item) for item in upcoming_items[:limit]],
        }

    @staticmethod
    def _serialize_calendar_widget_item(item: Mapping[str, object]) -> dict[str, object]:
        date_value = item.get("date")
        return {
            "id": item.get("id"),
            "title": item.get("title"),
            "date": date_value.isoformat() if isinstance(date_value, date) else date_value,
            "urgency": item.get("urgency"),
            "item_type": item.get("item_type"),
            "is_blocker": bool(item.get("is_blocker")),
            "count": item.get("count"),
            "route_name": item.get("route_name"),
        }

    def get_population_summary(self, db: Session, campaign_id: str) -> dict[str, int]:
        rows = (
            db.query(Recipient.recipient_kind, func.count(Recipient.id))
            .filter(Recipient.campaign_id == campaign_id, Recipient.status == "ACTIVE")
            .group_by(Recipient.recipient_kind)
            .all()
        )
        counts = {str(kind): int(value or 0) for kind, value in rows}
        return {
            "children": counts.get(RECIPIENT_KIND_CHILD, 0),
            "adults": counts.get(RECIPIENT_KIND_ADULT, 0),
        }

    def get_gift_count(self, db: Session, campaign_id: str) -> int:
        return self._count(
            db,
            db.query(WishlistItem.id)
            .join(Wishlist, WishlistItem.wishlist_id == Wishlist.id)
            .filter(Wishlist.campaign_id == campaign_id, WishlistItem.status != "CANCELLED"),
        )

    def get_unsponsored_gift_summary(self, db: Session, campaign_id: str, *, limit: int = 5) -> dict[str, object]:
        query = (
            db.query(WishlistItem)
            .join(Wishlist, WishlistItem.wishlist_id == Wishlist.id)
            .join(Recipient, Recipient.id == Wishlist.recipient_id)
            .join(RecipientGroup, RecipientGroup.id == Recipient.recipient_group_id)
            .outerjoin(SponsorshipItem, SponsorshipItem.wishlist_item_id == WishlistItem.id)
            .filter(
                Wishlist.campaign_id == campaign_id,
                WishlistItem.status == "OPEN",
                SponsorshipItem.id.is_(None),
            )
            .order_by(RecipientGroup.group_name.asc(), Recipient.display_label.asc(), WishlistItem.description.asc())
        )
        items = query.limit(limit).all()
        return {
            "count": self._count(db, query.with_entities(WishlistItem.id).order_by(None)),
            "items": [
                {
                    "wishlist_item_id": str(item.id),
                    "gift": item.description,
                    "category": item.category,
                    "recipient_name": item.wishlist.recipient.display_label if item.wishlist and item.wishlist.recipient else None,
                    "group_name": (
                        item.wishlist.recipient.recipient_group.group_name
                        if item.wishlist and item.wishlist.recipient and item.wishlist.recipient.recipient_group
                        else None
                    ),
                }
                for item in items
            ],
        }

    def get_popular_gifts_by_gender(self, db: Session, campaign_id: str, *, per_gender: int = 5) -> list[dict[str, object]]:
        gift_label = func.coalesce(func.nullif(WishlistItem.category, ""), WishlistItem.description).label("gift")
        quantity = func.sum(WishlistItem.qty_requested).label("quantity")
        rows = (
            db.query(Recipient.gender, gift_label, quantity, func.count(WishlistItem.id).label("request_count"))
            .join(Wishlist, WishlistItem.wishlist_id == Wishlist.id)
            .join(Recipient, Recipient.id == Wishlist.recipient_id)
            .filter(Wishlist.campaign_id == campaign_id, WishlistItem.status != "CANCELLED")
            .group_by(Recipient.gender, gift_label)
            .order_by(Recipient.gender.asc(), quantity.desc(), gift_label.asc())
            .all()
        )
        grouped: dict[str, list[dict[str, object]]] = defaultdict(list)
        for gender, gift, qty, request_count in rows:
            label = _gender_label(gender)
            if len(grouped[label]) >= per_gender:
                continue
            grouped[label].append(
                {
                    "gender": label,
                    "gift": gift,
                    "quantity": int(qty or 0),
                    "request_count": int(request_count or 0),
                }
            )
        ordered: list[dict[str, object]] = []
        for gender in sorted(grouped.keys()):
            ordered.extend(grouped[gender])
        return ordered

    def get_sponsor_recipient_counts(self, db: Session, campaign_id: str, *, limit: int = 10) -> list[dict[str, object]]:
        recipient_count = func.count(distinct(Recipient.id)).label("recipient_count")
        gift_count = func.count(WishlistItem.id).label("gift_count")
        rows = (
            db.query(Sponsor.id, Sponsor.display_name, Sponsor.email, recipient_count, gift_count)
            .join(Sponsorship, Sponsorship.sponsor_id == Sponsor.id)
            .join(SponsorshipItem, SponsorshipItem.sponsorship_id == Sponsorship.id)
            .join(WishlistItem, WishlistItem.id == SponsorshipItem.wishlist_item_id)
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .join(Recipient, Recipient.id == Wishlist.recipient_id)
            .filter(Sponsorship.campaign_id == campaign_id, Sponsorship.status != "CANCELLED", Sponsor.is_active == 1)
            .group_by(Sponsor.id, Sponsor.display_name, Sponsor.email)
            .order_by(recipient_count.desc(), Sponsor.display_name.asc())
            .limit(limit)
            .all()
        )
        return [
            {
                "sponsor_id": str(sponsor_id),
                "sponsor_name": sponsor_name,
                "email": email,
                "recipient_count": int(recipients or 0),
                "gift_count": int(gifts or 0),
            }
            for sponsor_id, sponsor_name, email, recipients, gifts in rows
        ]

    def get_user_continue_items(
        self,
        db: Session,
        campaign_id: str,
        *,
        user_id: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, object]]:
        if not user_id:
            return []
        logs = (
            db.query(AskPromptLog)
            .filter(AskPromptLog.campaign_id == campaign_id, AskPromptLog.user_id == user_id)
            .order_by(AskPromptLog.created_at.desc())
            .limit(limit)
            .all()
        )
        return [
            {
                "prompt_log_id": str(log.id),
                "prompt": log.prompt,
                "result_kind": log.result_kind,
                "result_key": log.result_key,
                "title": (log.response_summary_json or {}).get("title") if isinstance(log.response_summary_json, dict) else None,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ]

    def create_campaign(self, db: Session, user_id: str, payload: Mapping[str, object]) -> Campaign:
        source_campaign = self._get_source_campaign(db, payload.get("source_campaign_id"))
        next_year = require_campaign_year(payload.get("year"))
        year_delta = next_year - source_campaign.year if source_campaign is not None else 0
        start_date = parse_optional_date(payload.get("start_date"), "start_date")
        end_date = parse_optional_date(payload.get("end_date"), "end_date")
        if source_campaign is not None:
            if start_date is None:
                start_date = _shift_date(source_campaign.start_date, year_delta)
            if end_date is None:
                end_date = _shift_date(source_campaign.end_date, year_delta)
        validate_date_order(start_date, end_date)

        campaign = Campaign(
            id=uuid.uuid4(),
            name=require_campaign_name(payload.get("name")),
            year=next_year,
            description=_optional_text(payload.get("description")),
            season_theme=(
                parse_optional_season_theme(payload.get("season_theme"))
                if "season_theme" in payload
                else parse_optional_season_theme(source_campaign.season_theme) if source_campaign is not None else None
            ),
            public_sponsor_slug=(
                parse_optional_public_sponsor_slug(payload.get("public_sponsor_slug"))
                if "public_sponsor_slug" in payload
                else parse_optional_public_sponsor_slug(source_campaign.public_sponsor_slug) if source_campaign is not None else None
            ),
            public_sponsor_signup_enabled=(
                parse_optional_bool(payload.get("public_sponsor_signup_enabled"), "public_sponsor_signup_enabled")
                if "public_sponsor_signup_enabled" in payload
                else bool(source_campaign.public_sponsor_signup_enabled) if source_campaign is not None else False
            ) or False,
            start_date=start_date,
            end_date=end_date,
            status=validate_create_status(payload.get("status")),
        )
        self._validate_unique_public_sponsor_slug(db, campaign.public_sponsor_slug)
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

        if source_campaign is not None:
            self._clone_campaign_setup(
                db,
                source_campaign=source_campaign,
                target_campaign=campaign,
                year_delta=year_delta,
                initial_legacy_roles={(str(user_id), CAMPAIGN_MANAGER_ROLE)},
            )
            db.flush()

        self._ensure_creator_campaign_manager_access(db, campaign.id, user_id)
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
        if "season_theme" in payload:
            campaign.season_theme = parse_optional_season_theme(payload.get("season_theme"))
        if "public_sponsor_slug" in payload:
            next_slug = parse_optional_public_sponsor_slug(payload.get("public_sponsor_slug"))
            self._validate_unique_public_sponsor_slug(db, next_slug, exclude_campaign_id=str(campaign.id))
            campaign.public_sponsor_slug = next_slug
        if "public_sponsor_signup_enabled" in payload:
            campaign.public_sponsor_signup_enabled = bool(
                parse_optional_bool(payload.get("public_sponsor_signup_enabled"), "public_sponsor_signup_enabled")
            )

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

    def _get_source_campaign(self, db: Session, source_campaign_id: object) -> Campaign | None:
        raw_value = str(source_campaign_id or "").strip()
        if not raw_value:
            return None

        try:
            source_id = uuid.UUID(raw_value)
        except (TypeError, ValueError, AttributeError) as exc:
            raise ServiceError(
                "source_campaign_id must be a valid UUID",
                status_code=400,
            ) from exc

        source_campaign = (
            db.query(Campaign)
            .options(
                joinedload(Campaign.campaign_members).joinedload(CampaignMember.access_roles),
                joinedload(Campaign.campaign_members).joinedload(CampaignMember.team_memberships),
                joinedload(Campaign.teams).joinedload(CampaignTeam.roles),
                joinedload(Campaign.teams).joinedload(CampaignTeam.memberships),
                joinedload(Campaign.communication_templates),
                joinedload(Campaign.milestones),
                joinedload(Campaign.communication_schedules).joinedload(CampaignCommunicationSchedule.template),
                joinedload(Campaign.events),
            )
            .filter(Campaign.id == source_id)
            .one_or_none()
        )
        if source_campaign is None:
            raise ServiceError("Source campaign not found", status_code=404)
        return source_campaign

    def _validate_unique_public_sponsor_slug(
        self,
        db: Session,
        slug: str | None,
        *,
        exclude_campaign_id: str | None = None,
    ) -> None:
        if not slug:
            return
        query = db.query(Campaign).filter(Campaign.public_sponsor_slug == slug)
        if exclude_campaign_id:
            query = query.filter(Campaign.id != uuid.UUID(exclude_campaign_id))
        if query.first() is not None:
            raise ServiceError(
                "Campaign public_sponsor_slug already exists",
                status_code=409,
                details={"field": "public_sponsor_slug"},
            )

    def _clone_campaign_setup(
        self,
        db: Session,
        *,
        source_campaign: Campaign,
        target_campaign: Campaign,
        year_delta: int,
        initial_legacy_roles: set[tuple[str, str]] | None = None,
    ) -> None:
        member_id_map: dict[uuid.UUID, uuid.UUID] = {}
        team_id_map: dict[uuid.UUID, uuid.UUID] = {}
        team_role_id_map: dict[uuid.UUID, uuid.UUID] = {}
        template_id_map: dict[uuid.UUID, uuid.UUID] = {}
        legacy_roles = set(initial_legacy_roles or set())

        for source_member in source_campaign.campaign_members:
            cloned_member_id = uuid.uuid4()
            member_id_map[source_member.id] = cloned_member_id
            cloned_member = CampaignMember(
                id=cloned_member_id,
                campaign_id=target_campaign.id,
                display_name=source_member.display_name,
                email=source_member.email,
                phone=source_member.phone,
                notes=source_member.notes,
                member_type=source_member.member_type,
                app_user_id=source_member.app_user_id,
                app_access_status=source_member.app_access_status,
                is_active=source_member.is_active,
            )
            db.add(cloned_member)

            for access_role in source_member.access_roles:
                cloned_access_role = CampaignMemberAccessRole(
                    id=uuid.uuid4(),
                    campaign_member_id=cloned_member_id,
                    role_key=access_role.role_key,
                    is_active=access_role.is_active,
                )
                db.add(cloned_access_role)
                if source_member.app_user_id and source_member.app_access_status == "active" and access_role.is_active:
                    legacy_role_key = (str(source_member.app_user_id), access_role.role_key)
                    if legacy_role_key not in legacy_roles:
                        legacy_roles.add(legacy_role_key)
                        db.add(
                            CampaignUserRole(
                                id=uuid.uuid4(),
                                campaign_id=target_campaign.id,
                                user_id=source_member.app_user_id,
                                role_key=access_role.role_key,
                                is_active=True,
                            )
                        )

        for source_team in source_campaign.teams:
            cloned_team_id = uuid.uuid4()
            team_id_map[source_team.id] = cloned_team_id
            db.add(
                CampaignTeam(
                    id=cloned_team_id,
                    campaign_id=target_campaign.id,
                    name=source_team.name,
                    description=source_team.description,
                    is_active=source_team.is_active,
                )
            )

        for source_team in source_campaign.teams:
            cloned_team_id = team_id_map[source_team.id]
            for source_role in source_team.roles:
                cloned_team_role_id = uuid.uuid4()
                team_role_id_map[source_role.id] = cloned_team_role_id
                db.add(
                    CampaignTeamRole(
                        id=cloned_team_role_id,
                        team_id=cloned_team_id,
                        name=source_role.name,
                        description=source_role.description,
                        sort_order=source_role.sort_order,
                        is_active=source_role.is_active,
                    )
                )

        for source_team in source_campaign.teams:
            cloned_team_id = team_id_map[source_team.id]
            for membership in source_team.memberships:
                cloned_member_id = member_id_map.get(membership.campaign_member_id)
                if cloned_member_id is None:
                    continue
                db.add(
                    CampaignTeamMember(
                        id=uuid.uuid4(),
                        team_id=cloned_team_id,
                        campaign_member_id=cloned_member_id,
                        team_role_id=team_role_id_map.get(membership.team_role_id) if membership.team_role_id else None,
                    )
                )

        for source_template in source_campaign.communication_templates:
            cloned_template_id = uuid.uuid4()
            template_id_map[source_template.id] = cloned_template_id
            db.add(
                CommunicationTemplate(
                    id=cloned_template_id,
                    campaign_id=target_campaign.id,
                    template_key=self._build_cloned_template_key(
                        db,
                        campaign_id=target_campaign.id,
                        source_key=source_template.template_key,
                        target_year=target_campaign.year,
                    ),
                    name=self._build_cloned_template_name(source_template.name, target_campaign.year),
                    audience=source_template.audience,
                    channel=source_template.channel,
                    subject_template=source_template.subject_template,
                    body_template=source_template.body_template,
                    is_active=source_template.is_active,
                    created_by_user_id=source_template.created_by_user_id,
                )
            )

        for source_milestone in source_campaign.milestones:
            shifted_occurs_on = _shift_date(source_milestone.occurs_on, year_delta)
            if shifted_occurs_on is None:
                continue
            db.add(
                CampaignMilestone(
                    id=uuid.uuid4(),
                    campaign_id=target_campaign.id,
                    milestone_key=source_milestone.milestone_key,
                    label=source_milestone.label,
                    occurs_on=shifted_occurs_on,
                    notes=source_milestone.notes,
                    sort_order=source_milestone.sort_order,
                )
            )

        for source_schedule in source_campaign.communication_schedules:
            cloned_template_id = template_id_map.get(source_schedule.template_id)
            if cloned_template_id is None:
                continue
            db.add(
                CampaignCommunicationSchedule(
                    id=uuid.uuid4(),
                    campaign_id=target_campaign.id,
                    template_id=cloned_template_id,
                    milestone_key=source_schedule.milestone_key,
                    scheduled_for=_shift_datetime(source_schedule.scheduled_for, year_delta),
                    status="DRAFT",
                    notes=source_schedule.notes,
                    delivery_attempt_count=0,
                    last_attempted_at=None,
                    last_dispatched_at=None,
                    last_delivery_status=None,
                    last_delivery_error=None,
                )
            )

        for source_event in source_campaign.events:
            if source_event.source_type != "manual":
                continue
            shifted_start = _shift_datetime(source_event.start_at, year_delta)
            if shifted_start is None:
                continue
            db.add(
                CampaignEvent(
                    id=uuid.uuid4(),
                    campaign_id=target_campaign.id,
                    title=source_event.title,
                    event_type=source_event.event_type,
                    start_at=shifted_start,
                    end_at=_shift_datetime(source_event.end_at, year_delta),
                    all_day=source_event.all_day,
                    notes=source_event.notes,
                    source_type="manual",
                    source_id=None,
                    created_by_user_id=source_event.created_by_user_id,
                )
            )

    def _ensure_creator_campaign_manager_access(self, db: Session, campaign_id: uuid.UUID, user_id: str) -> None:
        try:
            user_uuid = uuid.UUID(str(user_id))
        except (TypeError, ValueError, AttributeError):
            return

        user = db.get(AppUser, user_uuid)
        if user is None:
            return

        member = (
            db.query(CampaignMember)
            .filter(
                CampaignMember.campaign_id == campaign_id,
                CampaignMember.app_user_id == user_uuid,
            )
            .one_or_none()
        )
        if member is None:
            member = CampaignMember(
                id=uuid.uuid4(),
                campaign_id=campaign_id,
                display_name=user.display_name,
                email=user.email,
                member_type="staff",
                app_user_id=user.id,
                app_access_status="active",
                is_active=True,
            )
            db.add(member)
            db.flush()
        else:
            member.is_active = True
            member.app_access_status = "active"
            if not member.display_name:
                member.display_name = user.display_name
            if not member.email:
                member.email = user.email

        existing_access_role = (
            db.query(CampaignMemberAccessRole.id)
            .filter(
                CampaignMemberAccessRole.campaign_member_id == member.id,
                CampaignMemberAccessRole.role_key == CAMPAIGN_MANAGER_ROLE,
            )
            .one_or_none()
        )
        if existing_access_role is None:
            db.add(
                CampaignMemberAccessRole(
                    id=uuid.uuid4(),
                    campaign_member_id=member.id,
                    role_key=CAMPAIGN_MANAGER_ROLE,
                    is_active=True,
                )
            )

    @staticmethod
    def _build_cloned_template_name(source_name: str, target_year: int) -> str:
        stripped_name = str(source_name).strip()
        if not stripped_name:
            return f"Communication Template {target_year}"
        if f"({target_year})" in stripped_name:
            return stripped_name
        return f"{stripped_name} ({target_year})"

    @staticmethod
    def _build_cloned_template_key(
        db: Session,
        *,
        campaign_id,
        source_key: str,
        target_year: int,
    ) -> str:
        base_key = f"{_slugify_template_key(source_key)}_{target_year}"
        next_key = base_key
        suffix = 2
        while (
            db.query(CommunicationTemplate.id)
            .filter(
                CommunicationTemplate.campaign_id == campaign_id,
                CommunicationTemplate.template_key == next_key,
            )
            .first()
            is not None
        ):
            next_key = f"{base_key}_{suffix}"
            suffix += 1
        return next_key


def _optional_text(value: object) -> str | None:
    text = str(value).strip() if value is not None else ""
    return text or None


def _gender_label(value: str | None) -> str:
    return {"F": "Female", "M": "Male", "X": "Nonbinary", "U": "Unknown"}.get(value or "", "Unknown")


def _shift_date(value: date | None, year_delta: int) -> date | None:
    if value is None or year_delta == 0:
        return value
    try:
        return value.replace(year=value.year + year_delta)
    except ValueError:
        if value.month == 2 and value.day == 29:
            return value.replace(year=value.year + year_delta, day=28)
        raise


def _shift_datetime(value: datetime | None, year_delta: int) -> datetime | None:
    if value is None or year_delta == 0:
        return value
    shifted_date = _shift_date(value.date(), year_delta)
    if shifted_date is None:
        return None
    return value.replace(year=shifted_date.year, month=shifted_date.month, day=shifted_date.day)


def _slugify_template_key(value: object) -> str:
    text = str(value or "").strip().lower()
    slug = "".join(character if character.isalnum() else "_" for character in text)
    slug = "_".join(part for part in slug.split("_") if part)
    return slug or "template"
