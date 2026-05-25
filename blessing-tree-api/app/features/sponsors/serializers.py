from __future__ import annotations

from typing import Any

from app.models.pending_sponsor_registration import PendingSponsorRegistration
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem


def serialize_sponsorship_item(item: SponsorshipItem) -> dict[str, Any]:
    wishlist_item = item.wishlist_item
    wishlist = wishlist_item.wishlist if wishlist_item is not None else None
    recipient = wishlist.recipient if wishlist is not None else None
    return {
        "id": str(item.id),
        "sponsorship_id": str(item.sponsorship_id),
        "wishlist_item_id": str(item.wishlist_item_id),
        "qty_committed": item.qty_committed,
        "committed_at": _serialize_datetime(item.committed_at),
        "notes": item.notes,
        "recipient": (
            {
                "id": str(recipient.id),
                "display_label": recipient.display_label,
                "program_recipient_id": recipient.program_recipient_id,
            }
            if recipient is not None
            else None
        ),
        "gift": (
            {
                "description": wishlist_item.description,
                "category": wishlist_item.category,
                "item_type": wishlist_item.item_type,
                "size": wishlist_item.size,
                "qty_requested": wishlist_item.qty_requested,
                "status": wishlist_item.status,
            }
            if wishlist_item is not None
            else None
        ),
    }


def serialize_sponsor_interaction(interaction: SponsorInteraction) -> dict[str, Any]:
    return {
        "id": str(interaction.id),
        "campaign_id": str(interaction.campaign_id),
        "sponsor_id": str(interaction.sponsor_id),
        "channel": interaction.channel,
        "direction": interaction.direction,
        "subject": interaction.subject,
        "origin_type": interaction.origin_type,
        "outcome": interaction.outcome,
        "notes": interaction.notes,
        "occurred_at": _serialize_datetime(interaction.occurred_at),
        "created_by_user_id": str(interaction.created_by_user_id) if interaction.created_by_user_id else None,
        "follow_up_at": _serialize_datetime(interaction.follow_up_at),
        "related_sponsorship_id": (
            str(interaction.related_sponsorship_id)
            if interaction.related_sponsorship_id
            else None
        ),
        "related_schedule_id": str(interaction.related_schedule_id) if interaction.related_schedule_id else None,
        "related_delivery_attempt_id": interaction.related_delivery_attempt_id,
        "external_message_id": interaction.external_message_id,
    }


def serialize_pending_sponsor_registration(registration: PendingSponsorRegistration) -> dict[str, Any]:
    return {
        "id": str(registration.id),
        "campaign_id": str(registration.campaign_id),
        "matched_sponsor_id": str(registration.matched_sponsor_id) if registration.matched_sponsor_id else None,
        "email": registration.email,
        "first_name": registration.first_name,
        "last_name": registration.last_name,
        "display_name": registration.display_name,
        "organization_name": registration.organization_name,
        "phone": registration.phone,
        "preferred_contact": registration.preferred_contact,
        "address_line1": registration.address_line1,
        "address_line2": registration.address_line2,
        "city": registration.city,
        "state": registration.state,
        "postal_code": registration.postal_code,
        "source": registration.source,
        "selected_wishlist_item_ids": list(registration.selected_wishlist_item_ids_json or []),
        "notes": registration.notes,
        "verification_sent_at": _serialize_datetime(registration.verification_sent_at),
        "verified_at": _serialize_datetime(registration.verified_at),
        "expires_at": _serialize_datetime(registration.expires_at),
        "status": registration.status,
        "submitted_ip": registration.submitted_ip,
        "user_agent": registration.user_agent,
        "created_at": _serialize_datetime(registration.created_at),
        "updated_at": _serialize_datetime(registration.updated_at),
    }


def serialize_workspace_sponsor(sponsorship: Sponsorship) -> dict[str, Any]:
    sponsor = sponsorship.sponsor
    interactions = list(sponsor.interactions or [])
    campaign_interactions = [
        interaction
        for interaction in interactions
        if str(interaction.campaign_id) == str(sponsorship.campaign_id)
    ]
    items = list(sponsorship.items or [])
    return {
        "id": str(sponsor.id),
        "campaign_id": str(sponsorship.campaign_id),
        "sponsorship_id": str(sponsorship.id),
        "display_name": sponsor.display_name,
        "first_name": sponsor.first_name,
        "last_name": sponsor.last_name,
        "organization_name": sponsor.organization_name,
        "email": sponsor.email,
        "phone": sponsor.phone,
        "address_line1": sponsor.address_line1,
        "address_line2": sponsor.address_line2,
        "city": sponsor.city,
        "state": sponsor.state,
        "postal_code": sponsor.postal_code,
        "preferred_contact": sponsor.preferred_contact,
        "source": sponsor.source,
        "source_detail": sponsor.source_detail,
        "notes": sponsor.notes,
        "is_active": bool(sponsor.is_active),
        "self_registered_at": _serialize_datetime(sponsor.self_registered_at),
        "last_contacted_at": _serialize_datetime(sponsor.last_contacted_at),
        "do_not_contact": bool(sponsor.do_not_contact),
        "participation": {
            "status": sponsorship.status,
            "interest_status": sponsorship.interest_status,
            "drop_off_status": sponsorship.drop_off_status,
            "drop_off_due_at": _serialize_datetime(sponsorship.drop_off_due_at),
            "drop_off_completed_at": _serialize_datetime(sponsorship.drop_off_completed_at),
            "self_registered": bool(sponsorship.self_registered),
            "sponsor_code": sponsorship.sponsor_code,
            "notes": sponsorship.notes,
            "created_at": _serialize_datetime(sponsorship.created_at),
            "updated_at": _serialize_datetime(sponsorship.updated_at),
        },
        "sponsored_item_count": len(items),
        "interaction_count": len(campaign_interactions),
        "open_follow_up_count": sum(1 for interaction in campaign_interactions if interaction.follow_up_at is not None),
        "recent_interactions": [
            serialize_sponsor_interaction(interaction)
            for interaction in sorted(campaign_interactions, key=lambda value: value.occurred_at, reverse=True)[:5]
        ],
        "sponsored_items": [serialize_sponsorship_item(item) for item in items],
        "created_at": _serialize_datetime(sponsor.created_at),
        "updated_at": _serialize_datetime(sponsor.updated_at),
    }


def serialize_sponsor_workspace(*, campaign_id: str, counts: dict[str, int], sponsors: list[Sponsorship]) -> dict[str, Any]:
    return {
        "campaign_id": campaign_id,
        "counts": counts,
        "sponsors": [serialize_workspace_sponsor(sponsorship) for sponsorship in sponsors],
        "filters": {
            "statuses": ["ACTIVE", "COMPLETE", "CANCELLED"],
            "interest_statuses": ["NEW", "CONTACTED", "RESPONDED", "COMMITTED", "DECLINED"],
            "drop_off_statuses": ["NOT_STARTED", "SCHEDULED", "RECEIVED", "LATE"],
            "preferred_contacts": ["EMAIL", "PHONE", "TEXT", "NONE"],
        },
    }


def serialize_public_sponsor_config(
    *,
    campaign,
    public_slug: str,
    state: dict[str, Any],
    available_items: list[dict[str, Any]],
    gift_deadline: str | None,
    selection_limit: int,
    whole_item_only: bool,
) -> dict[str, Any]:
    return {
        "campaign": {
            "id": str(campaign.id),
            "name": campaign.name,
            "year": campaign.year,
            "season_theme": campaign.season_theme,
        },
        "public_slug": public_slug,
        "signup_enabled": bool(campaign.public_sponsor_signup_enabled),
        "registration": state,
        "gift_deadline": gift_deadline,
        "selection_limit": selection_limit,
        "whole_item_only": whole_item_only,
        "available_items": available_items,
    }


def serialize_public_sponsor_submission(registration: PendingSponsorRegistration) -> dict[str, Any]:
    return {
        "pending_registration_id": str(registration.id),
        "email": registration.email,
        "status": registration.status,
        "expires_at": _serialize_datetime(registration.expires_at),
        "verification_sent_at": _serialize_datetime(registration.verification_sent_at),
    }


def serialize_public_sponsor_verification_result(
    *,
    campaign,
    registration: PendingSponsorRegistration,
    sponsorship: Sponsorship,
    gift_deadline: str | None,
    selection_limit: int,
    message: str,
) -> dict[str, Any]:
    return {
        "campaign": {
            "id": str(campaign.id),
            "name": campaign.name,
            "year": campaign.year,
            "season_theme": campaign.season_theme,
        },
        "registration": {
            "id": str(registration.id),
            "status": registration.status,
            "verified_at": _serialize_datetime(registration.verified_at),
            "email": registration.email,
        },
        "sponsor": serialize_workspace_sponsor(sponsorship),
        "gift_deadline": gift_deadline,
        "selection_limit": selection_limit,
        "message": message,
    }


def _serialize_datetime(value) -> str | None:
    if value is None:
        return None
    return value.isoformat()
