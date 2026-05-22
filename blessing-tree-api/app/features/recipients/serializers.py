from __future__ import annotations

from datetime import datetime
from typing import Any

from app.models.group_contact import GroupContact
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem


def serialize_group_contact(contact: GroupContact) -> dict[str, Any]:
    return {
        "id": str(contact.id),
        "recipient_group_id": str(contact.recipient_group_id),
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
        "created_at": _serialize_datetime(contact.created_at),
        "updated_at": _serialize_datetime(contact.updated_at),
    }


def serialize_wishlist_item(item: WishlistItem) -> dict[str, Any]:
    return {
        "id": str(item.id),
        "wishlist_id": str(item.wishlist_id),
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
        "status": item.status,
        "qty_fulfilled": item.qty_fulfilled,
        "notes": item.notes,
        "created_at": _serialize_datetime(item.created_at),
        "updated_at": _serialize_datetime(item.updated_at),
    }


def serialize_wishlist(wishlist: Wishlist) -> dict[str, Any]:
    return {
        "id": str(wishlist.id),
        "campaign_id": str(wishlist.campaign_id),
        "recipient_id": str(wishlist.recipient_id),
        "wishlist_status": wishlist.wishlist_status,
        "intake_method": wishlist.intake_method,
        "submitted_at": _serialize_datetime(wishlist.submitted_at),
        "intake_completed_by_contact_id": (
            str(wishlist.intake_completed_by_contact_id)
            if wishlist.intake_completed_by_contact_id
            else None
        ),
        "intake_completed_by_contact": (
            serialize_group_contact(wishlist.intake_completed_by_contact)
            if wishlist.intake_completed_by_contact is not None
            else None
        ),
        "notes": wishlist.notes,
        "items": [serialize_wishlist_item(item) for item in list(wishlist.items or [])],
        "created_at": _serialize_datetime(wishlist.created_at),
        "updated_at": _serialize_datetime(wishlist.updated_at),
    }


def serialize_recipient(recipient: Recipient) -> dict[str, Any]:
    return {
        "id": str(recipient.id),
        "campaign_id": str(recipient.campaign_id),
        "recipient_group_id": str(recipient.recipient_group_id),
        "recipient_kind": recipient.recipient_kind,
        "program_type": recipient.program_type,
        "privacy_level": recipient.privacy_level,
        "display_label": recipient.display_label,
        "first_name": recipient.first_name,
        "last_name": recipient.last_name,
        "birth_year": recipient.birth_year,
        "age": recipient.age,
        "gender": recipient.gender,
        "direct_email": recipient.direct_email,
        "direct_phone": recipient.direct_phone,
        "facility_room": recipient.facility_room,
        "subgroup_label": recipient.subgroup_label,
        "mobility_notes": recipient.mobility_notes,
        "notes": recipient.notes,
        "status": recipient.status,
        "group": (
            {
                "id": str(recipient.recipient_group.id),
                "group_name": recipient.recipient_group.group_name,
                "group_type": recipient.recipient_group.group_type,
                "status": recipient.recipient_group.status,
            }
            if recipient.recipient_group is not None
            else None
        ),
        "wishlist": serialize_wishlist(recipient.wishlist) if recipient.wishlist is not None else None,
        "created_at": _serialize_datetime(recipient.created_at),
        "updated_at": _serialize_datetime(recipient.updated_at),
    }


def serialize_recipient_group(group: RecipientGroup) -> dict[str, Any]:
    contacts = list(group.contacts or [])
    recipients = list(group.recipients or [])
    return {
        "id": str(group.id),
        "campaign_id": str(group.campaign_id),
        "group_type": group.group_type,
        "group_name": group.group_name,
        "intake_source": group.intake_source,
        "external_reference": group.external_reference,
        "notes": group.notes,
        "status": group.status,
        "address_line1": group.address_line1,
        "address_line2": group.address_line2,
        "city": group.city,
        "state": group.state,
        "postal_code": group.postal_code,
        "primary_contact": (
            serialize_group_contact(next((contact for contact in contacts if contact.is_primary), contacts[0]))
            if contacts
            else None
        ),
        "contacts": [serialize_group_contact(contact) for contact in contacts],
        "recipient_count": len(recipients),
        "recipients": [serialize_recipient(recipient) for recipient in recipients],
        "created_at": _serialize_datetime(group.created_at),
        "updated_at": _serialize_datetime(group.updated_at),
    }


def serialize_people_workspace(
    *,
    campaign_id: str,
    counts: dict[str, int],
    groups: list[RecipientGroup],
    recipients: list[Recipient],
) -> dict[str, Any]:
    group_rows = [serialize_recipient_group(group) for group in groups]
    recipient_rows = [serialize_recipient(recipient) for recipient in recipients]
    return {
        "campaign_id": campaign_id,
        "counts": counts,
        "groups": group_rows,
        "recipients": recipient_rows,
        "filters": {
            "group_types": sorted({group["group_type"] for group in group_rows}),
            "group_statuses": sorted({group["status"] for group in group_rows}),
            "program_types": sorted({recipient["program_type"] for recipient in recipient_rows}),
            "recipient_kinds": sorted({recipient["recipient_kind"] for recipient in recipient_rows}),
            "recipient_statuses": sorted({recipient["status"] for recipient in recipient_rows}),
        },
    }


def _serialize_datetime(value: datetime | None) -> str | None:
    return value.isoformat() if value else None
