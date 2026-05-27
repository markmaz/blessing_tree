from __future__ import annotations

import uuid
from typing import Any, Callable

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.features.campaigns.studio_service import CampaignStudioService
from app.features.gifts.report_service import GiftReportService
from app.models.donation_line import DonationLine
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.sponsor import Sponsor
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

DEFAULT_LIMIT = 100


class AskReportExecutor:
    def __init__(
        self,
        *,
        gift_report_service: GiftReportService | None = None,
        studio_service: CampaignStudioService | None = None,
    ) -> None:
        self.gift_reports = gift_report_service or GiftReportService()
        self.studio = studio_service or CampaignStudioService()

    def execute(
        self,
        db: Session,
        *,
        metric_key: str,
        campaign_id: uuid.UUID,
        filters: dict[str, Any] | None = None,
        intent: str = "list",
        limit: int = DEFAULT_LIMIT,
    ) -> dict[str, Any]:
        executor = self._executor_map().get(metric_key)
        if executor is None:
            return _empty_report(metric_key, "Unsupported report", "I do not know how to run that report yet.")
        return executor(db, campaign_id=campaign_id, filters=filters or {}, intent=intent, limit=_bounded_limit(limit))

    def execute_recipients_needing_sponsors(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        rows = self._recipient_coverage_rows(db, campaign_id=campaign_id, filters=filters)
        rows = [row for row in rows if not row["coverage"]["is_covered"] and row["coverage"]["required_count"] > 0]
        return _recipient_report(
            metric_key="recipients_needing_sponsors",
            label="Recipients needing sponsors",
            rows=rows,
            limit=limit,
        )

    def execute_recipients_needing_gifts(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        rows = self._recipient_coverage_rows(db, campaign_id=campaign_id, filters=filters)
        rows = [row for row in rows if not row["coverage"]["is_covered"] and row["coverage"]["required_count"] > 0]
        return _recipient_report(
            metric_key="recipients_needing_gifts",
            label="Recipients needing gifts",
            rows=rows,
            limit=limit,
        )

    def execute_committed_gifts_not_received(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        return self._gift_status_report(
            db,
            campaign_id=campaign_id,
            filters={**filters, "status": "COMMITTED"},
            metric_key="committed_gifts_not_received",
            label="Committed gifts not received",
            limit=limit,
        )

    def execute_ready_gifts_not_distributed(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        return self._gift_status_report(
            db,
            campaign_id=campaign_id,
            filters={**filters, "status": "READY_FOR_DISTRIBUTION"},
            metric_key="ready_gifts_not_distributed",
            label="Ready gifts not distributed",
            limit=limit,
        )

    def execute_open_wishlist_items(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        return self._gift_status_report(
            db,
            campaign_id=campaign_id,
            filters={**filters, "status": "OPEN"},
            metric_key="open_wishlist_items",
            label="Open wishlist items",
            limit=limit,
        )

    def execute_received_gifts_not_wrapped(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        return self._gift_status_report(
            db,
            campaign_id=campaign_id,
            filters={**filters, "status": "RECEIVED"},
            metric_key="received_gifts_not_wrapped",
            label="Received gifts not wrapped",
            limit=limit,
        )

    def execute_sponsors_without_commitments(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        sponsorships = (
            db.query(Sponsorship)
            .options(joinedload(Sponsorship.sponsor), joinedload(Sponsorship.items))
            .join(Sponsor, Sponsor.id == Sponsorship.sponsor_id)
            .filter(Sponsorship.campaign_id == campaign_id, Sponsor.is_active == 1, Sponsorship.status != "CANCELLED")
            .order_by(Sponsor.display_name.asc())
            .all()
        )
        rows = [
            {
                "sponsor_id": str(sponsorship.sponsor.id),
                "sponsor_name": sponsorship.sponsor.display_name,
                "email": sponsorship.sponsor.email,
                "phone": sponsorship.sponsor.phone,
                "status": sponsorship.status,
            }
            for sponsorship in sponsorships
            if len(sponsorship.items or []) == 0
        ]
        return _simple_table_report(
            metric_key="sponsors_without_commitments",
            label="Sponsors without commitments",
            columns=[
                {"key": "sponsor_name", "label": "Sponsor"},
                {"key": "email", "label": "Email"},
                {"key": "phone", "label": "Phone"},
                {"key": "status", "label": "Status"},
            ],
            rows=rows,
            limit=limit,
        )

    def execute_sponsors_needing_follow_up(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        interactions = (
            db.query(SponsorInteraction)
            .options(joinedload(SponsorInteraction.sponsor))
            .filter(SponsorInteraction.campaign_id == campaign_id, SponsorInteraction.follow_up_at.isnot(None))
            .order_by(SponsorInteraction.follow_up_at.asc())
            .all()
        )
        rows = [
            {
                "sponsor_id": str(interaction.sponsor.id),
                "sponsor_name": interaction.sponsor.display_name,
                "email": interaction.sponsor.email,
                "phone": interaction.sponsor.phone,
                "follow_up_at": interaction.follow_up_at.isoformat() if interaction.follow_up_at else None,
                "subject": interaction.subject,
                "outcome": interaction.outcome,
            }
            for interaction in interactions
            if interaction.sponsor is not None and interaction.sponsor.is_active
        ]
        return _simple_table_report(
            metric_key="sponsors_needing_follow_up",
            label="Sponsors needing follow-up",
            columns=[
                {"key": "sponsor_name", "label": "Sponsor"},
                {"key": "email", "label": "Email"},
                {"key": "phone", "label": "Phone"},
                {"key": "follow_up_at", "label": "Follow-Up"},
                {"key": "subject", "label": "Subject"},
            ],
            rows=rows,
            limit=limit,
        )

    def execute_unmatched_donated_inventory(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        query = (
            db.query(DonationLine)
            .filter(
                DonationLine.campaign_id == campaign_id,
                DonationLine.quantity_available > 0,
                DonationLine.inventory_status.in_(["AVAILABLE", "PARTIALLY_ASSIGNED"]),
            )
            .order_by(DonationLine.created_at.desc())
        )
        category = str(filters.get("category") or "").strip()
        if category:
            query = query.filter(
                func.lower(DonationLine.description).like(f"%{category.lower()}%")
                | func.lower(DonationLine.category).like(f"%{category.lower()}%")
            )
        lines = query.all()
        rows = [
            {
                "line_id": str(line.id),
                "description": line.description,
                "category": line.category,
                "quantity_available": line.quantity_available,
                "status": line.inventory_status,
            }
            for line in lines
        ]
        return _simple_table_report(
            metric_key="unmatched_donated_inventory",
            label="Unmatched donated inventory",
            columns=[
                {"key": "description", "label": "Donation"},
                {"key": "category", "label": "Category"},
                {"key": "quantity_available", "label": "Available"},
                {"key": "status", "label": "Status"},
            ],
            rows=rows,
            limit=limit,
        )

    def execute_readiness_blockers(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        readiness = self.studio.get_readiness(db, str(campaign_id))
        items = [
            item
            for item in readiness.get("items", [])
            if str(item.get("severity")) == "error"
        ]
        rows = [
            {
                "code": item.get("code"),
                "title": item.get("title"),
                "message": item.get("message"),
                "section": item.get("section"),
                "action_label": item.get("action_label"),
            }
            for item in items
        ]
        return _simple_table_report(
            metric_key="readiness_blockers",
            label="Readiness blockers",
            columns=[
                {"key": "title", "label": "Blocker"},
                {"key": "message", "label": "Details"},
                {"key": "section", "label": "Area"},
                {"key": "action_label", "label": "Action"},
            ],
            rows=rows,
            limit=limit,
        )

    def _recipient_coverage_rows(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
    ) -> list[dict[str, Any]]:
        report = self.gift_reports.get_workflow_report(db, campaign_id=campaign_id)
        rows: list[dict[str, Any]] = []
        for row in report["recipients"]:
            recipient = row["recipient"]
            if not _recipient_matches_filters(recipient, filters):
                continue
            group = row.get("group")
            rows.append(
                {
                    "recipient_id": str(recipient.id),
                    "recipient_name": recipient.display_label,
                    "age": recipient.age,
                    "gender": _gender_label(recipient.gender),
                    "group_name": group.group_name if group is not None else None,
                    "wishlist_count": row["counts"]["TOTAL"],
                    "sponsored_count": row["coverage"]["sponsored_count"],
                    "remaining_count": row["coverage"]["remaining_count"],
                    "coverage": row["coverage"],
                }
            )
        return rows

    def _gift_status_report(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        metric_key: str,
        label: str,
        limit: int,
    ) -> dict[str, Any]:
        query = (
            db.query(WishlistItem)
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .join(Recipient, Recipient.id == Wishlist.recipient_id)
            .join(RecipientGroup, RecipientGroup.id == Recipient.recipient_group_id)
            .options(
                joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient).joinedload(Recipient.recipient_group),
                joinedload(WishlistItem.sponsorship_item)
                .joinedload(SponsorshipItem.sponsorship)
                .joinedload(Sponsorship.sponsor),
            )
            .filter(Recipient.campaign_id == campaign_id)
            .order_by(RecipientGroup.group_name.asc(), Recipient.display_label.asc(), WishlistItem.description.asc())
        )
        status = str(filters.get("status") or "").strip()
        if status:
            query = query.filter(WishlistItem.status == status)
        category = str(filters.get("category") or "").strip()
        if category:
            query = query.filter(
                func.lower(WishlistItem.description).like(f"%{category.lower()}%")
                | func.lower(WishlistItem.category).like(f"%{category.lower()}%")
            )
        items = [item for item in query.all() if _recipient_matches_filters(item.wishlist.recipient, filters)]
        rows = [_gift_row(item) for item in items]
        return _simple_table_report(
            metric_key=metric_key,
            label=label,
            columns=[
                {"key": "recipient_name", "label": "Recipient"},
                {"key": "group_name", "label": "Group"},
                {"key": "gift", "label": "Gift"},
                {"key": "status", "label": "Status"},
                {"key": "sponsor_name", "label": "Sponsor"},
            ],
            rows=rows,
            limit=limit,
        )

    def _executor_map(self) -> dict[str, Callable[..., dict[str, Any]]]:
        return {
            "recipients_needing_sponsors": self.execute_recipients_needing_sponsors,
            "recipients_needing_gifts": self.execute_recipients_needing_gifts,
            "committed_gifts_not_received": self.execute_committed_gifts_not_received,
            "ready_gifts_not_distributed": self.execute_ready_gifts_not_distributed,
            "open_wishlist_items": self.execute_open_wishlist_items,
            "received_gifts_not_wrapped": self.execute_received_gifts_not_wrapped,
            "sponsors_without_commitments": self.execute_sponsors_without_commitments,
            "sponsors_needing_follow_up": self.execute_sponsors_needing_follow_up,
            "unmatched_donated_inventory": self.execute_unmatched_donated_inventory,
            "readiness_blockers": self.execute_readiness_blockers,
        }


def _recipient_report(*, metric_key: str, label: str, rows: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    return _simple_table_report(
        metric_key=metric_key,
        label=label,
        columns=[
            {"key": "recipient_name", "label": "Recipient"},
            {"key": "group_name", "label": "Group"},
            {"key": "age", "label": "Age"},
            {"key": "gender", "label": "Gender"},
            {"key": "wishlist_count", "label": "Wishlist Items"},
            {"key": "remaining_count", "label": "Still Needed"},
        ],
        rows=[{key: value for key, value in row.items() if key != "coverage"} for row in rows],
        limit=limit,
    )


def _simple_table_report(
    *,
    metric_key: str,
    label: str,
    columns: list[dict[str, str]],
    rows: list[dict[str, Any]],
    limit: int,
) -> dict[str, Any]:
    total = len(rows)
    limited_rows = rows[:limit]
    return {
        "metric_key": metric_key,
        "summary": {"label": label, "value": total},
        "columns": columns,
        "rows": limited_rows,
        "totals": {"row_count": total, "limited": total > len(limited_rows)},
    }


def _empty_report(metric_key: str, label: str, message: str) -> dict[str, Any]:
    return {
        "metric_key": metric_key,
        "summary": {"label": label, "value": 0},
        "columns": [],
        "rows": [],
        "totals": {"row_count": 0, "limited": False},
        "message": message,
    }


def _gift_row(item: WishlistItem) -> dict[str, Any]:
    recipient = item.wishlist.recipient
    group = recipient.recipient_group
    sponsor = None
    if item.sponsorship_item and item.sponsorship_item.sponsorship:
        sponsor = item.sponsorship_item.sponsorship.sponsor
    return {
        "wishlist_item_id": str(item.id),
        "recipient_id": str(recipient.id),
        "recipient_name": recipient.display_label,
        "group_name": group.group_name if group is not None else None,
        "gift": item.description,
        "category": item.category,
        "status": item.status,
        "sponsor_name": sponsor.display_name if sponsor is not None else None,
    }


def _recipient_matches_filters(recipient: Recipient, filters: dict[str, Any]) -> bool:
    age_min = _to_int(filters.get("age_min"))
    age_max = _to_int(filters.get("age_max"))
    if age_min is not None and (recipient.age is None or recipient.age < age_min):
        return False
    if age_max is not None and (recipient.age is None or recipient.age > age_max):
        return False
    gender = str(filters.get("gender") or "").strip()
    if gender and recipient.gender != gender:
        return False
    return True


def _gender_label(value: str | None) -> str | None:
    return {"F": "Female", "M": "Male", "X": "Nonbinary", "U": "Unknown"}.get(value or "", value)


def _to_int(value: object) -> int | None:
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _bounded_limit(value: int) -> int:
    return min(max(value, 1), 500)
