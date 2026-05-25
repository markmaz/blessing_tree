from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.orm import Session, joinedload

from app.features.campaigns.gift_policy_service import CampaignGiftPolicyService
from app.features.campaigns.service import CampaignService
from app.models.campaign_gift_policy import CampaignGiftPolicy
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

GIFT_WORKFLOW_STATUSES = (
    "OPEN",
    "RESERVED",
    "COMMITTED",
    "RECEIVED",
    "WRAPPED",
    "TAGGED",
    "READY_FOR_DISTRIBUTION",
    "DISTRIBUTED",
    "PICKED_UP",
    "EXCEPTION",
    "CANCELLED",
)


class GiftReportService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.gift_policy = CampaignGiftPolicyService(self.campaigns)

    def get_workflow_report(self, db: Session, *, campaign_id: uuid.UUID) -> dict[str, Any]:
        campaign = self.campaigns.get_campaign(db, str(campaign_id))
        policy = self.gift_policy.get_policy(db, campaign_id)
        recipients = (
            db.query(Recipient)
            .options(
                joinedload(Recipient.recipient_group),
                joinedload(Recipient.wishlist)
                .joinedload(Wishlist.items)
                .joinedload(WishlistItem.sponsorship_item)
                .joinedload(SponsorshipItem.sponsorship)
                .joinedload(Sponsorship.sponsor),
                joinedload(Recipient.wishlist).joinedload(Wishlist.items).joinedload(WishlistItem.fulfillment_rows),
            )
            .filter(Recipient.campaign_id == campaign_id)
            .join(RecipientGroup, RecipientGroup.id == Recipient.recipient_group_id)
            .order_by(RecipientGroup.group_name.asc(), Recipient.display_label.asc())
            .all()
        )
        rows = [_recipient_row(recipient, policy) for recipient in recipients]
        return {
            "campaign": campaign,
            "gift_policy": policy,
            "statuses": list(GIFT_WORKFLOW_STATUSES),
            "recipients": rows,
            "counts": _counts(rows),
        }


def _recipient_row(recipient: Recipient, policy: CampaignGiftPolicy) -> dict[str, Any]:
    wishlist = recipient.wishlist
    gifts = sorted(
        list(wishlist.items or []) if wishlist is not None else [],
        key=lambda item: (item.status, item.priority, item.description.lower()),
    )
    return {
        "recipient": recipient,
        "group": recipient.recipient_group,
        "wishlist": wishlist,
        "gifts": gifts,
        "counts": _gift_counts(gifts),
        "coverage": _coverage_summary(policy, gifts),
    }


def _gift_counts(gifts: list[WishlistItem]) -> dict[str, int]:
    counts = {status: 0 for status in GIFT_WORKFLOW_STATUSES}
    for gift in gifts:
        if gift.status in counts:
            counts[gift.status] += 1
    counts["TOTAL"] = len(gifts)
    return counts


def _counts(rows: list[dict[str, Any]]) -> dict[str, int]:
    status_counts = {status: 0 for status in GIFT_WORKFLOW_STATUSES}
    gift_total = 0
    recipients_with_open = 0
    recipients_complete = 0
    recipients_covered = 0
    recipients_needing_gifts = 0
    for row in rows:
        row_counts = row["counts"]
        coverage = row["coverage"]
        gift_total += row_counts["TOTAL"]
        for status in GIFT_WORKFLOW_STATUSES:
            status_counts[status] += row_counts[status]
        if row_counts["OPEN"] > 0 or row_counts["RESERVED"] > 0 or row_counts["COMMITTED"] > 0 or row_counts["EXCEPTION"] > 0:
            recipients_with_open += 1
        if row_counts["TOTAL"] > 0 and row_counts["TOTAL"] == sum(
            row_counts[status]
            for status in ("READY_FOR_DISTRIBUTION", "DISTRIBUTED", "PICKED_UP")
        ):
            recipients_complete += 1
        if coverage["is_covered"]:
            recipients_covered += 1
        elif coverage["required_count"] > 0:
            recipients_needing_gifts += 1
    return {
        "recipient_count": len(rows),
        "gift_count": gift_total,
        "recipients_with_open_work_count": recipients_with_open,
        "recipients_complete_count": recipients_complete,
        "recipients_covered_count": recipients_covered,
        "recipients_needing_gifts_count": recipients_needing_gifts,
        **{f"{status.lower()}_count": count for status, count in status_counts.items()},
    }


def _coverage_summary(policy: CampaignGiftPolicy, gifts: list[WishlistItem]) -> dict[str, Any]:
    sponsored_count = sum(1 for gift in gifts if gift.sponsorship_item is not None)
    total_count = len(gifts)
    required_count = _required_sponsored_count(policy, total_count)
    return {
        "rule": policy.recipient_coverage_rule,
        "required_count": required_count,
        "sponsored_count": sponsored_count,
        "remaining_count": max(required_count - sponsored_count, 0),
        "is_covered": total_count > 0 and sponsored_count >= required_count,
    }


def _required_sponsored_count(policy: CampaignGiftPolicy, total_count: int) -> int:
    if total_count <= 0:
        return 0
    if policy.recipient_coverage_rule == "ONE_GIFT_SPONSORED":
        return 1
    if policy.recipient_coverage_rule == "MIN_GIFTS_SPONSORED":
        return min(policy.recipient_coverage_required_count, total_count)
    return total_count
