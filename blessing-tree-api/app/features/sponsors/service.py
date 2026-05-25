from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, or_
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.gift_policy_service import CampaignGiftPolicyService
from app.features.campaigns.service import CampaignService
from app.features.gifts.reservation_service import GiftReservationService
from app.features.sponsors.validation import (
    generate_public_verification_token,
    validate_interaction_payload,
    validate_sponsor_payload,
    validate_sponsorship_payload,
    validate_selected_wishlist_item_ids,
    validate_sponsor_source,
)
from app.models.campaign import Campaign
from app.models.campaign_milestone import CampaignMilestone
from app.models.gift_reservation import GiftReservation
from app.models.pending_sponsor_registration import PendingSponsorRegistration
from app.models.sponsor import Sponsor
from app.models.sponsor_constants import (
    PENDING_SPONSOR_REGISTRATION_STATUS_CANCELLED,
    PENDING_SPONSOR_REGISTRATION_STATUS_EXPIRED,
    PENDING_SPONSOR_REGISTRATION_STATUS_PENDING,
    PENDING_SPONSOR_REGISTRATION_STATUS_VERIFIED,
    SPONSOR_INTERACTION_ORIGIN_MANUAL,
    SPONSOR_INTERACTION_ORIGIN_PUBLIC_SIGNUP,
)
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsor_reminder import SponsorReminder
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem


class CampaignSponsorService:
    def __init__(
        self,
        campaign_service: CampaignService | None = None,
        gift_reservations: GiftReservationService | None = None,
    ) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.gift_reservations = gift_reservations or GiftReservationService()
        self.gift_policy = CampaignGiftPolicyService(self.campaigns)

    def get_workspace_payload(self, db: Session, campaign_id: str) -> dict[str, object]:
        self.expire_pending_registrations(db, campaign_id)
        sponsors = self.list_sponsors(db, campaign_id)
        counts = self._build_counts(db, campaign_id, sponsors)
        return {
            "campaign_id": campaign_id,
            "counts": counts,
            "sponsors": sponsors,
        }

    def list_sponsors(
        self,
        db: Session,
        campaign_id: str,
        *,
        search: str | None = None,
        status: str | None = None,
        interest_status: str | None = None,
        drop_off_status: str | None = None,
    ) -> list[Sponsorship]:
        self.campaigns.get_campaign(db, campaign_id)
        query = (
            db.query(Sponsorship)
            .options(*self._sponsorship_load_options())
            .filter(Sponsorship.campaign_id == uuid.UUID(campaign_id))
        )
        if search:
            pattern = f"%{str(search).strip().lower()}%"
            query = query.join(Sponsorship.sponsor).filter(
                or_(
                    func.lower(Sponsor.display_name).like(pattern),
                    func.lower(func.coalesce(Sponsor.organization_name, "")).like(pattern),
                    func.lower(func.coalesce(Sponsor.email, "")).like(pattern),
                    func.lower(func.coalesce(Sponsor.phone, "")).like(pattern),
                )
            )
        if status:
            query = query.filter(Sponsorship.status == str(status).strip().upper())
        if interest_status:
            query = query.filter(Sponsorship.interest_status == str(interest_status).strip().upper())
        if drop_off_status:
            query = query.filter(Sponsorship.drop_off_status == str(drop_off_status).strip().upper())
        return query.order_by(Sponsor.display_name.asc()).join(Sponsorship.sponsor).all()

    def get_sponsor(self, db: Session, campaign_id: str, sponsor_id: str) -> Sponsorship:
        self.campaigns.get_campaign(db, campaign_id)
        sponsorship = (
            db.query(Sponsorship)
            .options(*self._sponsorship_load_options())
            .filter(
                Sponsorship.campaign_id == uuid.UUID(campaign_id),
                Sponsorship.sponsor_id == uuid.UUID(sponsor_id),
            )
            .one_or_none()
        )
        if sponsorship is None:
            raise ServiceError("Sponsor not found", status_code=404, details={"sponsor_id": sponsor_id})
        return sponsorship

    def create_sponsor(self, db: Session, campaign_id: str, payload: dict[str, object]) -> Sponsorship:
        self.campaigns.get_campaign(db, campaign_id)
        sponsor_payload = self._sponsor_payload(payload)
        participation_payload = self._participation_payload(payload)

        sponsor_values = validate_sponsor_payload(sponsor_payload)
        participation_values = validate_sponsorship_payload(participation_payload)

        sponsor = self._match_existing_sponsor(db, sponsor_values)
        if sponsor is None:
            sponsor = Sponsor(id=uuid.uuid4(), **sponsor_values)
            db.add(sponsor)
            db.flush()
        else:
            self._apply_sponsor_updates(sponsor, sponsor_values)

        existing = (
            db.query(Sponsorship)
            .filter(
                Sponsorship.campaign_id == uuid.UUID(campaign_id),
                Sponsorship.sponsor_id == sponsor.id,
            )
            .one_or_none()
        )
        if existing is not None:
            raise ServiceError(
                "Sponsor already exists in this campaign",
                status_code=409,
                details={"sponsor_id": str(sponsor.id)},
            )

        sponsorship = Sponsorship(
            id=uuid.uuid4(),
            campaign_id=uuid.UUID(campaign_id),
            sponsor_id=sponsor.id,
            **participation_values,
        )
        db.add(sponsorship)
        self._commit_with_conflict_handling(db)
        return self.get_sponsor(db, campaign_id, str(sponsor.id))

    def update_sponsor(self, db: Session, campaign_id: str, sponsor_id: str, payload: dict[str, object]) -> Sponsorship:
        sponsorship = self.get_sponsor(db, campaign_id, sponsor_id)
        sponsor = sponsorship.sponsor

        sponsor_raw = self._sponsor_payload(payload)
        participation_raw = self._participation_payload(payload)

        if sponsor_raw:
            merged_sponsor = {
                "first_name": sponsor_raw.get("first_name", sponsor.first_name),
                "last_name": sponsor_raw.get("last_name", sponsor.last_name),
                "display_name": sponsor_raw.get("display_name", sponsor.display_name),
                "organization_name": sponsor_raw.get("organization_name", sponsor.organization_name),
                "email": sponsor_raw.get("email", sponsor.email),
                "phone": sponsor_raw.get("phone", sponsor.phone),
                "address_line1": sponsor_raw.get("address_line1", sponsor.address_line1),
                "address_line2": sponsor_raw.get("address_line2", sponsor.address_line2),
                "city": sponsor_raw.get("city", sponsor.city),
                "state": sponsor_raw.get("state", sponsor.state),
                "postal_code": sponsor_raw.get("postal_code", sponsor.postal_code),
                "preferred_contact": sponsor_raw.get("preferred_contact", sponsor.preferred_contact),
                "source": sponsor_raw.get("source", sponsor.source),
                "source_detail": sponsor_raw.get("source_detail", sponsor.source_detail),
                "notes": sponsor_raw.get("notes", sponsor.notes),
                "is_active": sponsor_raw.get("is_active", sponsor.is_active),
                "do_not_contact": sponsor_raw.get("do_not_contact", sponsor.do_not_contact),
                "self_registered_at": sponsor_raw.get("self_registered_at", sponsor.self_registered_at),
                "last_contacted_at": sponsor_raw.get("last_contacted_at", sponsor.last_contacted_at),
            }
            sponsor_values = validate_sponsor_payload(merged_sponsor)
            self._apply_sponsor_updates(sponsor, sponsor_values)

        if participation_raw:
            merged_participation = {
                "status": participation_raw.get("status", sponsorship.status),
                "interest_status": participation_raw.get("interest_status", sponsorship.interest_status),
                "drop_off_status": participation_raw.get("drop_off_status", sponsorship.drop_off_status),
                "drop_off_due_at": participation_raw.get("drop_off_due_at", sponsorship.drop_off_due_at),
                "drop_off_completed_at": participation_raw.get("drop_off_completed_at", sponsorship.drop_off_completed_at),
                "self_registered": participation_raw.get("self_registered", sponsorship.self_registered),
                "sponsor_code": participation_raw.get("sponsor_code", sponsorship.sponsor_code),
                "participation_notes": participation_raw.get("participation_notes", participation_raw.get("notes", sponsorship.notes)),
            }
            participation_values = validate_sponsorship_payload(merged_participation)
            self._apply_sponsorship_updates(sponsorship, participation_values)

        self._commit_with_conflict_handling(db)
        return self.get_sponsor(db, campaign_id, sponsor_id)

    def delete_sponsor(self, db: Session, campaign_id: str, sponsor_id: str) -> None:
        sponsorship = self.get_sponsor(db, campaign_id, sponsor_id)
        sponsor = sponsorship.sponsor

        for sponsorship_item in list(sponsorship.items or []):
            wishlist_item = sponsorship_item.wishlist_item
            if wishlist_item is not None and wishlist_item.status == "COMMITTED":
                wishlist_item.status = "OPEN"

        db.query(SponsorReminder).filter(
            SponsorReminder.campaign_id == uuid.UUID(campaign_id),
            SponsorReminder.sponsor_id == sponsor.id,
        ).delete(synchronize_session=False)
        db.query(SponsorInteraction).filter(
            SponsorInteraction.campaign_id == uuid.UUID(campaign_id),
            SponsorInteraction.sponsor_id == sponsor.id,
        ).delete(synchronize_session=False)
        db.delete(sponsorship)
        db.flush()

        has_remaining_links = (
            db.query(Sponsorship.id).filter(Sponsorship.sponsor_id == sponsor.id).first() is not None
            or db.query(SponsorInteraction.id).filter(SponsorInteraction.sponsor_id == sponsor.id).first() is not None
            or db.query(SponsorReminder.id).filter(SponsorReminder.sponsor_id == sponsor.id).first() is not None
        )
        if not has_remaining_links and not sponsor.donations:
            db.delete(sponsor)
        db.commit()

    def list_interactions(self, db: Session, campaign_id: str, sponsor_id: str) -> list[SponsorInteraction]:
        sponsorship = self.get_sponsor(db, campaign_id, sponsor_id)
        return (
            db.query(SponsorInteraction)
            .filter(
                SponsorInteraction.campaign_id == sponsorship.campaign_id,
                SponsorInteraction.sponsor_id == sponsorship.sponsor_id,
            )
            .order_by(SponsorInteraction.occurred_at.desc())
            .all()
        )

    def create_interaction(
        self,
        db: Session,
        campaign_id: str,
        sponsor_id: str,
        payload: dict[str, object],
        *,
        created_by_user_id: str | None = None,
    ) -> SponsorInteraction:
        sponsorship = self.get_sponsor(db, campaign_id, sponsor_id)
        values = validate_interaction_payload(payload)
        interaction = SponsorInteraction(
            id=uuid.uuid4(),
            campaign_id=sponsorship.campaign_id,
            sponsor_id=sponsorship.sponsor_id,
            created_by_user_id=uuid.UUID(created_by_user_id) if created_by_user_id else None,
            **values,
        )
        db.add(interaction)
        db.flush()
        self._refresh_last_contacted_at(db, sponsorship.sponsor)
        db.commit()
        return self._get_interaction(db, str(interaction.id))

    def update_interaction(
        self,
        db: Session,
        campaign_id: str,
        sponsor_id: str,
        interaction_id: str,
        payload: dict[str, object],
    ) -> SponsorInteraction:
        sponsorship = self.get_sponsor(db, campaign_id, sponsor_id)
        interaction = self._get_campaign_interaction(db, sponsorship, interaction_id)
        if interaction.origin_type != SPONSOR_INTERACTION_ORIGIN_MANUAL:
            raise ServiceError("System-generated interactions are read only", status_code=409)

        merged = {
            "channel": payload.get("channel", interaction.channel),
            "direction": payload.get("direction", interaction.direction),
            "subject": payload.get("subject", interaction.subject),
            "origin_type": payload.get("origin_type", interaction.origin_type),
            "outcome": payload.get("outcome", interaction.outcome),
            "notes": payload.get("notes", interaction.notes),
            "occurred_at": payload.get("occurred_at", interaction.occurred_at),
            "follow_up_at": payload.get("follow_up_at", interaction.follow_up_at),
            "related_sponsorship_id": payload.get("related_sponsorship_id", interaction.related_sponsorship_id),
            "related_schedule_id": payload.get("related_schedule_id", interaction.related_schedule_id),
            "related_delivery_attempt_id": payload.get("related_delivery_attempt_id", interaction.related_delivery_attempt_id),
            "external_message_id": payload.get("external_message_id", interaction.external_message_id),
        }
        values = validate_interaction_payload(merged)
        for key, value in values.items():
            if key in {"related_sponsorship_id", "related_schedule_id"} and value is not None:
                setattr(interaction, key, uuid.UUID(value))
            else:
                setattr(interaction, key, value)
        self._refresh_last_contacted_at(db, sponsorship.sponsor)
        db.commit()
        return self._get_interaction(db, interaction_id)

    def delete_interaction(self, db: Session, campaign_id: str, sponsor_id: str, interaction_id: str) -> None:
        sponsorship = self.get_sponsor(db, campaign_id, sponsor_id)
        interaction = self._get_campaign_interaction(db, sponsorship, interaction_id)
        if interaction.origin_type != SPONSOR_INTERACTION_ORIGIN_MANUAL:
            raise ServiceError("System-generated interactions are read only", status_code=409)
        db.delete(interaction)
        db.flush()
        self._refresh_last_contacted_at(db, sponsorship.sponsor)
        db.commit()

    def list_pending_registrations(self, db: Session, campaign_id: str) -> list[PendingSponsorRegistration]:
        self.campaigns.get_campaign(db, campaign_id)
        self.expire_pending_registrations(db, campaign_id)
        return (
            db.query(PendingSponsorRegistration)
            .filter(PendingSponsorRegistration.campaign_id == uuid.UUID(campaign_id))
            .order_by(PendingSponsorRegistration.created_at.desc())
            .all()
        )

    def get_public_signup_config(self, db: Session, public_slug: str) -> dict[str, object]:
        campaign = self._get_public_campaign(db, public_slug)
        self.expire_pending_registrations(db, campaign.id)
        milestone_map = self._campaign_milestone_map(db, campaign.id)
        state = self._public_signup_state(campaign, milestone_map)
        policy = self.gift_policy.get_policy(db, campaign.id)
        return {
            "campaign": campaign,
            "public_slug": public_slug,
            "state": state,
            "available_items": self._list_public_available_items(db, campaign.id),
            "gift_deadline": self._serialize_milestone_date(milestone_map.get("gift_intake_end")),
            "selection_limit": policy.max_gifts_per_sponsor,
            "whole_item_only": not policy.allow_partial_sponsor_commitments,
        }

    def submit_public_registration(
        self,
        db: Session,
        public_slug: str,
        payload: dict[str, object],
        *,
        submitted_ip: str | None = None,
        user_agent: str | None = None,
    ) -> PendingSponsorRegistration:
        campaign = self._get_public_campaign(db, public_slug)
        milestone_map = self._campaign_milestone_map(db, campaign.id)
        state = self._public_signup_state(campaign, milestone_map)
        if state["status"] != "OPEN":
            raise ServiceError(
                "Sponsor registration is not currently open for this campaign",
                status_code=409,
                details={"registration_status": state["status"]},
            )

        sponsor_raw = self._sponsor_payload(payload)
        sponsor_values = validate_sponsor_payload(sponsor_raw)
        email = sponsor_values.get("email")
        if not email:
            raise ServiceError("email is required", status_code=400, details={"field": "email"})

        policy = self.gift_policy.get_policy(db, campaign.id)
        matched_sponsor = self._match_existing_sponsor(db, sponsor_values)
        source = validate_sponsor_source(payload.get("source"), default="PUBLIC_LINK")
        now = datetime.now(UTC).replace(tzinfo=None)
        expires_at = now + timedelta(minutes=policy.reservation_hold_minutes)
        existing = (
            db.query(PendingSponsorRegistration)
            .filter(
                PendingSponsorRegistration.campaign_id == campaign.id,
                func.lower(PendingSponsorRegistration.email) == str(email).lower(),
                PendingSponsorRegistration.status == PENDING_SPONSOR_REGISTRATION_STATUS_PENDING,
            )
            .one_or_none()
        )
        if existing is None:
            registration = PendingSponsorRegistration(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                matched_sponsor_id=matched_sponsor.id if matched_sponsor is not None else None,
                email=str(email),
                verification_token=generate_public_verification_token(),
                verification_sent_at=now,
                expires_at=expires_at,
                status=PENDING_SPONSOR_REGISTRATION_STATUS_PENDING,
                selected_wishlist_item_ids_json=[],
                source=source,
                submitted_ip=submitted_ip,
                user_agent=user_agent,
            )
            db.add(registration)
        else:
            registration = existing
            registration.matched_sponsor_id = matched_sponsor.id if matched_sponsor is not None else None
            registration.verification_token = generate_public_verification_token()
            registration.verification_sent_at = now
            registration.expires_at = expires_at
            registration.verified_at = None
            registration.status = PENDING_SPONSOR_REGISTRATION_STATUS_PENDING
            registration.selected_wishlist_item_ids_json = []
            registration.source = source
            registration.submitted_ip = submitted_ip
            registration.user_agent = user_agent

        registration.first_name = sponsor_values.get("first_name")
        registration.last_name = sponsor_values.get("last_name")
        registration.display_name = sponsor_values.get("display_name")
        registration.organization_name = sponsor_values.get("organization_name")
        registration.phone = sponsor_values.get("phone")
        registration.preferred_contact = str(sponsor_values.get("preferred_contact") or "EMAIL")
        registration.address_line1 = sponsor_values.get("address_line1")
        registration.address_line2 = sponsor_values.get("address_line2")
        registration.city = sponsor_values.get("city")
        registration.state = sponsor_values.get("state")
        registration.postal_code = sponsor_values.get("postal_code")
        registration.notes = sponsor_values.get("notes")

        db.flush()
        db.commit()
        db.refresh(registration)
        return registration

    def verify_public_registration(
        self,
        db: Session,
        public_slug: str,
        token: str,
    ) -> dict[str, object]:
        campaign = self._get_public_campaign(db, public_slug)
        self.expire_pending_registrations(db, campaign.id)
        registration = (
            db.query(PendingSponsorRegistration)
            .filter(
                PendingSponsorRegistration.campaign_id == campaign.id,
                PendingSponsorRegistration.verification_token == str(token).strip(),
            )
            .one_or_none()
        )
        if registration is None:
            raise ServiceError("Sponsor verification token is invalid", status_code=404)
        if registration.status == PENDING_SPONSOR_REGISTRATION_STATUS_EXPIRED:
            raise ServiceError("Sponsor verification link has expired", status_code=409)
        if registration.status == PENDING_SPONSOR_REGISTRATION_STATUS_VERIFIED:
            sponsorship = self._get_verified_sponsorship_for_registration(db, campaign.id, registration)
            return {
                "campaign": campaign,
                "registration": registration,
                "sponsorship": sponsorship,
                "gift_deadline": self._serialize_milestone_date(self._campaign_milestone_map(db, campaign.id).get("gift_intake_end")),
                "selection_limit": self.gift_policy.get_policy(db, campaign.id).max_gifts_per_sponsor,
                "message": "This sponsor registration has already been verified.",
            }

        milestone_map = self._campaign_milestone_map(db, campaign.id)
        state = self._public_signup_state(campaign, milestone_map)
        if state["status"] == "BLOCKED":
            raise ServiceError("Sponsor registration is blocked for this campaign", status_code=409)

        selected_ids = list(registration.selected_wishlist_item_ids_json or [])
        selected_items = self.gift_reservations.load_active_registration_items(
            db,
            campaign_id=campaign.id,
            registration_id=registration.id,
        )
        if not selected_items and selected_ids:
            selected_items = self._load_public_available_items_by_id(db, campaign.id, selected_ids)
        if len(selected_items) != len(selected_ids):
            unavailable = sorted(set(selected_ids) - {str(item.id) for item in selected_items})
            raise ServiceError(
                "One or more selected gifts are no longer available",
                status_code=409,
                details={"unavailable_wishlist_item_ids": unavailable},
            )

        sponsor_values = validate_sponsor_payload(
            {
                "first_name": registration.first_name,
                "last_name": registration.last_name,
                "display_name": registration.display_name,
                "organization_name": registration.organization_name,
                "email": registration.email,
                "phone": registration.phone,
                "address_line1": registration.address_line1,
                "address_line2": registration.address_line2,
                "city": registration.city,
                "state": registration.state,
                "postal_code": registration.postal_code,
                "preferred_contact": registration.preferred_contact,
                "source": registration.source,
                "notes": registration.notes,
                "is_active": True,
                "do_not_contact": False,
                "self_registered_at": datetime.now(UTC).replace(tzinfo=None),
            }
        )
        sponsor = registration.matched_sponsor or self._match_existing_sponsor(db, sponsor_values)
        if sponsor is None:
            sponsor = Sponsor(id=uuid.uuid4(), **sponsor_values)
            db.add(sponsor)
            db.flush()
        else:
            self.gift_policy.enforce_sponsor_gift_limit(
                db,
                campaign_id=campaign.id,
                sponsor_id=sponsor.id,
                additional_item_count=len(selected_items),
            )
            self._apply_sponsor_updates(sponsor, sponsor_values)

        sponsorship = (
            db.query(Sponsorship)
            .options(*self._sponsorship_load_options())
            .filter(
                Sponsorship.campaign_id == campaign.id,
                Sponsorship.sponsor_id == sponsor.id,
            )
            .one_or_none()
        )
        gift_deadline = milestone_map.get("gift_intake_end")
        if sponsorship is None:
            sponsorship = Sponsorship(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                sponsor_id=sponsor.id,
                status="ACTIVE",
                interest_status="COMMITTED",
                drop_off_status="NOT_STARTED",
                drop_off_due_at=self._milestone_due_datetime(gift_deadline),
                self_registered=True,
            )
            db.add(sponsorship)
            db.flush()
        else:
            sponsorship.self_registered = True
            sponsorship.status = "ACTIVE"
            sponsorship.interest_status = "COMMITTED"
            if gift_deadline is not None:
                sponsorship.drop_off_due_at = self._milestone_due_datetime(gift_deadline)

        for wishlist_item in selected_items:
            sponsorship_item = SponsorshipItem(
                id=uuid.uuid4(),
                sponsorship_id=sponsorship.id,
                wishlist_item_id=wishlist_item.id,
                qty_committed=wishlist_item.qty_requested,
                notes="Reserved through public sponsor self-registration.",
            )
            db.add(sponsorship_item)
            wishlist_item.status = "COMMITTED"
        self.gift_reservations.mark_registration_committed(
            db,
            registration_id=registration.id,
            sponsor_id=sponsor.id,
        )

        interaction = SponsorInteraction(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            sponsor_id=sponsor.id,
            channel="EMAIL",
            direction="INBOUND",
            subject="Public sponsor registration verified",
            origin_type=SPONSOR_INTERACTION_ORIGIN_PUBLIC_SIGNUP,
            outcome="COMPLETED",
            notes=(
                f"Verified public sponsor signup for {len(selected_items)} gift item(s)."
            ),
            occurred_at=datetime.now(UTC).replace(tzinfo=None),
            related_sponsorship_id=sponsorship.id,
        )
        db.add(interaction)
        registration.matched_sponsor_id = sponsor.id
        registration.status = PENDING_SPONSOR_REGISTRATION_STATUS_VERIFIED
        registration.verified_at = datetime.now(UTC).replace(tzinfo=None)
        try:
            db.flush()
            self._refresh_last_contacted_at(db, sponsor)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ServiceError(
                "One or more selected gifts are no longer available",
                status_code=409,
                details={"unavailable_wishlist_item_ids": selected_ids},
            ) from exc
        return {
            "campaign": campaign,
            "registration": registration,
            "sponsorship": self.get_sponsor(db, str(campaign.id), str(sponsor.id)),
            "gift_deadline": self._serialize_milestone_date(gift_deadline),
            "selection_limit": self.gift_policy.get_policy(db, campaign.id).max_gifts_per_sponsor,
            "message": (
                "Your sponsor registration has been verified and your selected gifts are now reserved."
                if selected_items
                else "Your sponsor registration has been verified. You can now choose gifts to sponsor."
            ),
        }

    def commit_verified_public_gifts(
        self,
        db: Session,
        public_slug: str,
        token: str,
        selected_wishlist_item_ids: object,
    ) -> dict[str, object]:
        campaign = self._get_public_campaign(db, public_slug)
        self.expire_pending_registrations(db, campaign.id)
        registration = (
            db.query(PendingSponsorRegistration)
            .filter(
                PendingSponsorRegistration.campaign_id == campaign.id,
                PendingSponsorRegistration.verification_token == str(token).strip(),
            )
            .one_or_none()
        )
        if registration is None:
            raise ServiceError("Sponsor verification token is invalid", status_code=404)
        if registration.status != PENDING_SPONSOR_REGISTRATION_STATUS_VERIFIED:
            raise ServiceError("Sponsor email must be verified before gifts can be selected", status_code=409)

        sponsorship = self._get_verified_sponsorship_for_registration(db, campaign.id, registration)
        selected_ids = validate_selected_wishlist_item_ids(
            selected_wishlist_item_ids,
            max_items=self.gift_policy.get_policy(db, campaign.id).max_gifts_per_sponsor,
        )
        if not selected_ids:
            raise ServiceError(
                "Select at least one gift item to sponsor",
                status_code=400,
                details={"field": "selected_wishlist_item_ids"},
            )
        self.gift_policy.enforce_sponsor_gift_limit(
            db,
            campaign_id=campaign.id,
            sponsor_id=sponsorship.sponsor_id,
            additional_item_count=len(selected_ids),
        )
        selected_items = self._load_public_available_items_by_id(db, campaign.id, selected_ids)
        if len(selected_items) != len(selected_ids):
            unavailable = sorted(set(selected_ids) - {str(item.id) for item in selected_items})
            raise ServiceError(
                "One or more selected gifts are no longer available",
                status_code=409,
                details={"unavailable_wishlist_item_ids": unavailable},
            )

        for wishlist_item in selected_items:
            db.add(
                SponsorshipItem(
                    id=uuid.uuid4(),
                    sponsorship_id=sponsorship.id,
                    wishlist_item_id=wishlist_item.id,
                    qty_committed=wishlist_item.qty_requested,
                    notes="Selected through public sponsor confirmation page.",
                )
            )
            wishlist_item.status = "COMMITTED"

        db.add(
            SponsorInteraction(
                id=uuid.uuid4(),
                campaign_id=campaign.id,
                sponsor_id=sponsorship.sponsor_id,
                channel="EMAIL",
                direction="INBOUND",
                subject="Public sponsor gifts selected",
                origin_type=SPONSOR_INTERACTION_ORIGIN_PUBLIC_SIGNUP,
                outcome="COMPLETED",
                notes=f"Selected {len(selected_items)} gift item(s) after email verification.",
                occurred_at=datetime.now(UTC).replace(tzinfo=None),
                related_sponsorship_id=sponsorship.id,
            )
        )
        try:
            db.flush()
            self._refresh_last_contacted_at(db, sponsorship.sponsor)
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ServiceError(
                "One or more selected gifts are no longer available",
                status_code=409,
                details={"unavailable_wishlist_item_ids": selected_ids},
            ) from exc

        return {
            "campaign": campaign,
            "registration": registration,
            "sponsorship": self._get_verified_sponsorship_for_registration(db, campaign.id, registration),
            "gift_deadline": self._serialize_milestone_date(self._campaign_milestone_map(db, campaign.id).get("gift_intake_end")),
            "selection_limit": self.gift_policy.get_policy(db, campaign.id).max_gifts_per_sponsor,
            "message": "Your selected gifts have been reserved. Thank you for sponsoring this campaign.",
        }

    def resend_pending_registration(self, db: Session, campaign_id: str, registration_id: str) -> PendingSponsorRegistration:
        self.expire_pending_registrations(db, campaign_id)
        registration = self._get_pending_registration(db, campaign_id, registration_id)
        if registration.status == PENDING_SPONSOR_REGISTRATION_STATUS_VERIFIED:
            raise ServiceError("Verified sponsor registrations cannot be resent", status_code=409)
        if registration.status == PENDING_SPONSOR_REGISTRATION_STATUS_CANCELLED:
            raise ServiceError("Cancelled sponsor registrations cannot be resent", status_code=409)
        now = datetime.now(UTC).replace(tzinfo=None)
        registration.verification_token = generate_public_verification_token()
        registration.verification_sent_at = now
        registration.expires_at = now + timedelta(hours=24)
        registration.status = PENDING_SPONSOR_REGISTRATION_STATUS_PENDING
        self.gift_reservations.extend_registration_reservations(
            db,
            registration_id=registration.id,
            expires_at=registration.expires_at,
        )
        db.commit()
        db.refresh(registration)
        return registration

    def cancel_pending_registration(self, db: Session, campaign_id: str, registration_id: str) -> PendingSponsorRegistration:
        self.expire_pending_registrations(db, campaign_id)
        registration = self._get_pending_registration(db, campaign_id, registration_id)
        if registration.status == PENDING_SPONSOR_REGISTRATION_STATUS_VERIFIED:
            raise ServiceError("Verified sponsor registrations cannot be cancelled", status_code=409)
        registration.status = PENDING_SPONSOR_REGISTRATION_STATUS_CANCELLED
        self.gift_reservations.release_registration_reservations(db, registration.id)
        db.commit()
        db.refresh(registration)
        return registration

    def manually_verify_pending_registration(
        self,
        db: Session,
        campaign_id: str,
        registration_id: str,
    ) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        if not campaign.public_sponsor_slug:
            raise ServiceError("Campaign does not have a public sponsor slug", status_code=409)
        registration = self._get_pending_registration(db, campaign_id, registration_id)
        if registration.status == PENDING_SPONSOR_REGISTRATION_STATUS_CANCELLED:
            raise ServiceError("Cancelled sponsor registrations cannot be verified", status_code=409)
        if registration.status == PENDING_SPONSOR_REGISTRATION_STATUS_EXPIRED:
            registration.status = PENDING_SPONSOR_REGISTRATION_STATUS_PENDING
            registration.expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=24)
        return self.verify_public_registration(db, campaign.public_sponsor_slug, registration.verification_token)

    def expire_pending_registrations(self, db: Session, campaign_id: uuid.UUID | str) -> int:
        campaign_uuid = uuid.UUID(str(campaign_id))
        self.gift_reservations.expire_reservations(db, campaign_uuid)
        now = datetime.now(UTC).replace(tzinfo=None)
        registrations = (
            db.query(PendingSponsorRegistration)
            .filter(
                PendingSponsorRegistration.campaign_id == campaign_uuid,
                PendingSponsorRegistration.status == PENDING_SPONSOR_REGISTRATION_STATUS_PENDING,
                PendingSponsorRegistration.expires_at < now,
            )
            .all()
        )
        if not registrations:
            return 0
        for registration in registrations:
            registration.status = PENDING_SPONSOR_REGISTRATION_STATUS_EXPIRED
        db.commit()
        return len(registrations)

    def _get_pending_registration(
        self,
        db: Session,
        campaign_id: uuid.UUID | str,
        registration_id: uuid.UUID | str,
    ) -> PendingSponsorRegistration:
        registration = (
            db.query(PendingSponsorRegistration)
            .filter(
                PendingSponsorRegistration.campaign_id == uuid.UUID(str(campaign_id)),
                PendingSponsorRegistration.id == uuid.UUID(str(registration_id)),
            )
            .one_or_none()
        )
        if registration is None:
            raise ServiceError(
                "Pending sponsor registration not found",
                status_code=404,
                details={"registration_id": str(registration_id)},
            )
        return registration

    def _match_existing_sponsor(self, db: Session, sponsor_values: dict[str, object]) -> Sponsor | None:
        email = sponsor_values.get("email")
        phone = sponsor_values.get("phone")
        sponsor_by_email = (
            db.query(Sponsor).filter(func.lower(Sponsor.email) == str(email).lower()).order_by(Sponsor.created_at.asc()).first()
            if email
            else None
        )
        sponsor_by_phone = (
            db.query(Sponsor).filter(Sponsor.phone == phone).order_by(Sponsor.created_at.asc()).first()
            if phone
            else None
        )
        if sponsor_by_email is not None and sponsor_by_phone is not None and sponsor_by_email.id != sponsor_by_phone.id:
            raise ServiceError(
                "Sponsor details match multiple existing records",
                status_code=409,
                details={"email": email, "phone": phone},
            )
        return sponsor_by_email or sponsor_by_phone

    def _get_public_campaign(self, db: Session, public_slug: str) -> Campaign:
        slug = str(public_slug or "").strip().lower()
        campaign = (
            db.query(Campaign)
            .filter(Campaign.public_sponsor_slug == slug)
            .one_or_none()
        )
        if campaign is None:
            raise ServiceError("Public sponsor campaign not found", status_code=404)
        return campaign

    def _campaign_milestone_map(self, db: Session, campaign_id: uuid.UUID) -> dict[str, CampaignMilestone]:
        milestones = (
            db.query(CampaignMilestone)
            .filter(CampaignMilestone.campaign_id == campaign_id)
            .all()
        )
        return {milestone.milestone_key: milestone for milestone in milestones}

    def _public_signup_state(
        self,
        campaign: Campaign,
        milestone_map: dict[str, CampaignMilestone],
    ) -> dict[str, object]:
        if not campaign.public_sponsor_signup_enabled:
            return {
                "status": "DISABLED",
                "message": "Sponsor registration is not enabled for this campaign.",
            }
        start = milestone_map.get("sponsor_registration_start")
        end = milestone_map.get("sponsor_registration_end")
        gift_deadline = milestone_map.get("gift_intake_end")
        if start is None or end is None or gift_deadline is None:
            return {
                "status": "BLOCKED",
                "message": "Sponsor registration is missing required campaign milestones.",
                "missing_milestones": [
                    key
                    for key in ("sponsor_registration_start", "sponsor_registration_end", "gift_intake_end")
                    if milestone_map.get(key) is None
                ],
            }
        today = datetime.now(UTC).date()
        if today < start.occurs_on:
            return {
                "status": "NOT_OPEN",
                "message": f"Sponsor registration opens on {start.occurs_on.isoformat()}.",
                "starts_on": start.occurs_on.isoformat(),
                "ends_on": end.occurs_on.isoformat(),
            }
        if today > end.occurs_on:
            return {
                "status": "CLOSED",
                "message": f"Sponsor registration closed on {end.occurs_on.isoformat()}.",
                "starts_on": start.occurs_on.isoformat(),
                "ends_on": end.occurs_on.isoformat(),
            }
        return {
            "status": "OPEN",
            "message": "Sponsor registration is open.",
            "starts_on": start.occurs_on.isoformat(),
            "ends_on": end.occurs_on.isoformat(),
        }

    def _list_public_available_items(self, db: Session, campaign_id: uuid.UUID) -> list[dict[str, object]]:
        items = (
            db.query(WishlistItem)
            .options(
                joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient),
            )
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .outerjoin(SponsorshipItem, SponsorshipItem.wishlist_item_id == WishlistItem.id)
            .outerjoin(GiftReservation, GiftReservation.active_wishlist_item_id == WishlistItem.id)
            .filter(
                Wishlist.campaign_id == campaign_id,
                WishlistItem.status == "OPEN",
                SponsorshipItem.id.is_(None),
                GiftReservation.id.is_(None),
            )
            .order_by(WishlistItem.created_at.asc())
            .all()
        )
        return [self._serialize_public_available_item(item) for item in items]

    def _load_public_available_items_by_id(
        self,
        db: Session,
        campaign_id: uuid.UUID,
        selected_ids: list[str],
    ) -> list[WishlistItem]:
        item_ids = [uuid.UUID(item_id) for item_id in selected_ids]
        items = (
            db.query(WishlistItem)
            .options(joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient))
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .outerjoin(SponsorshipItem, SponsorshipItem.wishlist_item_id == WishlistItem.id)
            .outerjoin(GiftReservation, GiftReservation.active_wishlist_item_id == WishlistItem.id)
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
        return [indexed[item_id] for item_id in selected_ids if item_id in indexed]

    def _serialize_public_available_item(self, item: WishlistItem) -> dict[str, object]:
        wishlist = item.wishlist
        recipient = wishlist.recipient if wishlist is not None else None
        return {
            "wishlist_item_id": str(item.id),
            "description": item.description,
            "category": item.category,
            "item_type": item.item_type,
            "size": item.size,
            "qty_requested": item.qty_requested,
            "priority": item.priority,
            "recipient": (
                {
                    "id": str(recipient.id),
                    "display_label": recipient.display_label,
                    "program_recipient_id": recipient.program_recipient_id,
                }
                if recipient is not None
                else None
            ),
        }

    def _serialize_milestone_date(self, milestone: CampaignMilestone | None) -> str | None:
        if milestone is None or milestone.occurs_on is None:
            return None
        return milestone.occurs_on.isoformat()

    def _milestone_due_datetime(self, milestone: CampaignMilestone | None) -> datetime | None:
        if milestone is None or milestone.occurs_on is None:
            return None
        return datetime.combine(milestone.occurs_on, datetime.max.time()).replace(microsecond=0)

    def _get_verified_sponsorship_for_registration(
        self,
        db: Session,
        campaign_id: uuid.UUID,
        registration: PendingSponsorRegistration,
    ) -> Sponsorship:
        sponsor_id = registration.matched_sponsor_id
        if sponsor_id is None:
            raise ServiceError("Verified registration is missing sponsor linkage", status_code=409)
        sponsorship = (
            db.query(Sponsorship)
            .options(*self._sponsorship_load_options())
            .filter(
                Sponsorship.campaign_id == campaign_id,
                Sponsorship.sponsor_id == sponsor_id,
            )
            .one_or_none()
        )
        if sponsorship is None:
            raise ServiceError("Verified sponsorship could not be found", status_code=404)
        return sponsorship

    def _apply_sponsor_updates(self, sponsor: Sponsor, values: dict[str, object]) -> None:
        for key, value in values.items():
            setattr(sponsor, key, value)

    def _apply_sponsorship_updates(self, sponsorship: Sponsorship, values: dict[str, object]) -> None:
        for key, value in values.items():
            setattr(sponsorship, key, value)

    def _build_counts(self, db: Session, campaign_id: str, sponsorships: list[Sponsorship]) -> dict[str, int]:
        sponsored_item_count = sum(len(list(sponsorship.items or [])) for sponsorship in sponsorships)
        contactable_sponsor_count = sum(
            1
            for sponsorship in sponsorships
            if sponsorship.sponsor.email or sponsorship.sponsor.phone
        )
        open_sponsor_need_count = (
            db.query(func.count(WishlistItem.id))
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .outerjoin(SponsorshipItem, SponsorshipItem.wishlist_item_id == WishlistItem.id)
            .filter(
                Wishlist.campaign_id == uuid.UUID(campaign_id),
                WishlistItem.status == "OPEN",
                SponsorshipItem.id.is_(None),
            )
            .scalar()
            or 0
        )
        pending_registration_count = (
            db.query(func.count(PendingSponsorRegistration.id))
            .filter(
                PendingSponsorRegistration.campaign_id == uuid.UUID(campaign_id),
                PendingSponsorRegistration.status == "PENDING",
            )
            .scalar()
            or 0
        )
        return {
            "sponsor_count": len(sponsorships),
            "active_sponsorship_count": sum(1 for sponsorship in sponsorships if sponsorship.status == "ACTIVE"),
            "sponsored_item_count": sponsored_item_count,
            "open_sponsor_need_count": int(open_sponsor_need_count),
            "contactable_sponsor_count": contactable_sponsor_count,
            "pending_registration_count": int(pending_registration_count),
            "self_registered_count": sum(1 for sponsorship in sponsorships if sponsorship.self_registered),
        }

    def _refresh_last_contacted_at(self, db: Session, sponsor: Sponsor) -> None:
        last_contacted_at = (
            db.query(func.max(SponsorInteraction.occurred_at))
            .filter(SponsorInteraction.sponsor_id == sponsor.id)
            .scalar()
        )
        sponsor.last_contacted_at = last_contacted_at

    def _get_campaign_interaction(self, db: Session, sponsorship: Sponsorship, interaction_id: str) -> SponsorInteraction:
        interaction = (
            db.query(SponsorInteraction)
            .filter(
                SponsorInteraction.id == uuid.UUID(interaction_id),
                SponsorInteraction.campaign_id == sponsorship.campaign_id,
                SponsorInteraction.sponsor_id == sponsorship.sponsor_id,
            )
            .one_or_none()
        )
        if interaction is None:
            raise ServiceError("Sponsor interaction not found", status_code=404, details={"interaction_id": interaction_id})
        return interaction

    def _get_interaction(self, db: Session, interaction_id: str) -> SponsorInteraction:
        interaction = (
            db.query(SponsorInteraction)
            .filter(SponsorInteraction.id == uuid.UUID(interaction_id))
            .one_or_none()
        )
        if interaction is None:
            raise ServiceError("Sponsor interaction not found", status_code=404, details={"interaction_id": interaction_id})
        return interaction

    def _sponsor_payload(self, payload: dict[str, object]) -> dict[str, object]:
        nested = payload.get("sponsor")
        return nested if isinstance(nested, dict) else payload

    def _participation_payload(self, payload: dict[str, object]) -> dict[str, object]:
        nested = payload.get("participation")
        return nested if isinstance(nested, dict) else payload

    def _sponsorship_load_options(self):
        return (
            joinedload(Sponsorship.sponsor).joinedload(Sponsor.interactions),
            joinedload(Sponsorship.items)
            .joinedload(SponsorshipItem.wishlist_item)
            .joinedload(WishlistItem.wishlist)
            .joinedload(Wishlist.recipient),
        )

    def _commit_with_conflict_handling(self, db: Session) -> None:
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ServiceError("Sponsor save failed due to a conflicting record", status_code=409) from exc
