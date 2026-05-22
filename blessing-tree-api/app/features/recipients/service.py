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
    validate_program_alignment,
    validate_program_type,
    validate_recipient_kind,
    validate_recipient_status,
    validate_wishlist_item_type,
    validate_wishlist_status,
)
from app.models.group_contact import GroupContact
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem
from app.models.recipient_constants import (
    RECIPIENT_GROUP_STATUS_ACTIVE,
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
                joinedload(RecipientGroup.recipients).joinedload(Recipient.wishlist).joinedload(Wishlist.items),
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
                joinedload(RecipientGroup.recipients).joinedload(Recipient.wishlist).joinedload(Wishlist.items),
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
        if "group_name" in payload:
            group.group_name = require_short_text(payload.get("group_name"), "group_name")
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
            .options(
                joinedload(Recipient.recipient_group),
                joinedload(Recipient.wishlist).joinedload(Wishlist.items),
                joinedload(Recipient.wishlist).joinedload(Wishlist.intake_completed_by_contact),
            )
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
            .options(
                joinedload(Recipient.recipient_group),
                joinedload(Recipient.wishlist).joinedload(Wishlist.items),
                joinedload(Recipient.wishlist).joinedload(Wishlist.intake_completed_by_contact),
            )
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
            direct_email=validate_optional_email(payload.get("direct_email"), "direct_email"),
            direct_phone=validate_optional_phone(payload.get("direct_phone"), "direct_phone"),
            facility_room=validate_optional_text(payload.get("facility_room"), "facility_room", max_length=64),
            subgroup_label=validate_optional_text(payload.get("subgroup_label"), "subgroup_label"),
            mobility_notes=validate_optional_long_text(payload.get("mobility_notes"), "mobility_notes"),
            notes=validate_optional_long_text(payload.get("notes"), "notes"),
            status=validate_recipient_status(payload.get("status")),
        )
        db.add(recipient)
        db.commit()
        return self.get_recipient(db, campaign_id, str(recipient.id))

    def update_recipient(self, db: Session, campaign_id: str, recipient_id: str, payload: dict[str, object]) -> Recipient:
        recipient = self.get_recipient(db, campaign_id, recipient_id)
        group = recipient.recipient_group
        if "recipient_group_id" in payload:
            group = self.get_group(db, campaign_id, str(payload.get("recipient_group_id")))
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
            .options(
                joinedload(Wishlist.items),
                joinedload(Wishlist.intake_completed_by_contact),
            )
            .filter(Wishlist.recipient_id == recipient_id)
            .one()
        )
        return wishlist

    def _get_wishlist_item(self, db: Session, wishlist_id: uuid.UUID, item_id: str) -> WishlistItem:
        item = (
            db.query(WishlistItem)
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
    def _build_counts(groups: list[RecipientGroup], recipients: list[Recipient]) -> dict[str, int]:
        group_counts = Counter(group.group_type for group in groups)
        recipient_counts = Counter(recipient.recipient_kind for recipient in recipients)
        wishlists = [recipient.wishlist for recipient in recipients if recipient.wishlist is not None]
        open_items_count = sum(
            1
            for wishlist in wishlists
            for item in list(wishlist.items or [])
            if item.status == "OPEN"
        )
        return {
            "group_count": len(groups),
            "active_group_count": sum(1 for group in groups if group.status == RECIPIENT_GROUP_STATUS_ACTIVE),
            "household_count": group_counts.get("HOUSEHOLD", 0),
            "care_facility_count": group_counts.get("CARE_FACILITY", 0),
            "recipient_count": len(recipients),
            "child_count": recipient_counts.get("CHILD", 0),
            "adult_count": recipient_counts.get("ADULT", 0),
            "wishlist_count": len(wishlists),
            "open_item_count": open_items_count,
        }
