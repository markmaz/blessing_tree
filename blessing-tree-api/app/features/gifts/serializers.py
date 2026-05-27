from __future__ import annotations

from typing import Any

from app.models.donation import Donation
from app.models.donation_line import DonationLine
from app.models.fulfillment import Fulfillment
from app.models.campaign_gift_reminder_rule import CampaignGiftReminderRule
from app.models.campaign_gift_tag_template import CampaignGiftTagTemplate
from app.models.campaign_manual_gift_label import CampaignManualGiftLabel
from app.models.campaign_milestone import CampaignMilestone
from app.models.campaign import Campaign
from app.models.communication_template import CommunicationTemplate
from app.models.label_print_item import LabelPrintItem
from app.models.label_print_job import LabelPrintJob
from app.models.wishlist_item import WishlistItem

WORKFLOW_FULFILLED_STATUSES = {
    "RECEIVED",
    "WRAPPED",
    "TAGGED",
    "READY_FOR_DISTRIBUTION",
    "DISTRIBUTED",
    "PICKED_UP",
}


def serialize_gift_search_response(
    *,
    campaign_id: str,
    parsed_filters: dict[str, object],
    results: list[WishlistItem],
    public: bool,
) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "parsed_filters": parsed_filters,
        "count": len(results),
        "items": [serialize_gift_search_item(item, public=public) for item in results],
    }


def serialize_gift_search_item(item: WishlistItem, *, public: bool) -> dict[str, Any]:
    wishlist = item.wishlist
    recipient = wishlist.recipient if wishlist is not None else None
    sponsorship_item = item.sponsorship_item
    fulfillment_rows = list(item.fulfillment_rows or [])
    qty_fulfilled = max(item.qty_fulfilled or 0, sum(row.quantity_fulfilled for row in fulfillment_rows))
    qty_remaining = max((item.qty_requested or 1) - qty_fulfilled, 0)
    is_available = item.status == "OPEN" and sponsorship_item is None and qty_remaining > 0

    payload: dict[str, Any] = {
        "wishlist_item_id": str(item.id),
        "description": item.description,
        "category": item.category,
        "item_type": item.item_type,
        "size": item.size,
        "qty_requested": item.qty_requested,
        "qty_fulfilled": qty_fulfilled,
        "qty_remaining": qty_remaining,
        "priority": item.priority,
        "estimated_cost_cents": item.est_cost_cents,
        "allow_substitute": bool(item.allow_substitute),
        "status": item.status,
        "is_available": is_available,
        "sponsorship_status": "SPONSORED" if sponsorship_item is not None else "UNSPONSORED",
    }
    if recipient is not None:
        payload["recipient"] = _serialize_public_recipient(recipient) if public else _serialize_staff_recipient(recipient)
    else:
        payload["recipient"] = None
    if not public:
        payload["label_code"] = item.label_code
        payload["recipient_note"] = item.recipient_note
        payload["notes"] = item.notes
    return payload


def serialize_gift_operations_response(
    *,
    campaign_id: str,
    counts: dict[str, int],
    items: list[WishlistItem],
) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "counts": counts,
        "items": [serialize_gift_operations_item(item) for item in items],
    }


def serialize_gift_operations_item(item: WishlistItem) -> dict[str, Any]:
    payload = serialize_gift_search_item(item, public=False)
    sponsorship_item = item.sponsorship_item
    sponsorship = sponsorship_item.sponsorship if sponsorship_item is not None else None
    sponsor = sponsorship.sponsor if sponsorship is not None else None
    payload["received_at"] = _serialize_datetime(item.received_at)
    payload["wrapped_at"] = _serialize_datetime(item.wrapped_at)
    payload["storage_location_id"] = str(item.storage_location_id) if item.storage_location_id else None
    payload["sponsor"] = (
        {
            "id": str(sponsor.id),
            "display_name": sponsor.display_name,
            "email": sponsor.email,
            "phone": sponsor.phone,
            "sponsorship_id": str(sponsorship.id),
            "drop_off_status": sponsorship.drop_off_status,
        }
        if sponsor is not None and sponsorship is not None
        else None
    )
    return payload


def serialize_gift_pool_response(
    *,
    campaign_id: str,
    counts: dict[str, int],
    lines: list[DonationLine],
) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "counts": counts,
        "lines": [serialize_gift_pool_line(line) for line in lines],
    }


def serialize_donation(donation: Donation) -> dict[str, Any]:
    return {
        "id": str(donation.id),
        "campaign_id": str(donation.campaign_id),
        "sponsor_id": str(donation.sponsor_id) if donation.sponsor_id else None,
        "source": donation.source,
        "received_at": _serialize_datetime(donation.received_at),
        "received_by_user_id": str(donation.received_by_user_id) if donation.received_by_user_id else None,
        "notes": donation.notes,
        "lines": [serialize_gift_pool_line(line) for line in list(donation.lines or [])],
    }


def serialize_gift_pool_line(line: DonationLine) -> dict[str, Any]:
    donation = line.donation
    fulfillments = list(line.fulfillments or [])
    quantity_assigned = sum(row.quantity_fulfilled or 0 for row in fulfillments)
    quantity_available = max((line.quantity or 0) - quantity_assigned, 0)
    return {
        "id": str(line.id),
        "donation_id": str(line.donation_id),
        "campaign_id": str(line.campaign_id or donation.campaign_id),
        "line_type": line.line_type,
        "description": line.description,
        "category": line.category,
        "size": line.size,
        "quantity": line.quantity,
        "quantity_available": quantity_available,
        "quantity_assigned": quantity_assigned,
        "estimated_value_cents": line.estimated_value_cents,
        "age_min": line.age_min,
        "age_max": line.age_max,
        "gender_fit": line.gender_fit,
        "gift_condition": line.gift_condition,
        "source_label": line.source_label,
        "storage_location_id": str(line.storage_location_id) if line.storage_location_id else None,
        "status": line.status,
        "inventory_status": line.inventory_status,
        "received_by_user_id": str(line.received_by_user_id) if line.received_by_user_id else None,
        "notes": line.notes,
        "created_at": _serialize_datetime(line.created_at),
        "updated_at": _serialize_datetime(line.updated_at),
        "donation": {
            "id": str(donation.id),
            "source": donation.source,
            "received_at": _serialize_datetime(donation.received_at),
            "notes": donation.notes,
            "sponsor_id": str(donation.sponsor_id) if donation.sponsor_id else None,
        },
        "assignments": [serialize_fulfillment(row) for row in fulfillments],
    }


def serialize_fulfillment(fulfillment: Fulfillment) -> dict[str, Any]:
    return {
        "id": str(fulfillment.id),
        "wishlist_item_id": str(fulfillment.wishlist_item_id),
        "donation_line_id": str(fulfillment.donation_line_id),
        "quantity_fulfilled": fulfillment.quantity_fulfilled,
        "fulfilled_at": _serialize_datetime(fulfillment.fulfilled_at),
        "fulfilled_by_user_id": str(fulfillment.fulfilled_by_user_id) if fulfillment.fulfilled_by_user_id else None,
        "notes": fulfillment.notes,
    }


def serialize_gift_pool_matches(matches: list[dict[str, Any]]) -> dict[str, Any]:
    return {
        "matches": [
            {
                "wishlist_item": serialize_gift_search_item(match["wishlist_item"], public=False),
                "score": int(match["score"]),
                "reasons": match["reasons"],
            }
            for match in matches
        ]
    }


def serialize_gift_reminder_rules_response(
    *,
    campaign_id: str,
    rules: list[CampaignGiftReminderRule],
    template_options: list[CommunicationTemplate],
    milestone_options: list[CampaignMilestone],
) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "rules": [serialize_gift_reminder_rule(rule) for rule in rules],
        "template_options": [serialize_gift_reminder_template_option(template) for template in template_options],
        "milestone_options": [serialize_gift_reminder_milestone_option(milestone) for milestone in milestone_options],
    }


def serialize_gift_reminder_rule(rule: CampaignGiftReminderRule) -> dict[str, Any]:
    return {
        "id": str(rule.id),
        "campaign_id": str(rule.campaign_id),
        "rule_key": rule.rule_key,
        "label": rule.label,
        "is_enabled": bool(rule.is_enabled),
        "audience": rule.audience,
        "milestone_key": rule.milestone_key,
        "offset_days": rule.offset_days,
        "send_time_local": rule.send_time_local,
        "template_id": str(rule.template_id) if rule.template_id else None,
        "channel": rule.channel,
        "suppress_if_all_received": bool(rule.suppress_if_all_received),
        "last_evaluated_at": _serialize_datetime(rule.last_evaluated_at),
        "created_at": _serialize_datetime(rule.created_at),
        "updated_at": _serialize_datetime(rule.updated_at),
    }


def serialize_gift_reminder_template_option(template: CommunicationTemplate) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "name": template.name,
        "template_key": template.template_key,
        "subject_template": template.subject_template,
    }


def serialize_gift_reminder_milestone_option(milestone: CampaignMilestone) -> dict[str, Any]:
    return {
        "milestone_key": milestone.milestone_key,
        "label": milestone.label,
        "occurs_on": milestone.occurs_on.isoformat(),
    }


def serialize_gift_reminder_preview(preview: dict[str, Any]) -> dict[str, Any]:
    return {
        "rule_id": preview["rule_id"],
        "campaign_id": preview["campaign_id"],
        "due_at": _serialize_datetime(preview.get("due_at")),
        "is_due": bool(preview.get("is_due")),
        "recipient_count": int(preview.get("recipient_count") or 0),
        "recipients": [
            {
                "sponsor": {
                    "id": str(recipient.sponsor.id),
                    "display_name": recipient.sponsor.display_name,
                    "email": recipient.sponsor.email,
                    "do_not_contact": bool(recipient.sponsor.do_not_contact),
                },
                "sponsorship_id": str(recipient.sponsorship.id),
                "gift_count": len(recipient.gifts),
                "gifts": [serialize_gift_operations_item(item) for item in recipient.gifts],
            }
            for recipient in preview.get("recipients", [])
        ],
    }


def serialize_gift_tag_template(template: CampaignGiftTagTemplate) -> dict[str, Any]:
    return {
        "id": str(template.id),
        "campaign_id": str(template.campaign_id),
        "template_key": template.template_key,
        "name": template.name,
        "tag_width_in": float(template.tag_width_in),
        "tag_height_in": float(template.tag_height_in),
        "orientation": template.orientation,
        "layout_json": template.layout_json,
        "gift_tag_message": template.gift_tag_message,
        "include_cut_lines_default": bool(template.include_cut_lines_default),
        "is_active": bool(template.is_active),
        "created_by_user_id": str(template.created_by_user_id) if template.created_by_user_id else None,
        "created_at": _serialize_datetime(template.created_at),
        "updated_at": _serialize_datetime(template.updated_at),
    }


def serialize_gift_workflow_report(report: dict[str, Any]) -> dict[str, Any]:
    campaign = report["campaign"]
    policy = report["gift_policy"]
    return {
        "campaign": {
            "id": str(campaign.id),
            "name": campaign.name,
            "year": campaign.year,
        },
        "gift_policy": {
            "recipient_coverage_rule": policy.recipient_coverage_rule,
            "recipient_coverage_required_count": policy.recipient_coverage_required_count,
        },
        "statuses": report["statuses"],
        "counts": report["counts"],
        "recipients": [serialize_gift_workflow_recipient(row) for row in report["recipients"]],
    }


def serialize_gift_workflow_recipient(row: dict[str, Any]) -> dict[str, Any]:
    recipient = row["recipient"]
    group = row["group"]
    wishlist = row["wishlist"]
    return {
        "id": str(recipient.id),
        "display_label": recipient.display_label,
        "program_recipient_id": recipient.program_recipient_id,
        "recipient_kind": recipient.recipient_kind,
        "program_type": recipient.program_type,
        "age": recipient.age,
        "age_unit": recipient.age_unit,
        "gender": recipient.gender,
        "group": {
            "id": str(group.id),
            "name": group.group_name,
            "type": group.group_type,
        } if group is not None else None,
        "wishlist": {
            "id": str(wishlist.id),
            "status": wishlist.wishlist_status,
        } if wishlist is not None else None,
        "counts": row["counts"],
        "coverage": row["coverage"],
        "gifts": [serialize_gift_workflow_item(item) for item in row["gifts"]],
    }


def serialize_gift_workflow_item(item: WishlistItem) -> dict[str, Any]:
    sponsorship_item = item.sponsorship_item
    sponsorship = sponsorship_item.sponsorship if sponsorship_item is not None else None
    sponsor = sponsorship.sponsor if sponsorship is not None else None
    quantity_requested = item.qty_requested or 1
    return {
        "id": str(item.id),
        "description": item.description,
        "category": item.category,
        "item_type": item.item_type,
        "size": item.size,
        "priority": item.priority,
        "status": item.status,
        "quantity_requested": quantity_requested,
        "quantity_fulfilled": _workflow_quantity_fulfilled(item, quantity_requested),
        "label_code": item.label_code,
        "received_at": _serialize_datetime(item.received_at),
        "wrapped_at": _serialize_datetime(item.wrapped_at),
        "picked_up_at": _serialize_datetime(item.picked_up_at),
        "sponsor": {
            "id": str(sponsor.id),
            "display_name": sponsor.display_name,
            "email": sponsor.email,
        } if sponsor is not None else None,
    }


def _workflow_quantity_fulfilled(item: WishlistItem, quantity_requested: int) -> int:
    fulfillment_rows = list(item.fulfillment_rows or [])
    actual_quantity = max(item.qty_fulfilled or 0, sum(row.quantity_fulfilled or 0 for row in fulfillment_rows))
    if item.status in WORKFLOW_FULFILLED_STATUSES:
        return max(actual_quantity, quantity_requested)
    return actual_quantity


def serialize_label_print_job(job: LabelPrintJob) -> dict[str, Any]:
    return {
        "id": str(job.id),
        "campaign_id": str(job.campaign_id),
        "printed_by_user_id": str(job.printed_by_user_id) if job.printed_by_user_id else None,
        "printed_at": _serialize_datetime(job.printed_at),
        "format": job.format,
        "printer_name": job.printer_name,
        "notes": job.notes,
        "items": [serialize_label_print_item(item) for item in list(job.items or [])],
    }


def serialize_label_print_item(print_item: LabelPrintItem) -> dict[str, Any]:
    wishlist_item = print_item.wishlist_item
    return {
        "id": str(print_item.id),
        "label_print_job_id": str(print_item.label_print_job_id),
        "wishlist_item_id": str(print_item.wishlist_item_id) if print_item.wishlist_item_id else None,
        "manual_label_id": str(print_item.manual_label_id) if print_item.manual_label_id else None,
        "copies": print_item.copies,
        "label": print_item.rendered_payload_json,
        "gift": serialize_gift_operations_item(wishlist_item) if wishlist_item is not None else None,
    }


def serialize_scan_lookup(item: WishlistItem) -> dict[str, Any]:
    return {
        "gift": serialize_gift_operations_item(item),
        "scan_path": f"/scan/gifts/{item.label_code}",
        "available_actions": _scan_actions_for_status(item.status),
    }


def serialize_public_scan_lookup(campaign: Campaign, item: WishlistItem) -> dict[str, Any]:
    recipient = item.wishlist.recipient if item.wishlist is not None else None
    group = recipient.recipient_group if recipient is not None else None
    return {
        "campaign": {
            "id": str(campaign.id),
            "name": campaign.name,
            "year": campaign.year,
        },
        "gift": {
            "wishlist_item_id": str(item.id),
            "description": item.description,
            "category": item.category,
            "item_type": item.item_type,
            "size": item.size,
            "status": item.status,
            "label_code": item.label_code,
        },
        "recipient": (
            {
                "id": str(recipient.id),
                "display_label": recipient.display_label,
                "program_recipient_id": recipient.program_recipient_id,
                "recipient_kind": recipient.recipient_kind,
                "program_type": recipient.program_type,
                "group_label": group.group_name if group is not None else None,
            }
            if recipient is not None
            else None
        ),
        "scan_path": f"/public/gifts/scan/{item.label_code}",
        "available_actions": [action for action in _scan_actions_for_status(item.status) if action != "REPRINT"],
    }


def serialize_public_manual_scan_lookup(manual_label: CampaignManualGiftLabel) -> dict[str, Any]:
    campaign = manual_label.campaign
    return {
        "campaign": {
            "id": str(campaign.id),
            "name": campaign.name,
            "year": campaign.year,
        },
        "gift": {
            "wishlist_item_id": None,
            "description": "Unassigned gift tag",
            "category": None,
            "item_type": "MANUAL_TAG",
            "size": None,
            "status": manual_label.status,
            "label_code": manual_label.label_code,
        },
        "recipient": None,
        "manual_label": {
            "id": str(manual_label.id),
            "status": manual_label.status,
        },
        "scan_path": f"/public/gifts/scan/{manual_label.label_code}",
        "available_actions": [],
        "message": "This tag is not attached to a gift yet.",
    }


def _serialize_public_recipient(recipient) -> dict[str, Any]:
    return {
        "id": str(recipient.id),
        "public_label": _public_label(recipient),
        "recipient_kind": recipient.recipient_kind,
        "program_type": recipient.program_type,
        "age": recipient.age,
        "age_unit": recipient.age_unit,
        "gender": recipient.gender,
    }


def _serialize_staff_recipient(recipient) -> dict[str, Any]:
    return {
        "id": str(recipient.id),
        "display_label": recipient.display_label,
        "program_recipient_id": recipient.program_recipient_id,
        "recipient_kind": recipient.recipient_kind,
        "program_type": recipient.program_type,
        "age": recipient.age,
        "age_unit": recipient.age_unit,
        "gender": recipient.gender,
        "group_id": str(recipient.recipient_group_id),
    }


def _public_label(recipient) -> str:
    age = recipient.age
    if age is not None and recipient.recipient_kind == "CHILD":
        return f"Child age {age}"
    if age is not None:
        return f"Recipient age {age}"
    return "Gift recipient"


def _serialize_datetime(value) -> str | None:
    if value is None:
        return None
    return value.isoformat()


def _scan_actions_for_status(status: str) -> list[str]:
    actions: list[str] = []
    if status in {"COMMITTED", "EXCEPTION"}:
        actions.append("RECEIVE")
    if status in {"RECEIVED", "EXCEPTION"}:
        actions.append("WRAP")
    if status in {"WRAPPED", "TAGGED", "EXCEPTION"}:
        actions.append("READY")
    if status in {"READY_FOR_DISTRIBUTION", "WRAPPED", "TAGGED", "EXCEPTION"}:
        actions.append("DISTRIBUTE")
    if status in {"READY_FOR_DISTRIBUTION", "DISTRIBUTED", "EXCEPTION"}:
        actions.append("PICKUP")
    if status not in {"DISTRIBUTED", "PICKED_UP", "CANCELLED"}:
        actions.append("EXCEPTION")
    actions.append("REPRINT")
    return actions
