from __future__ import annotations

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.campaigns import campaign_ns
from app.features.admin.audit_service import AuditEventService, build_changes
from app.features.recipients import (
    CampaignRecipientService,
    serialize_group_contact,
    serialize_people_workspace,
    serialize_recipient,
    serialize_recipient_group,
    serialize_wishlist,
    serialize_wishlist_item,
)
from app.features.recipients.address_lookup_service import CampaignRecipientAddressLookupService
from app.features.rbac.decorators import require_campaign_capability

_recipient_service = CampaignRecipientService()
_address_lookup_service = CampaignRecipientAddressLookupService()
_audit_event_service = AuditEventService()


GROUP_FIELD_MAP = {
    "group_type": "Group Type",
    "parent_organization_group_id": "Organization",
    "group_name": "Name",
    "organization_type": "Organization Type",
    "program_abbreviation": "Program Abbreviation",
    "intake_source": "Intake Source",
    "external_reference": "External Reference",
    "notes": "Notes",
    "status": "Status",
    "address_line1": "Address Line 1",
    "address_line2": "Address Line 2",
    "city": "City",
    "state": "State",
    "postal_code": "Postal Code",
}

CONTACT_FIELD_MAP = {
    "contact_role": "Role",
    "relationship_label": "Relationship",
    "first_name": "First Name",
    "last_name": "Last Name",
    "email": "Email",
    "phone": "Phone",
    "preferred_contact": "Preferred Contact",
    "is_primary": "Primary",
    "can_pick_up": "Can Pick Up",
    "is_emergency_contact": "Emergency Contact",
    "notes": "Notes",
}

RECIPIENT_FIELD_MAP = {
    "recipient_group_id": "Group",
    "recipient_kind": "Recipient Kind",
    "program_type": "Program Type",
    "privacy_level": "Privacy Level",
    "display_label": "Display Label",
    "first_name": "First Name",
    "last_name": "Last Name",
    "birth_year": "Birth Year",
    "age": "Age",
    "age_unit": "Age Unit",
    "gender": "Gender",
    "address_line1": "Address Line 1",
    "address_line2": "Address Line 2",
    "city": "City",
    "state": "State",
    "postal_code": "Postal Code",
    "direct_email": "Email",
    "direct_phone": "Phone",
    "facility_room": "Room",
    "subgroup_label": "Subgroup",
    "mobility_notes": "Mobility Notes",
    "notes": "Notes",
    "status": "Status",
}

WISHLIST_FIELD_MAP = {
    "wishlist_status": "Wishlist Status",
    "intake_method": "Intake Method",
    "submitted_at": "Submitted At",
    "intake_completed_by_contact_id": "Completed By",
    "notes": "Notes",
}

WISHLIST_ITEM_FIELD_MAP = {
    "category": "Category",
    "item_type": "Item Type",
    "description": "Description",
    "size": "Size",
    "qty_requested": "Quantity Requested",
    "priority": "Priority",
    "est_cost_cents": "Estimated Cost",
    "allow_substitute": "Allow Substitute",
    "do_not_substitute_reason": "Do Not Substitute Reason",
    "recipient_note": "Recipient Note",
    "notes": "Notes",
    "status": "Status",
}


@campaign_ns.route("/<string:campaign_id>/people-workspace")
class CampaignPeopleWorkspaceResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _recipient_service.get_workspace_payload(db, campaign_id)
        return serialize_people_workspace(**payload)


@campaign_ns.route("/<string:campaign_id>/recipient-address-search")
class RecipientAddressSearchResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str):
        suggestions = _address_lookup_service.search(
            request.args.get("q", ""),
            country_code=request.args.get("country_code"),
        )
        return {"suggestions": suggestions}


@campaign_ns.route("/<string:campaign_id>/recipient-groups")
class RecipientGroupListResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            groups = _recipient_service.list_groups(
                db,
                campaign_id,
                search=request.args.get("search"),
                group_type=request.args.get("group_type"),
                status=request.args.get("status"),
            )
        return [serialize_recipient_group(group) for group in groups]

    @require_campaign_capability("campaign.recipients.edit")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            group = _recipient_service.create_group(db, campaign_id, payload)
            response = serialize_recipient_group(group)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="recipient_group",
                entity_id=group.id,
                entity_label=group.group_name,
                summary=f"Created recipient group {group.group_name}.",
                changes=build_changes(before={}, after=_snapshot_group(group), field_map=GROUP_FIELD_MAP),
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/recipient-groups/<string:group_id>")
class RecipientGroupDetailResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str, group_id: str):
        with SessionLocal() as db:
            group = _recipient_service.get_group(db, campaign_id, group_id)
        return serialize_recipient_group(group)

    @require_campaign_capability("campaign.recipients.edit")
    def patch(self, campaign_id: str, group_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _snapshot_group(_recipient_service.get_group(db, campaign_id, group_id))
            group = _recipient_service.update_group(db, campaign_id, group_id, payload)
            response = serialize_recipient_group(group)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="recipient_group",
                entity_id=group.id,
                entity_label=group.group_name,
                summary=f"Updated recipient group {group.group_name}.",
                changes=build_changes(before=before, after=_snapshot_group(group), field_map=GROUP_FIELD_MAP),
            )
        return response

    @require_campaign_capability("campaign.recipients.edit")
    def delete(self, campaign_id: str, group_id: str):
        with SessionLocal() as db:
            before = _snapshot_group(_recipient_service.get_group(db, campaign_id, group_id))
            _recipient_service.delete_group(db, campaign_id, group_id)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="deleted",
                entity_type="recipient_group",
                entity_id=group_id,
                entity_label=str(before.get("group_name") or group_id),
                summary=f"Deleted recipient group {before.get('group_name') or group_id}.",
                metadata={"previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/recipient-groups/<string:group_id>/contacts")
class RecipientGroupContactCreateResource(Resource):
    @require_campaign_capability("campaign.recipients.edit")
    def post(self, campaign_id: str, group_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            contact = _recipient_service.create_contact(db, campaign_id, group_id, payload)
            group = _recipient_service.get_group(db, campaign_id, group_id)
            response = serialize_group_contact(contact)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="group_contact",
                entity_id=contact.id,
                entity_label=_contact_label(contact),
                summary=f"Added contact {_contact_label(contact)} to {group.group_name}.",
                changes=build_changes(before={}, after=_snapshot_contact(contact), field_map=CONTACT_FIELD_MAP),
                metadata={"recipient_group_id": group_id},
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/recipient-groups/<string:group_id>/contacts/<string:contact_id>")
class RecipientGroupContactDetailResource(Resource):
    @require_campaign_capability("campaign.recipients.edit")
    def patch(self, campaign_id: str, group_id: str, contact_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            group = _recipient_service.get_group(db, campaign_id, group_id)
            before_contact = next((contact for contact in group.contacts if str(contact.id) == str(contact_id)), None)
            before = _snapshot_contact(before_contact) if before_contact else {}
            contact = _recipient_service.update_contact(db, campaign_id, group_id, contact_id, payload)
            response = serialize_group_contact(contact)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="group_contact",
                entity_id=contact.id,
                entity_label=_contact_label(contact),
                summary=f"Updated contact {_contact_label(contact)} for {group.group_name}.",
                changes=build_changes(before=before, after=_snapshot_contact(contact), field_map=CONTACT_FIELD_MAP),
                metadata={"recipient_group_id": group_id},
            )
        return response

    @require_campaign_capability("campaign.recipients.edit")
    def delete(self, campaign_id: str, group_id: str, contact_id: str):
        with SessionLocal() as db:
            group = _recipient_service.get_group(db, campaign_id, group_id)
            before_contact = next((contact for contact in group.contacts if str(contact.id) == str(contact_id)), None)
            before = _snapshot_contact(before_contact) if before_contact else {}
            _recipient_service.delete_contact(db, campaign_id, group_id, contact_id)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="deleted",
                entity_type="group_contact",
                entity_id=contact_id,
                entity_label=str(before.get("label") or contact_id),
                summary=f"Deleted contact {before.get('label') or contact_id} from {group.group_name}.",
                metadata={"recipient_group_id": group_id, "previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/recipients")
class RecipientListResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            recipients = _recipient_service.list_recipients(
                db,
                campaign_id,
                search=request.args.get("search"),
                group_id=request.args.get("group_id"),
                program_type=request.args.get("program_type"),
                recipient_kind=request.args.get("recipient_kind"),
                status=request.args.get("status"),
            )
        return [serialize_recipient(recipient) for recipient in recipients]

    @require_campaign_capability("campaign.recipients.edit")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            recipient = _recipient_service.create_recipient(db, campaign_id, payload)
            response = serialize_recipient(recipient)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="recipient",
                entity_id=recipient.id,
                entity_label=recipient.display_label,
                summary=f"Created recipient {recipient.display_label}.",
                changes=build_changes(before={}, after=_snapshot_recipient(recipient), field_map=RECIPIENT_FIELD_MAP),
                metadata={"recipient_group_id": str(recipient.recipient_group_id)},
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/recipients/<string:recipient_id>")
class RecipientDetailResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str, recipient_id: str):
        with SessionLocal() as db:
            recipient = _recipient_service.get_recipient(db, campaign_id, recipient_id)
        return serialize_recipient(recipient)

    @require_campaign_capability("campaign.recipients.edit")
    def patch(self, campaign_id: str, recipient_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _snapshot_recipient(_recipient_service.get_recipient(db, campaign_id, recipient_id))
            recipient = _recipient_service.update_recipient(db, campaign_id, recipient_id, payload)
            response = serialize_recipient(recipient)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="recipient",
                entity_id=recipient.id,
                entity_label=recipient.display_label,
                summary=f"Updated recipient {recipient.display_label}.",
                changes=build_changes(before=before, after=_snapshot_recipient(recipient), field_map=RECIPIENT_FIELD_MAP),
                metadata={"recipient_group_id": str(recipient.recipient_group_id)},
            )
        return response

    @require_campaign_capability("campaign.recipients.edit")
    def delete(self, campaign_id: str, recipient_id: str):
        with SessionLocal() as db:
            before = _snapshot_recipient(_recipient_service.get_recipient(db, campaign_id, recipient_id))
            _recipient_service.delete_recipient(db, campaign_id, recipient_id)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="deleted",
                entity_type="recipient",
                entity_id=recipient_id,
                entity_label=str(before.get("display_label") or recipient_id),
                summary=f"Deleted recipient {before.get('display_label') or recipient_id}.",
                metadata={"previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/recipients/<string:recipient_id>/wishlist")
class RecipientWishlistResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str, recipient_id: str):
        with SessionLocal() as db:
            wishlist = _recipient_service.get_wishlist(db, campaign_id, recipient_id)
        return serialize_wishlist(wishlist)

    @require_campaign_capability("campaign.recipients.edit")
    def put(self, campaign_id: str, recipient_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            recipient = _recipient_service.get_recipient(db, campaign_id, recipient_id)
            before = _snapshot_wishlist(recipient.wishlist) if recipient.wishlist else {}
            wishlist = _recipient_service.upsert_wishlist(db, campaign_id, recipient_id, payload)
            response = serialize_wishlist(wishlist)
            _record_people_event(
                db,
                campaign_id=campaign_id,
                action="updated" if before else "created",
                entity_type="wishlist",
                entity_id=wishlist.id,
                entity_label=wishlist.recipient.display_label if wishlist.recipient else "Wishlist",
                summary=f"Saved wishlist for {wishlist.recipient.display_label if wishlist.recipient else recipient_id}.",
                changes=build_changes(before=before, after=_snapshot_wishlist(wishlist), field_map=WISHLIST_FIELD_MAP),
                metadata={"recipient_id": recipient_id},
            )
        return response


@campaign_ns.route("/<string:campaign_id>/recipients/<string:recipient_id>/wishlist/items")
class RecipientWishlistItemCreateResource(Resource):
    @require_campaign_capability("campaign.recipients.edit")
    def post(self, campaign_id: str, recipient_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            item = _recipient_service.create_wishlist_item(db, campaign_id, recipient_id, payload)
            recipient = _recipient_service.get_recipient(db, campaign_id, recipient_id)
            response = serialize_wishlist_item(item)
            _record_gift_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="wishlist_item",
                entity_id=item.id,
                entity_label=item.description,
                summary=f"Added wishlist gift {item.description} for {recipient.display_label}.",
                changes=build_changes(before={}, after=_snapshot_wishlist_item(item), field_map=WISHLIST_ITEM_FIELD_MAP),
                metadata={"recipient_id": recipient_id},
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/recipients/<string:recipient_id>/wishlist/items/<string:item_id>")
class RecipientWishlistItemDetailResource(Resource):
    @require_campaign_capability("campaign.recipients.edit")
    def patch(self, campaign_id: str, recipient_id: str, item_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            wishlist = _recipient_service.get_wishlist(db, campaign_id, recipient_id)
            before_item = next((item for item in wishlist.items if str(item.id) == str(item_id)), None)
            before = _snapshot_wishlist_item(before_item) if before_item else {}
            item = _recipient_service.update_wishlist_item(db, campaign_id, recipient_id, item_id, payload)
            recipient = _recipient_service.get_recipient(db, campaign_id, recipient_id)
            response = serialize_wishlist_item(item)
            _record_gift_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="wishlist_item",
                entity_id=item.id,
                entity_label=item.description,
                summary=f"Updated wishlist gift {item.description} for {recipient.display_label}.",
                changes=build_changes(before=before, after=_snapshot_wishlist_item(item), field_map=WISHLIST_ITEM_FIELD_MAP),
                metadata={"recipient_id": recipient_id},
            )
        return response

    @require_campaign_capability("campaign.recipients.edit")
    def delete(self, campaign_id: str, recipient_id: str, item_id: str):
        with SessionLocal() as db:
            wishlist = _recipient_service.get_wishlist(db, campaign_id, recipient_id)
            before_item = next((item for item in wishlist.items if str(item.id) == str(item_id)), None)
            before = _snapshot_wishlist_item(before_item) if before_item else {}
            recipient = _recipient_service.get_recipient(db, campaign_id, recipient_id)
            _recipient_service.delete_wishlist_item(db, campaign_id, recipient_id, item_id)
            _record_gift_event(
                db,
                campaign_id=campaign_id,
                action="deleted",
                entity_type="wishlist_item",
                entity_id=item_id,
                entity_label=str(before.get("description") or item_id),
                summary=f"Deleted wishlist gift {before.get('description') or item_id} for {recipient.display_label}.",
                metadata={"recipient_id": recipient_id, "previous": before},
            )
        return "", 204


def _actor_user_id() -> str | None:
    user_id = getattr(g, "user_id", None)
    return str(user_id) if user_id else None


def _record_people_event(
    db,
    *,
    campaign_id: str,
    action: str,
    entity_type: str,
    entity_id: object,
    entity_label: str,
    summary: str,
    changes: list[dict[str, object]] | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    _audit_event_service.record_event(
        db,
        area="people",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        campaign_id=campaign_id,
        actor_user_id=_actor_user_id(),
        summary=summary,
        changes=changes,
        metadata=metadata,
    )
    db.commit()


def _record_gift_event(
    db,
    *,
    campaign_id: str,
    action: str,
    entity_type: str,
    entity_id: object,
    entity_label: str,
    summary: str,
    changes: list[dict[str, object]] | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    _audit_event_service.record_event(
        db,
        area="gifts",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        campaign_id=campaign_id,
        actor_user_id=_actor_user_id(),
        summary=summary,
        changes=changes,
        metadata=metadata,
    )
    db.commit()


def _snapshot_group(group) -> dict[str, object]:
    return {
        "group_type": group.group_type,
        "parent_organization_group_id": str(group.parent_organization_group_id) if group.parent_organization_group_id else None,
        "group_name": group.group_name,
        "organization_type": group.organization_type,
        "program_abbreviation": group.program_abbreviation,
        "intake_source": group.intake_source,
        "external_reference": group.external_reference,
        "notes": group.notes,
        "status": group.status,
        "address_line1": group.address_line1,
        "address_line2": group.address_line2,
        "city": group.city,
        "state": group.state,
        "postal_code": group.postal_code,
    }


def _contact_label(contact) -> str:
    parts = [contact.first_name, contact.last_name]
    label = " ".join(part for part in parts if part).strip()
    return label or contact.email or contact.phone or "Contact"


def _snapshot_contact(contact) -> dict[str, object]:
    return {
        "label": _contact_label(contact),
        "contact_role": contact.contact_role,
        "relationship_label": contact.relationship_label,
        "first_name": contact.first_name,
        "last_name": contact.last_name,
        "email": contact.email,
        "phone": contact.phone,
        "preferred_contact": contact.preferred_contact,
        "is_primary": bool(contact.is_primary),
        "can_pick_up": bool(contact.can_pick_up),
        "is_emergency_contact": bool(contact.is_emergency_contact),
        "notes": contact.notes,
    }


def _snapshot_recipient(recipient) -> dict[str, object]:
    return {
        "recipient_group_id": str(recipient.recipient_group_id) if recipient.recipient_group_id else None,
        "recipient_kind": recipient.recipient_kind,
        "program_type": recipient.program_type,
        "privacy_level": recipient.privacy_level,
        "display_label": recipient.display_label,
        "first_name": recipient.first_name,
        "last_name": recipient.last_name,
        "birth_year": recipient.birth_year,
        "age": recipient.age,
        "age_unit": recipient.age_unit,
        "gender": recipient.gender,
        "address_line1": recipient.address_line1,
        "address_line2": recipient.address_line2,
        "city": recipient.city,
        "state": recipient.state,
        "postal_code": recipient.postal_code,
        "direct_email": recipient.direct_email,
        "direct_phone": recipient.direct_phone,
        "facility_room": recipient.facility_room,
        "subgroup_label": recipient.subgroup_label,
        "mobility_notes": recipient.mobility_notes,
        "notes": recipient.notes,
        "status": recipient.status,
    }


def _snapshot_wishlist(wishlist) -> dict[str, object]:
    return {
        "wishlist_status": wishlist.wishlist_status,
        "intake_method": wishlist.intake_method,
        "submitted_at": wishlist.submitted_at.isoformat() if wishlist.submitted_at else None,
        "intake_completed_by_contact_id": (
            str(wishlist.intake_completed_by_contact_id) if wishlist.intake_completed_by_contact_id else None
        ),
        "notes": wishlist.notes,
    }


def _snapshot_wishlist_item(item) -> dict[str, object]:
    return {
        "category": item.category,
        "item_type": item.item_type,
        "description": item.description,
        "size": item.size,
        "qty_requested": item.qty_requested,
        "priority": item.priority,
        "est_cost_cents": item.est_cost_cents,
        "allow_substitute": bool(item.allow_substitute),
        "do_not_substitute_reason": item.do_not_substitute_reason,
        "recipient_note": item.recipient_note,
        "notes": item.notes,
        "status": item.status,
    }
