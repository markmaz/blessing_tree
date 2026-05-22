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
        "display_name": _serialize_contact_name(contact),
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
    sponsorship_item = item.sponsorship_item
    fulfillment_rows = list(item.fulfillment_rows or [])
    pickup_item = item.pickup_item
    label_print_items = list(item.label_print_items or [])
    qty_fulfilled = sum(row.quantity_fulfilled for row in fulfillment_rows)
    qty_committed = sponsorship_item.qty_committed if sponsorship_item is not None else 0

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
        "gift_workflow": {
            "sponsorship_status": "SPONSORED" if sponsorship_item is not None else "UNSPONSORED",
            "sponsorship_id": str(sponsorship_item.sponsorship_id) if sponsorship_item is not None else None,
            "qty_committed": qty_committed,
            "qty_fulfilled": qty_fulfilled,
            "remaining_qty": max(item.qty_requested - qty_fulfilled, 0),
            "is_fully_fulfilled": qty_fulfilled >= item.qty_requested,
            "is_picked_up": pickup_item is not None,
            "picked_up_at": (
                _serialize_datetime(pickup_item.pickup.picked_up_at)
                if pickup_item is not None and pickup_item.pickup is not None
                else _serialize_datetime(item.picked_up_at)
            ),
            "picked_up_by_contact_id": (
                str(pickup_item.pickup.picked_up_by_contact_id)
                if pickup_item is not None and pickup_item.pickup is not None and pickup_item.pickup.picked_up_by_contact_id
                else str(item.picked_up_by_contact_id) if item.picked_up_by_contact_id else None
            ),
            "label_code": item.label_code,
            "label_version": item.label_version,
            "label_last_printed_at": _serialize_datetime(item.label_last_printed_at),
            "label_print_count": sum(max(print_item.copies, 0) for print_item in label_print_items),
        },
        "created_at": _serialize_datetime(item.created_at),
        "updated_at": _serialize_datetime(item.updated_at),
    }


def serialize_workflow_summary(items: list[WishlistItem]) -> dict[str, Any]:
    sponsored_count = 0
    fulfilled_count = 0
    ready_for_pickup_count = 0
    picked_up_count = 0
    open_count = 0

    for item in items:
        sponsorship_item = item.sponsorship_item
        fulfillment_rows = list(item.fulfillment_rows or [])
        pickup_item = item.pickup_item
        qty_fulfilled = sum(row.quantity_fulfilled for row in fulfillment_rows)
        is_fully_fulfilled = qty_fulfilled >= item.qty_requested
        is_picked_up = pickup_item is not None or item.picked_up_at is not None

        if sponsorship_item is not None:
            sponsored_count += 1
        if is_fully_fulfilled:
            fulfilled_count += 1
        if is_fully_fulfilled and not is_picked_up:
            ready_for_pickup_count += 1
        if is_picked_up:
            picked_up_count += 1
        if not is_fully_fulfilled and not is_picked_up:
            open_count += 1

    total_count = len(items)

    return {
        "item_count": total_count,
        "sponsored_item_count": sponsored_count,
        "fulfilled_item_count": fulfilled_count,
        "ready_for_pickup_item_count": ready_for_pickup_count,
        "picked_up_item_count": picked_up_count,
        "open_item_count": open_count,
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
    wishlist_items = list(recipient.wishlist.items or []) if recipient.wishlist is not None else []
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
        "workflow_summary": serialize_workflow_summary(wishlist_items),
        "created_at": _serialize_datetime(recipient.created_at),
        "updated_at": _serialize_datetime(recipient.updated_at),
    }


def serialize_recipient_group(group: RecipientGroup) -> dict[str, Any]:
    contacts = list(group.contacts or [])
    recipients = list(group.recipients or [])
    pickup_contacts = [contact for contact in contacts if contact.can_pick_up]
    workflow_items = [
        item
        for recipient in recipients
        if recipient.wishlist is not None
        for item in list(recipient.wishlist.items or [])
    ]
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
        "authorized_pickup_contacts": [serialize_group_contact(contact) for contact in pickup_contacts],
        "recipient_count": len(recipients),
        "workflow_summary": serialize_workflow_summary(workflow_items),
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


def _serialize_contact_name(contact: GroupContact) -> str:
    name = " ".join(part for part in [contact.first_name, contact.last_name] if part)
    return name or contact.relationship_label or contact.email or contact.phone or "Unnamed contact"
