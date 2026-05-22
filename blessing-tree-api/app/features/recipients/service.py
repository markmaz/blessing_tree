from __future__ import annotations

import uuid
from collections import Counter

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.recipients.validation import (
    parse_bool,
    require_short_text,
    require_uuid,
    validate_contact_role,
    validate_group_status,
    validate_group_type,
    validate_intake_method,
    validate_optional_datetime,
    validate_optional_email,
    validate_optional_int,
    validate_optional_long_text,
    validate_optional_phone,
    validate_optional_text,
    validate_preferred_contact,
    validate_privacy_level,
    validate_program_abbreviation,
    validate_recipient_contact_context,
    validate_program_alignment,
    validate_program_type,
    validate_recipient_kind,
    validate_recipient_status,
    validate_wishlist_item_type,
    validate_wishlist_status,
)
from app.models.group_contact import GroupContact
from app.models.pickup_item import PickupItem
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem
from app.models.fulfillment import Fulfillment
from app.models.recipient_constants import (
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_KIND_ADULT,
    WISHLIST_ITEM_TYPE_GIFT,
)


class CampaignRecipientService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def get_workspace_payload(self, db: Session, campaign_id: str) -> dict[str, object]:
        groups = self.list_groups(db, campaign_id)
        recipients = self.list_recipients(db, campaign_id)
        return {
            "campaign_id": campaign_id,
            "counts": self._build_counts(groups, recipients),
            "groups": groups,
            "recipients": recipients,
        }

    def list_groups(
        self,
        db: Session,
        campaign_id: str,
        *,
        search: str | None = None,
        group_type: str | None = None,
        status: str | None = None,
    ) -> list[RecipientGroup]:
        self.campaigns.get_campaign(db, campaign_id)
        query = (
            db.query(RecipientGroup)
            .options(
                joinedload(RecipientGroup.contacts),
                *self._recipient_group_load_options(),
            )
            .filter(RecipientGroup.campaign_id == campaign_id)
        )
        if search:
            pattern = f"%{str(search).strip().lower()}%"
            query = query.filter(func.lower(RecipientGroup.group_name).like(pattern))
        if group_type:
            query = query.filter(RecipientGroup.group_type == validate_group_type(group_type))
        if status:
            query = query.filter(RecipientGroup.status == validate_group_status(status))
        return query.order_by(RecipientGroup.group_name.asc()).all()

    def get_group(self, db: Session, campaign_id: str, group_id: str) -> RecipientGroup:
        self.campaigns.get_campaign(db, campaign_id)
        group = (
            db.query(RecipientGroup)
            .options(
                joinedload(RecipientGroup.contacts),
                *self._recipient_group_load_options(),
            )
            .filter(
                RecipientGroup.campaign_id == campaign_id,
                RecipientGroup.id == require_uuid(group_id, "group_id"),
            )
            .one_or_none()
        )
        if group is None:
            raise ServiceError("Recipient group not found", status_code=404, details={"group_id": group_id})
        return group

    def create_group(self, db: Session, campaign_id: str, payload: dict[str, object]) -> RecipientGroup:
        self.campaigns.get_campaign(db, campaign_id)
        group = RecipientGroup(
            id=uuid.uuid4(),
            campaign_id=uuid.UUID(campaign_id),
            group_type=validate_group_type(payload.get("group_type")),
            group_name=require_short_text(payload.get("group_name"), "group_name"),
            program_abbreviation=validate_program_abbreviation(
                payload.get("program_abbreviation"),
                required=validate_group_type(payload.get("group_type")) == "ADULT_PROGRAM",
            ),
            intake_source=validate_optional_text(payload.get("intake_source"), "intake_source"),
            external_reference=validate_optional_text(payload.get("external_reference"), "external_reference"),
            notes=validate_optional_long_text(payload.get("notes"), "notes"),
            status=validate_group_status(payload.get("status")),
            address_line1=validate_optional_text(payload.get("address_line1"), "address_line1"),
            address_line2=validate_optional_text(payload.get("address_line2"), "address_line2"),
            city=validate_optional_text(payload.get("city"), "city", max_length=128),
            state=validate_optional_text(payload.get("state"), "state", max_length=64),
            postal_code=validate_optional_text(payload.get("postal_code"), "postal_code", max_length=32),
        )
        self._validate_program_abbreviation_uniqueness(db, group)
        db.add(group)
        db.commit()
        return self.get_group(db, campaign_id, str(group.id))

    def update_group(self, db: Session, campaign_id: str, group_id: str, payload: dict[str, object]) -> RecipientGroup:
        group = self.get_group(db, campaign_id, group_id)
        if "group_type" in payload:
            next_group_type = validate_group_type(payload.get("group_type"))
            for recipient in list(group.recipients or []):
                validate_program_alignment(
                    group_type=next_group_type,
                    recipient_kind=recipient.recipient_kind,
                    program_type=recipient.program_type,
                )
            group.group_type = next_group_type
            if next_group_type == "HOUSEHOLD":
                group.program_abbreviation = None
            elif group.program_abbreviation is None:
                group.program_abbreviation = self._derive_group_abbreviation(group.group_name)
        if "group_name" in payload:
            group.group_name = require_short_text(payload.get("group_name"), "group_name")
        if "program_abbreviation" in payload or ("group_type" in payload and group.group_type == "ADULT_PROGRAM"):
            group.program_abbreviation = validate_program_abbreviation(
                payload.get("program_abbreviation", group.program_abbreviation),
                required=group.group_type == "ADULT_PROGRAM",
            )
        if "intake_source" in payload:
            group.intake_source = validate_optional_text(payload.get("intake_source"), "intake_source")
        if "external_reference" in payload:
            group.external_reference = validate_optional_text(payload.get("external_reference"), "external_reference")
        if "notes" in payload:
            group.notes = validate_optional_long_text(payload.get("notes"), "notes")
        if "status" in payload:
            group.status = validate_group_status(payload.get("status"))
        for field_name, max_length in {
            "address_line1": 255,
            "address_line2": 255,
            "city": 128,
            "state": 64,
            "postal_code": 32,
        }.items():
            if field_name in payload:
                setattr(group, field_name, validate_optional_text(payload.get(field_name), field_name, max_length=max_length))
        self._validate_program_abbreviation_uniqueness(db, group)
        if group.group_type == "ADULT_PROGRAM":
            self._sync_group_program_recipient_ids(db, group)
        else:
            self._clear_group_program_recipient_ids(group)
        db.commit()
        return self.get_group(db, campaign_id, group_id)

    def create_contact(self, db: Session, campaign_id: str, group_id: str, payload: dict[str, object]) -> GroupContact:
        group = self.get_group(db, campaign_id, group_id)
        contact = GroupContact(
            id=uuid.uuid4(),
            recipient_group_id=group.id,
            contact_role=validate_contact_role(payload.get("contact_role")),
            relationship_label=validate_optional_text(payload.get("relationship_label"), "relationship_label"),
            first_name=validate_optional_text(payload.get("first_name"), "first_name", max_length=128),
            last_name=validate_optional_text(payload.get("last_name"), "last_name", max_length=128),
            email=validate_optional_email(payload.get("email"), "email"),
            phone=validate_optional_phone(payload.get("phone"), "phone"),
            preferred_contact=validate_preferred_contact(payload.get("preferred_contact")),
            is_primary=parse_bool(payload.get("is_primary"), "is_primary", default=False),
            can_pick_up=parse_bool(payload.get("can_pick_up"), "can_pick_up", default=False),
            is_emergency_contact=parse_bool(payload.get("is_emergency_contact"), "is_emergency_contact", default=False),
            notes=validate_optional_long_text(payload.get("notes"), "notes"),
        )
        db.add(contact)
        self._normalize_primary_contact(group, contact)
        db.commit()
        return self._get_contact(db, group.id, str(contact.id))

    def update_contact(
        self,
        db: Session,
        campaign_id: str,
        group_id: str,
        contact_id: str,
        payload: dict[str, object],
    ) -> GroupContact:
        group = self.get_group(db, campaign_id, group_id)
        contact = self._get_contact(db, group.id, contact_id)
        if "contact_role" in payload:
            contact.contact_role = validate_contact_role(payload.get("contact_role"))
        for field_name, max_length in {
            "relationship_label": 255,
            "first_name": 128,
            "last_name": 128,
        }.items():
            if field_name in payload:
                contact_value = validate_optional_text(payload.get(field_name), field_name, max_length=max_length)
                setattr(contact, field_name, contact_value)
        if "email" in payload:
            contact.email = validate_optional_email(payload.get("email"), "email")
        if "phone" in payload:
            contact.phone = validate_optional_phone(payload.get("phone"), "phone")
        if "preferred_contact" in payload:
            contact.preferred_contact = validate_preferred_contact(payload.get("preferred_contact"))
        if "is_primary" in payload:
            contact.is_primary = parse_bool(payload.get("is_primary"), "is_primary")
        if "can_pick_up" in payload:
            contact.can_pick_up = parse_bool(payload.get("can_pick_up"), "can_pick_up")
        if "is_emergency_contact" in payload:
            contact.is_emergency_contact = parse_bool(payload.get("is_emergency_contact"), "is_emergency_contact")
        if "notes" in payload:
            contact.notes = validate_optional_long_text(payload.get("notes"), "notes")
        self._normalize_primary_contact(group, contact)
        db.commit()
        return self._get_contact(db, group.id, contact_id)

    def delete_contact(self, db: Session, campaign_id: str, group_id: str, contact_id: str) -> None:
        group = self.get_group(db, campaign_id, group_id)
        contact = self._get_contact(db, group.id, contact_id)
        db.delete(contact)
        db.commit()

    def list_recipients(
        self,
        db: Session,
        campaign_id: str,
        *,
        search: str | None = None,
        group_id: str | None = None,
        program_type: str | None = None,
        recipient_kind: str | None = None,
        status: str | None = None,
    ) -> list[Recipient]:
        self.campaigns.get_campaign(db, campaign_id)
        query = (
            db.query(Recipient)
            .options(*self._recipient_load_options())
            .filter(Recipient.campaign_id == campaign_id)
        )
        if search:
            pattern = f"%{str(search).strip().lower()}%"
            query = query.filter(
                func.lower(Recipient.display_label).like(pattern)
                | func.lower(func.coalesce(Recipient.first_name, "")).like(pattern)
                | func.lower(func.coalesce(Recipient.last_name, "")).like(pattern)
            )
        if group_id:
            query = query.filter(Recipient.recipient_group_id == require_uuid(group_id, "group_id"))
        if program_type:
            query = query.filter(Recipient.program_type == validate_program_type(program_type))
        if recipient_kind:
            query = query.filter(Recipient.recipient_kind == validate_recipient_kind(recipient_kind))
        if status:
            query = query.filter(Recipient.status == validate_recipient_status(status))
        return query.order_by(Recipient.display_label.asc()).all()

    def get_recipient(self, db: Session, campaign_id: str, recipient_id: str) -> Recipient:
        self.campaigns.get_campaign(db, campaign_id)
        recipient = (
            db.query(Recipient)
            .options(*self._recipient_load_options())
            .filter(
                Recipient.campaign_id == campaign_id,
                Recipient.id == require_uuid(recipient_id, "recipient_id"),
            )
            .one_or_none()
        )
        if recipient is None:
            raise ServiceError("Recipient not found", status_code=404, details={"recipient_id": recipient_id})
        return recipient

    def create_recipient(self, db: Session, campaign_id: str, payload: dict[str, object]) -> Recipient:
        self.campaigns.get_campaign(db, campaign_id)
        group = self.get_group(db, campaign_id, str(payload.get("recipient_group_id")))
        recipient_kind = validate_recipient_kind(payload.get("recipient_kind"))
        program_type = validate_program_type(payload.get("program_type"))
        validate_program_alignment(
            group_type=group.group_type,
            recipient_kind=recipient_kind,
            program_type=program_type,
        )
        recipient = Recipient(
            id=uuid.uuid4(),
            campaign_id=uuid.UUID(campaign_id),
            recipient_group_id=group.id,
            recipient_kind=recipient_kind,
            program_type=program_type,
            privacy_level=validate_privacy_level(payload.get("privacy_level")),
            display_label=require_short_text(payload.get("display_label"), "display_label"),
            first_name=validate_optional_text(payload.get("first_name"), "first_name", max_length=128),
            last_name=validate_optional_text(payload.get("last_name"), "last_name", max_length=128),
            birth_year=validate_optional_int(payload.get("birth_year"), "birth_year", minimum=1900, maximum=3000),
            age=validate_optional_int(payload.get("age"), "age", minimum=0, maximum=130),
            gender=validate_optional_text(payload.get("gender"), "gender", max_length=1),
            address_line1=validate_optional_text(payload.get("address_line1"), "address_line1"),
            address_line2=validate_optional_text(payload.get("address_line2"), "address_line2"),
            city=validate_optional_text(payload.get("city"), "city", max_length=128),
            state=validate_optional_text(payload.get("state"), "state", max_length=64),
            postal_code=validate_optional_text(payload.get("postal_code"), "postal_code", max_length=32),
            direct_email=validate_optional_email(payload.get("direct_email"), "direct_email"),
            direct_phone=validate_optional_phone(payload.get("direct_phone"), "direct_phone"),
            facility_room=validate_optional_text(payload.get("facility_room"), "facility_room", max_length=64),
            subgroup_label=validate_optional_text(payload.get("subgroup_label"), "subgroup_label"),
            mobility_notes=validate_optional_long_text(payload.get("mobility_notes"), "mobility_notes"),
            notes=validate_optional_long_text(payload.get("notes"), "notes"),
            status=validate_recipient_status(payload.get("status")),
        )
        validate_recipient_contact_context(
            group_type=group.group_type,
            recipient_kind=recipient.recipient_kind,
            address_line1=recipient.address_line1,
            address_line2=recipient.address_line2,
            city=recipient.city,
            state=recipient.state,
            postal_code=recipient.postal_code,
            direct_email=recipient.direct_email,
            direct_phone=recipient.direct_phone,
        )
        self._assign_program_recipient_identity(db, group, recipient)
        db.add(recipient)
        db.commit()
        return self.get_recipient(db, campaign_id, str(recipient.id))

    def update_recipient(self, db: Session, campaign_id: str, recipient_id: str, payload: dict[str, object]) -> Recipient:
        recipient = self.get_recipient(db, campaign_id, recipient_id)
        group = recipient.recipient_group
        group_changed = False
        if "recipient_group_id" in payload:
            group = self.get_group(db, campaign_id, str(payload.get("recipient_group_id")))
            group_changed = group.id != recipient.recipient_group_id
            recipient.recipient_group_id = group.id
        recipient_kind = recipient.recipient_kind
        if "recipient_kind" in payload:
            recipient_kind = validate_recipient_kind(payload.get("recipient_kind"))
            recipient.recipient_kind = recipient_kind
        program_type = recipient.program_type
        if "program_type" in payload:
            program_type = validate_program_type(payload.get("program_type"))
            recipient.program_type = program_type
        validate_program_alignment(
            group_type=group.group_type,
            recipient_kind=recipient_kind,
            program_type=program_type,
        )
        if "privacy_level" in payload:
            recipient.privacy_level = validate_privacy_level(payload.get("privacy_level"))
        if "display_label" in payload:
            recipient.display_label = require_short_text(payload.get("display_label"), "display_label")
        for field_name, max_length in {
            "first_name": 128,
            "last_name": 128,
            "address_line1": 255,
            "address_line2": 255,
            "city": 128,
            "state": 64,
            "postal_code": 32,
            "facility_room": 64,
            "subgroup_label": 255,
        }.items():
            if field_name in payload:
                setattr(recipient, field_name, validate_optional_text(payload.get(field_name), field_name, max_length=max_length))
        if "birth_year" in payload:
            recipient.birth_year = validate_optional_int(payload.get("birth_year"), "birth_year", minimum=1900, maximum=3000)
        if "age" in payload:
            recipient.age = validate_optional_int(payload.get("age"), "age", minimum=0, maximum=130)
        if "gender" in payload:
            recipient.gender = validate_optional_text(payload.get("gender"), "gender", max_length=1)
        if "direct_email" in payload:
            recipient.direct_email = validate_optional_email(payload.get("direct_email"), "direct_email")
        if "direct_phone" in payload:
            recipient.direct_phone = validate_optional_phone(payload.get("direct_phone"), "direct_phone")
        if "mobility_notes" in payload:
            recipient.mobility_notes = validate_optional_long_text(payload.get("mobility_notes"), "mobility_notes")
        if "notes" in payload:
            recipient.notes = validate_optional_long_text(payload.get("notes"), "notes")
        if "status" in payload:
            recipient.status = validate_recipient_status(payload.get("status"))
        validate_recipient_contact_context(
            group_type=group.group_type,
            recipient_kind=recipient_kind,
            address_line1=recipient.address_line1,
            address_line2=recipient.address_line2,
            city=recipient.city,
            state=recipient.state,
            postal_code=recipient.postal_code,
            direct_email=recipient.direct_email,
            direct_phone=recipient.direct_phone,
        )
        if group_changed:
            recipient.program_recipient_number = None
            recipient.program_recipient_id = None
        self._assign_program_recipient_identity(db, group, recipient)
        db.commit()
        return self.get_recipient(db, campaign_id, recipient_id)

    def get_wishlist(self, db: Session, campaign_id: str, recipient_id: str) -> Wishlist:
        recipient = self.get_recipient(db, campaign_id, recipient_id)
        if recipient.wishlist is None:
            raise ServiceError("Wishlist not found", status_code=404, details={"recipient_id": recipient_id})
        return self._get_wishlist(db, recipient.id)

    def upsert_wishlist(self, db: Session, campaign_id: str, recipient_id: str, payload: dict[str, object]) -> Wishlist:
        recipient = self.get_recipient(db, campaign_id, recipient_id)
        wishlist = recipient.wishlist
        if wishlist is None:
            wishlist = Wishlist(
                id=uuid.uuid4(),
                campaign_id=uuid.UUID(campaign_id),
                recipient_id=recipient.id,
            )
            db.add(wishlist)
            db.flush()
        if "wishlist_status" in payload or wishlist.wishlist_status is None:
            wishlist.wishlist_status = validate_wishlist_status(payload.get("wishlist_status", wishlist.wishlist_status))
        if "intake_method" in payload:
            wishlist.intake_method = validate_intake_method(payload.get("intake_method"))
        if "submitted_at" in payload:
            wishlist.submitted_at = validate_optional_datetime(payload.get("submitted_at"), "submitted_at")
        if "intake_completed_by_contact_id" in payload:
            wishlist.intake_completed_by_contact_id = self._validate_optional_group_contact_id(
                db,
                recipient.recipient_group_id,
                payload.get("intake_completed_by_contact_id"),
            )
        if "notes" in payload:
            wishlist.notes = validate_optional_long_text(payload.get("notes"), "notes")
        db.commit()
        return self._get_wishlist(db, recipient.id)

    def create_wishlist_item(
        self,
        db: Session,
        campaign_id: str,
        recipient_id: str,
        payload: dict[str, object],
    ) -> WishlistItem:
        wishlist = self.upsert_wishlist(db, campaign_id, recipient_id, {})
        item = WishlistItem(
            id=uuid.uuid4(),
            wishlist_id=wishlist.id,
            category=validate_optional_text(payload.get("category"), "category", max_length=64),
            item_type=validate_wishlist_item_type(payload.get("item_type"), default=WISHLIST_ITEM_TYPE_GIFT),
            description=require_short_text(payload.get("description"), "description", max_length=512),
            size=validate_optional_text(payload.get("size"), "size", max_length=64),
            qty_requested=validate_optional_int(payload.get("qty_requested"), "qty_requested", minimum=1) or 1,
            priority=str(payload.get("priority") or "MEDIUM").strip().upper(),
            est_cost_cents=validate_optional_int(payload.get("est_cost_cents"), "est_cost_cents", minimum=0),
            allow_substitute=parse_bool(payload.get("allow_substitute"), "allow_substitute", default=True),
            do_not_substitute_reason=validate_optional_long_text(payload.get("do_not_substitute_reason"), "do_not_substitute_reason"),
            recipient_note=validate_optional_long_text(payload.get("recipient_note"), "recipient_note"),
            notes=validate_optional_long_text(payload.get("notes"), "notes"),
            status="OPEN",
            qty_fulfilled=0,
            label_code=f"wishlist-{uuid.uuid4()}",
            label_version=1,
        )
        db.add(item)
        db.commit()
        return self._get_wishlist_item(db, wishlist.id, str(item.id))

    def update_wishlist_item(
        self,
        db: Session,
        campaign_id: str,
        recipient_id: str,
        item_id: str,
        payload: dict[str, object],
    ) -> WishlistItem:
        wishlist = self.get_wishlist(db, campaign_id, recipient_id)
        item = self._get_wishlist_item(db, wishlist.id, item_id)
        for field_name, max_length in {
            "category": 64,
            "size": 64,
        }.items():
            if field_name in payload:
                setattr(item, field_name, validate_optional_text(payload.get(field_name), field_name, max_length=max_length))
        if "item_type" in payload:
            item.item_type = validate_wishlist_item_type(payload.get("item_type"))
        if "description" in payload:
            item.description = require_short_text(payload.get("description"), "description", max_length=512)
        if "qty_requested" in payload:
            item.qty_requested = validate_optional_int(payload.get("qty_requested"), "qty_requested", minimum=1) or item.qty_requested
        if "priority" in payload:
            item.priority = str(payload.get("priority") or item.priority).strip().upper()
        if "est_cost_cents" in payload:
            item.est_cost_cents = validate_optional_int(payload.get("est_cost_cents"), "est_cost_cents", minimum=0)
        if "allow_substitute" in payload:
            item.allow_substitute = parse_bool(payload.get("allow_substitute"), "allow_substitute")
        if "do_not_substitute_reason" in payload:
            item.do_not_substitute_reason = validate_optional_long_text(payload.get("do_not_substitute_reason"), "do_not_substitute_reason")
        if "recipient_note" in payload:
            item.recipient_note = validate_optional_long_text(payload.get("recipient_note"), "recipient_note")
        if "notes" in payload:
            item.notes = validate_optional_long_text(payload.get("notes"), "notes")
        db.commit()
        return self._get_wishlist_item(db, wishlist.id, item_id)

    def delete_wishlist_item(self, db: Session, campaign_id: str, recipient_id: str, item_id: str) -> None:
        wishlist = self.get_wishlist(db, campaign_id, recipient_id)
        item = self._get_wishlist_item(db, wishlist.id, item_id)
        db.delete(item)
        db.commit()

    def _get_contact(self, db: Session, group_id: uuid.UUID, contact_id: str) -> GroupContact:
        contact = (
            db.query(GroupContact)
            .filter(
                GroupContact.recipient_group_id == group_id,
                GroupContact.id == require_uuid(contact_id, "contact_id"),
            )
            .one_or_none()
        )
        if contact is None:
            raise ServiceError("Group contact not found", status_code=404, details={"contact_id": contact_id})
        return contact

    def _get_wishlist(self, db: Session, recipient_id: uuid.UUID) -> Wishlist:
        wishlist = (
            db.query(Wishlist)
            .options(*self._wishlist_load_options())
            .filter(Wishlist.recipient_id == recipient_id)
            .one()
        )
        return wishlist

    def _get_wishlist_item(self, db: Session, wishlist_id: uuid.UUID, item_id: str) -> WishlistItem:
        item = (
            db.query(WishlistItem)
            .options(*self._wishlist_item_load_options())
            .filter(
                WishlistItem.wishlist_id == wishlist_id,
                WishlistItem.id == require_uuid(item_id, "item_id"),
            )
            .one_or_none()
        )
        if item is None:
            raise ServiceError("Wishlist item not found", status_code=404, details={"item_id": item_id})
        return item

    def _validate_optional_group_contact_id(
        self,
        db: Session,
        recipient_group_id: uuid.UUID,
        value: object,
    ) -> uuid.UUID | None:
        if value in (None, ""):
            return None
        contact_id = require_uuid(value, "intake_completed_by_contact_id")
        contact = (
            db.query(GroupContact)
            .filter(
                GroupContact.id == contact_id,
                GroupContact.recipient_group_id == recipient_group_id,
            )
            .one_or_none()
        )
        if contact is None:
            raise ServiceError(
                "Group contact not found",
                status_code=404,
                details={"field": "intake_completed_by_contact_id"},
            )
        return contact_id

    @staticmethod
    def _normalize_primary_contact(group: RecipientGroup, active_contact: GroupContact) -> None:
        if active_contact.is_primary:
            for existing in list(group.contacts or []):
                if existing.id != active_contact.id:
                    existing.is_primary = False
        elif not any(contact.is_primary for contact in list(group.contacts or []) if contact.id != active_contact.id):
            active_contact.is_primary = True

    @staticmethod
    def _derive_group_abbreviation(group_name: str) -> str:
        cleaned = "".join(character for character in group_name.upper() if character.isalnum())
        return (cleaned[:12] or "ADULT")

    def _validate_program_abbreviation_uniqueness(self, db: Session, group: RecipientGroup) -> None:
        if group.group_type != "ADULT_PROGRAM" or not group.program_abbreviation:
            return
        existing = (
            db.query(RecipientGroup.id)
            .filter(
                RecipientGroup.campaign_id == group.campaign_id,
                RecipientGroup.program_abbreviation == group.program_abbreviation,
                RecipientGroup.id != group.id,
            )
            .first()
        )
        if existing is not None:
            raise ServiceError(
                "program_abbreviation must be unique within the campaign",
                status_code=400,
                details={"field": "program_abbreviation"},
            )

    def _assign_program_recipient_identity(
        self,
        db: Session,
        group: RecipientGroup,
        recipient: Recipient,
    ) -> None:
        if group.group_type != "ADULT_PROGRAM" or recipient.recipient_kind != RECIPIENT_KIND_ADULT:
            recipient.program_recipient_number = None
            recipient.program_recipient_id = None
            return

        abbreviation = group.program_abbreviation or self._derive_group_abbreviation(group.group_name)
        group.program_abbreviation = abbreviation

        if recipient.program_recipient_number is None:
            max_number = (
                db.query(func.max(Recipient.program_recipient_number))
                .filter(
                    Recipient.recipient_group_id == group.id,
                    Recipient.id != recipient.id,
                )
                .scalar()
            )
            recipient.program_recipient_number = (max_number or 0) + 1

        recipient.program_recipient_id = f"{abbreviation}-{recipient.program_recipient_number:03d}"

    def _sync_group_program_recipient_ids(self, db: Session, group: RecipientGroup) -> None:
        recipients = db.query(Recipient).filter(Recipient.recipient_group_id == group.id).all()
        recipients.sort(
            key=lambda recipient: (
                recipient.program_recipient_number is None,
                recipient.program_recipient_number or 0,
                recipient.created_at,
                recipient.display_label,
            )
        )
        for index, recipient in enumerate(recipients, start=1):
            if recipient.recipient_kind != RECIPIENT_KIND_ADULT:
                recipient.program_recipient_number = None
                recipient.program_recipient_id = None
                continue
            if recipient.program_recipient_number is None:
                recipient.program_recipient_number = index
            recipient.program_recipient_id = f"{group.program_abbreviation}-{recipient.program_recipient_number:03d}"

    @staticmethod
    def _clear_group_program_recipient_ids(group: RecipientGroup) -> None:
        for recipient in list(group.recipients or []):
            recipient.program_recipient_number = None
            recipient.program_recipient_id = None

    @staticmethod
    def _build_counts(groups: list[RecipientGroup], recipients: list[Recipient]) -> dict[str, int]:
        group_counts = Counter(group.group_type for group in groups)
        recipient_counts = Counter(recipient.recipient_kind for recipient in recipients)
        wishlists = [recipient.wishlist for recipient in recipients if recipient.wishlist is not None]
        wishlist_items = [
            item
            for wishlist in wishlists
            for item in list(wishlist.items or [])
        ]
        sponsored_item_count = sum(1 for item in wishlist_items if item.sponsorship_item is not None)
        fulfilled_item_count = 0
        ready_for_pickup_item_count = 0
        picked_up_item_count = 0
        open_items_count = 0
        for item in wishlist_items:
            qty_fulfilled = sum(row.quantity_fulfilled for row in list(item.fulfillment_rows or []))
            is_fully_fulfilled = qty_fulfilled >= item.qty_requested
            is_picked_up = item.pickup_item is not None or item.picked_up_at is not None
            if is_fully_fulfilled:
                fulfilled_item_count += 1
            if is_fully_fulfilled and not is_picked_up:
                ready_for_pickup_item_count += 1
            if is_picked_up:
                picked_up_item_count += 1
            if not is_fully_fulfilled and not is_picked_up:
                open_items_count += 1
        groups_with_pickup_contacts_count = sum(
            1 for group in groups if any(contact.can_pick_up for contact in list(group.contacts or []))
        )
        groups_missing_primary_contact_count = sum(
            1 for group in groups if not any(contact.is_primary for contact in list(group.contacts or []))
        )
        adults_with_direct_contact_count = sum(
            1
            for recipient in recipients
            if recipient.recipient_kind == RECIPIENT_KIND_ADULT
            and any(
                value not in (None, "")
                for value in [
                    recipient.address_line1,
                    recipient.address_line2,
                    recipient.city,
                    recipient.state,
                    recipient.postal_code,
                    recipient.direct_email,
                    recipient.direct_phone,
                ]
            )
        )
        return {
            "group_count": len(groups),
            "active_group_count": sum(1 for group in groups if group.status == RECIPIENT_GROUP_STATUS_ACTIVE),
            "household_count": group_counts.get("HOUSEHOLD", 0),
            "adult_program_count": group_counts.get("ADULT_PROGRAM", 0),
            "recipient_count": len(recipients),
            "child_count": recipient_counts.get("CHILD", 0),
            "adult_count": recipient_counts.get("ADULT", 0),
            "wishlist_count": len(wishlists),
            "open_item_count": open_items_count,
            "sponsored_item_count": sponsored_item_count,
            "fulfilled_item_count": fulfilled_item_count,
            "ready_for_pickup_item_count": ready_for_pickup_item_count,
            "picked_up_item_count": picked_up_item_count,
            "groups_with_pickup_contacts_count": groups_with_pickup_contacts_count,
            "groups_missing_primary_contact_count": groups_missing_primary_contact_count,
            "adults_with_direct_contact_count": adults_with_direct_contact_count,
        }

    @staticmethod
    def _recipient_group_load_options():
        return (
            joinedload(RecipientGroup.recipients).options(*CampaignRecipientService._recipient_detail_load_options()),
        )

    @staticmethod
    def _recipient_load_options():
        return (
            joinedload(Recipient.recipient_group).joinedload(RecipientGroup.contacts),
            *CampaignRecipientService._recipient_detail_load_options(),
        )

    @staticmethod
    def _recipient_detail_load_options():
        return (
            joinedload(Recipient.wishlist).options(*CampaignRecipientService._wishlist_load_options()),
        )

    @staticmethod
    def _wishlist_load_options():
        return (
            joinedload(Wishlist.intake_completed_by_contact),
            joinedload(Wishlist.items).options(*CampaignRecipientService._wishlist_item_load_options()),
        )

    @staticmethod
    def _wishlist_item_load_options():
        return (
            joinedload(WishlistItem.sponsorship_item)
            .joinedload(SponsorshipItem.sponsorship),
            joinedload(WishlistItem.fulfillment_rows)
            .joinedload(Fulfillment.donation_line),
            joinedload(WishlistItem.label_print_items),
            joinedload(WishlistItem.pickup_item)
            .joinedload(PickupItem.pickup),
        )
