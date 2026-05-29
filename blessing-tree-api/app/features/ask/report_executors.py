from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any, Callable

from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from app.features.campaigns.calendar_intelligence_service import CampaignCalendarIntelligenceService
from app.features.campaigns.service import CampaignService
from app.features.campaigns.studio_service import CampaignStudioService
from app.features.gifts.report_service import GiftReportService
from app.models.donation_line import DonationLine
from app.models.pending_sponsor_registration import PendingSponsorRegistration
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.sponsor import Sponsor
from app.models.sponsor_constants import PENDING_SPONSOR_REGISTRATION_STATUS_PENDING
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
        campaign_service: CampaignService | None = None,
        gift_report_service: GiftReportService | None = None,
        studio_service: CampaignStudioService | None = None,
        calendar_intelligence_service: CampaignCalendarIntelligenceService | None = None,
    ) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.gift_reports = gift_report_service or GiftReportService()
        self.studio = studio_service or CampaignStudioService()
        self.calendar_intelligence = calendar_intelligence_service or CampaignCalendarIntelligenceService(campaign_service=self.campaigns)

    def execute(
        self,
        db: Session,
        *,
        metric_key: str,
        campaign_id: uuid.UUID,
        filters: dict[str, Any] | None = None,
        intent: str = "list",
        limit: int = DEFAULT_LIMIT,
        user_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        executor = self._executor_map().get(metric_key)
        if executor is None:
            return _empty_report(metric_key, "Unsupported report", "I do not know how to run that report yet.")
        if metric_key == "continue_where_left_off":
            return executor(
                db,
                campaign_id=campaign_id,
                filters=filters or {},
                intent=intent,
                limit=_bounded_limit(limit),
                user_id=user_id,
            )
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

    def execute_calendar_attention(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        rows = _calendar_rows_for_metric(intelligence, "calendar_attention")
        return _calendar_report(metric_key="calendar_attention", label="Calendar items needing attention", rows=rows, limit=limit)

    def execute_calendar_overdue(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_report(
            metric_key="calendar_overdue",
            label="Overdue calendar items",
            rows=_calendar_rows_for_metric(intelligence, "calendar_overdue"),
            limit=limit,
        )

    def execute_calendar_upcoming(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_report(
            metric_key="calendar_upcoming",
            label="Upcoming calendar items",
            rows=_calendar_rows_for_metric(intelligence, "calendar_upcoming"),
            limit=limit,
        )

    def execute_calendar_missing_dates(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_report(
            metric_key="calendar_missing_dates",
            label="Missing important dates",
            rows=_calendar_rows_for_metric(intelligence, "calendar_missing_dates"),
            limit=limit,
        )

    def execute_calendar_scheduled_communications(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_report(
            metric_key="calendar_scheduled_communications",
            label="Scheduled communications",
            rows=_calendar_rows_for_metric(intelligence, "calendar_scheduled_communications"),
            limit=limit,
        )

    def execute_calendar_sponsor_recruitment_dates(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_critical_date_report(
            metric_key="calendar_sponsor_recruitment_dates",
            label="Sponsor recruitment dates",
            intelligence=intelligence,
            keys={"sponsor_registration_start", "sponsor_registration_end", "sponsor_outreach_start"},
            limit=limit,
        )

    def execute_calendar_gift_turn_in_date(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_critical_date_report(
            metric_key="calendar_gift_turn_in_date",
            label="Gift turn-in date",
            intelligence=intelligence,
            keys={"gift_turn_in_due"},
            limit=limit,
        )

    def execute_calendar_pickup_dates(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_critical_date_report(
            metric_key="calendar_pickup_dates",
            label="Pickup dates",
            intelligence=intelligence,
            keys={"pickup_start", "pickup_end"},
            limit=limit,
        )

    def execute_calendar_followups_due(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_report(
            metric_key="calendar_followups_due",
            label="Sponsor follow-ups due",
            rows=_calendar_rows_for_metric(intelligence, "calendar_followups_due"),
            limit=limit,
        )

    def execute_calendar_outside_campaign_window(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        intelligence = self.calendar_intelligence.get_calendar_intelligence(db, str(campaign_id))
        return _calendar_warning_report(
            metric_key="calendar_outside_campaign_window",
            label="Dates outside campaign window",
            warnings=[
                warning
                for warning in intelligence.get("warnings", [])
                if str(warning.get("code") or "").startswith("date_outside_campaign_window_")
            ],
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

    def execute_recipients_not_fulfilled(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        report = self.gift_reports.get_workflow_report(db, campaign_id=campaign_id)
        rows: list[dict[str, Any]] = []
        for row in report["recipients"]:
            recipient = row["recipient"]
            if not _recipient_matches_filters(recipient, filters):
                continue
            counts = row["counts"]
            total_count = counts["TOTAL"]
            fulfilled_count = sum(counts[status] for status in ("READY_FOR_DISTRIBUTION", "DISTRIBUTED", "PICKED_UP"))
            if total_count <= 0 or fulfilled_count >= total_count:
                continue
            group = row.get("group")
            rows.append(
                {
                    "recipient_id": str(recipient.id),
                    "recipient_name": recipient.display_label,
                    "group_name": group.group_name if group is not None else None,
                    "age": recipient.age,
                    "gender": _gender_label(recipient.gender),
                    "wishlist_count": total_count,
                    "fulfilled_count": fulfilled_count,
                    "remaining_count": total_count - fulfilled_count,
                }
            )
        return _simple_table_report(
            metric_key="recipients_not_fulfilled",
            label="Recipients not fulfilled",
            columns=[
                {"key": "recipient_name", "label": "Recipient"},
                {"key": "group_name", "label": "Group"},
                {"key": "age", "label": "Age"},
                {"key": "gender", "label": "Gender"},
                {"key": "wishlist_count", "label": "Wishlist Items"},
                {"key": "fulfilled_count", "label": "Ready/Done"},
                {"key": "remaining_count", "label": "Remaining"},
            ],
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

    def execute_overdue_sponsor_gifts(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        rows = self._sponsor_unreceived_gift_rows(
            db,
            campaign_id=campaign_id,
            filters=filters,
            overdue_only=True,
        )
        return _simple_table_report(
            metric_key="overdue_sponsor_gifts",
            label="Overdue sponsor gifts",
            columns=_sponsor_unreceived_columns(),
            rows=rows,
            limit=limit,
        )

    def execute_sponsors_with_unreceived_gifts(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        rows = self._sponsor_unreceived_gift_rows(
            db,
            campaign_id=campaign_id,
            filters=filters,
            overdue_only=False,
        )
        return _simple_table_report(
            metric_key="sponsors_with_unreceived_gifts",
            label="Sponsors with unreceived gifts",
            columns=_sponsor_unreceived_columns(),
            rows=rows,
            limit=limit,
        )

    def execute_exception_gifts(
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
            filters={**filters, "status": "EXCEPTION"},
            metric_key="exception_gifts",
            label="Gift exceptions",
            limit=limit,
        )

    def execute_pending_public_sponsor_registrations(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        registrations = (
            db.query(PendingSponsorRegistration)
            .filter(
                PendingSponsorRegistration.campaign_id == campaign_id,
                PendingSponsorRegistration.status == PENDING_SPONSOR_REGISTRATION_STATUS_PENDING,
            )
            .order_by(PendingSponsorRegistration.created_at.asc())
            .all()
        )
        rows = [
            {
                "registration_id": str(registration.id),
                "sponsor_name": registration.display_name or " ".join(
                    value for value in (registration.first_name, registration.last_name) if value
                ) or registration.email,
                "email": registration.email,
                "phone": registration.phone,
                "created_at": registration.created_at.isoformat() if registration.created_at else None,
                "expires_at": registration.expires_at.isoformat() if registration.expires_at else None,
                "selected_gift_count": len(registration.selected_wishlist_item_ids_json or []),
            }
            for registration in registrations
        ]
        return _simple_table_report(
            metric_key="pending_public_sponsor_registrations",
            label="Pending public sponsor registrations",
            columns=[
                {"key": "sponsor_name", "label": "Sponsor"},
                {"key": "email", "label": "Email"},
                {"key": "phone", "label": "Phone"},
                {"key": "selected_gift_count", "label": "Selected Gifts"},
                {"key": "created_at", "label": "Submitted"},
                {"key": "expires_at", "label": "Expires"},
            ],
            rows=rows,
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

    def execute_popular_gifts_by_gender(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        rows = self.campaigns.get_popular_gifts_by_gender(db, str(campaign_id))
        return _simple_table_report(
            metric_key="popular_gifts_by_gender",
            label="Popular gifts by gender",
            columns=[
                {"key": "gender", "label": "Gender"},
                {"key": "gift", "label": "Gift"},
                {"key": "quantity", "label": "Requested"},
                {"key": "request_count", "label": "Rows"},
            ],
            rows=rows,
            limit=limit,
        )

    def execute_recipients_sponsored_by_sponsor(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        rows = self.campaigns.get_sponsor_recipient_counts(db, str(campaign_id), limit=limit)
        return _simple_table_report(
            metric_key="recipients_sponsored_by_sponsor",
            label="Recipients sponsored by sponsor",
            columns=[
                {"key": "sponsor_name", "label": "Sponsor"},
                {"key": "email", "label": "Email"},
                {"key": "recipient_count", "label": "Recipients"},
                {"key": "gift_count", "label": "Gifts"},
            ],
            rows=rows,
            limit=limit,
        )

    def execute_unsponsored_gifts(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        summary = self.campaigns.get_unsponsored_gift_summary(db, str(campaign_id), limit=limit)
        rows = list(summary.get("items") or [])
        total = int(summary.get("count") or 0)
        return {
            "metric_key": "unsponsored_gifts",
            "summary": {"label": "Unsponsored gifts", "value": total},
            "columns": [
                {"key": "recipient_name", "label": "Recipient"},
                {"key": "group_name", "label": "Group"},
                {"key": "gift", "label": "Gift"},
                {"key": "category", "label": "Category"},
            ],
            "rows": rows,
            "totals": {"row_count": total, "limited": total > len(rows)},
        }

    def execute_recipient_population_summary(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        population = self.campaigns.get_population_summary(db, str(campaign_id))
        total = int(population["children"]) + int(population["adults"])
        return {
            "metric_key": "recipient_population_summary",
            "summary": {"label": "Children and adults", "value": total},
            "columns": [
                {"key": "recipient_type", "label": "Recipient Type"},
                {"key": "count", "label": "Count"},
            ],
            "rows": [
                {"recipient_type": "Children", "count": population["children"]},
                {"recipient_type": "Adults", "count": population["adults"]},
                {"recipient_type": "Total", "count": total},
            ],
            "totals": {"row_count": 3, "limited": False},
        }

    def execute_gift_count_summary(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
    ) -> dict[str, Any]:
        total = self.campaigns.get_gift_count(db, str(campaign_id))
        return {
            "metric_key": "gift_count_summary",
            "summary": {"label": "Gifts", "value": total},
            "columns": [{"key": "metric", "label": "Metric"}, {"key": "count", "label": "Count"}],
            "rows": [{"metric": "Gifts", "count": total}],
            "totals": {"row_count": 1, "limited": False},
        }

    def execute_continue_where_left_off(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        intent: str,
        limit: int,
        user_id: uuid.UUID | None,
    ) -> dict[str, Any]:
        rows = self.campaigns.get_user_continue_items(db, str(campaign_id), user_id=str(user_id) if user_id else None, limit=limit)
        return _simple_table_report(
            metric_key="continue_where_left_off",
            label="Recent Ask activity",
            columns=[
                {"key": "prompt", "label": "Prompt"},
                {"key": "title", "label": "Result"},
                {"key": "result_kind", "label": "Type"},
                {"key": "created_at", "label": "Asked"},
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

    def _sponsor_unreceived_gift_rows(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        filters: dict[str, Any],
        overdue_only: bool,
    ) -> list[dict[str, Any]]:
        query = (
            db.query(Sponsorship)
            .options(
                joinedload(Sponsorship.sponsor),
                joinedload(Sponsorship.items)
                .joinedload(SponsorshipItem.wishlist_item)
                .joinedload(WishlistItem.wishlist)
                .joinedload(Wishlist.recipient)
                .joinedload(Recipient.recipient_group),
            )
            .join(Sponsor, Sponsor.id == Sponsorship.sponsor_id)
            .filter(
                Sponsorship.campaign_id == campaign_id,
                Sponsorship.status != "CANCELLED",
                Sponsor.is_active == 1,
            )
            .order_by(Sponsorship.drop_off_due_at.asc(), Sponsor.display_name.asc())
        )
        if overdue_only:
            query = query.filter(
                Sponsorship.drop_off_due_at.isnot(None),
                Sponsorship.drop_off_due_at < datetime.utcnow(),
                Sponsorship.drop_off_status != "RECEIVED",
            )
        rows: list[dict[str, Any]] = []
        for sponsorship in query.all():
            unreceived_items = [
                item.wishlist_item
                for item in list(sponsorship.items or [])
                if item.wishlist_item is not None
                and item.wishlist_item.status in {"COMMITTED", "EXCEPTION"}
                and _recipient_matches_filters(item.wishlist_item.wishlist.recipient, filters)
            ]
            if not unreceived_items:
                continue
            rows.append(
                {
                    "sponsorship_id": str(sponsorship.id),
                    "sponsor_id": str(sponsorship.sponsor.id),
                    "sponsor_name": sponsorship.sponsor.display_name,
                    "email": sponsorship.sponsor.email,
                    "phone": sponsorship.sponsor.phone,
                    "drop_off_due_at": sponsorship.drop_off_due_at.isoformat() if sponsorship.drop_off_due_at else None,
                    "drop_off_status": sponsorship.drop_off_status,
                    "unreceived_gift_count": len(unreceived_items),
                    "gifts": ", ".join(item.description for item in unreceived_items[:5]),
                }
            )
        return rows

    def _executor_map(self) -> dict[str, Callable[..., dict[str, Any]]]:
        return {
            "recipients_needing_sponsors": self.execute_recipients_needing_sponsors,
            "recipients_needing_gifts": self.execute_recipients_needing_gifts,
            "committed_gifts_not_received": self.execute_committed_gifts_not_received,
            "ready_gifts_not_distributed": self.execute_ready_gifts_not_distributed,
            "recipients_not_fulfilled": self.execute_recipients_not_fulfilled,
            "overdue_sponsor_gifts": self.execute_overdue_sponsor_gifts,
            "sponsors_with_unreceived_gifts": self.execute_sponsors_with_unreceived_gifts,
            "exception_gifts": self.execute_exception_gifts,
            "pending_public_sponsor_registrations": self.execute_pending_public_sponsor_registrations,
            "popular_gifts_by_gender": self.execute_popular_gifts_by_gender,
            "recipients_sponsored_by_sponsor": self.execute_recipients_sponsored_by_sponsor,
            "unsponsored_gifts": self.execute_unsponsored_gifts,
            "recipient_population_summary": self.execute_recipient_population_summary,
            "gift_count_summary": self.execute_gift_count_summary,
            "continue_where_left_off": self.execute_continue_where_left_off,
            "open_wishlist_items": self.execute_open_wishlist_items,
            "received_gifts_not_wrapped": self.execute_received_gifts_not_wrapped,
            "sponsors_without_commitments": self.execute_sponsors_without_commitments,
            "sponsors_needing_follow_up": self.execute_sponsors_needing_follow_up,
            "unmatched_donated_inventory": self.execute_unmatched_donated_inventory,
            "readiness_blockers": self.execute_readiness_blockers,
            "calendar_overdue": self.execute_calendar_overdue,
            "calendar_upcoming": self.execute_calendar_upcoming,
            "calendar_missing_dates": self.execute_calendar_missing_dates,
            "calendar_scheduled_communications": self.execute_calendar_scheduled_communications,
            "calendar_sponsor_recruitment_dates": self.execute_calendar_sponsor_recruitment_dates,
            "calendar_gift_turn_in_date": self.execute_calendar_gift_turn_in_date,
            "calendar_pickup_dates": self.execute_calendar_pickup_dates,
            "calendar_followups_due": self.execute_calendar_followups_due,
            "calendar_outside_campaign_window": self.execute_calendar_outside_campaign_window,
            "calendar_attention": self.execute_calendar_attention,
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


def _calendar_report(*, metric_key: str, label: str, rows: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    return _simple_table_report(
        metric_key=metric_key,
        label=label,
        columns=[
            {"key": "date", "label": "Date"},
            {"key": "title", "label": "Item"},
            {"key": "urgency", "label": "Status"},
            {"key": "item_type", "label": "Type"},
            {"key": "description", "label": "Details"},
        ],
        rows=rows,
        limit=limit,
    )


def _calendar_critical_date_report(
    *,
    metric_key: str,
    label: str,
    intelligence: dict[str, Any],
    keys: set[str],
    limit: int,
) -> dict[str, Any]:
    rows = []
    for item in intelligence.get("critical_dates", []):
        if str(item.get("key") or "") not in keys:
            continue
        date_value = item.get("date")
        rows.append(
            {
                "key": item.get("key"),
                "date": date_value.isoformat() if hasattr(date_value, "isoformat") else date_value,
                "title": item.get("label"),
                "status": str(item.get("status") or "").replace("_", " ").title(),
                "is_blocker": bool(item.get("is_blocker")),
            }
        )
    return _simple_table_report(
        metric_key=metric_key,
        label=label,
        columns=[
            {"key": "date", "label": "Date"},
            {"key": "title", "label": "Item"},
            {"key": "status", "label": "Status"},
            {"key": "is_blocker", "label": "Blocker"},
        ],
        rows=rows,
        limit=limit,
    )


def _calendar_warning_report(*, metric_key: str, label: str, warnings: list[dict[str, Any]], limit: int) -> dict[str, Any]:
    return _simple_table_report(
        metric_key=metric_key,
        label=label,
        columns=[
            {"key": "message", "label": "Warning"},
            {"key": "severity", "label": "Severity"},
        ],
        rows=[
            {
                "code": warning.get("code"),
                "message": warning.get("message"),
                "severity": str(warning.get("severity") or "").title(),
            }
            for warning in warnings
        ],
        limit=limit,
    )


def _calendar_rows_for_metric(intelligence: dict[str, Any], metric_key: str) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for item in intelligence.get("items", []):
        urgency = str(item.get("urgency") or "")
        item_type = str(item.get("item_type") or "")
        if not _calendar_item_matches_metric(urgency, item_type, metric_key):
            continue
        rows.append(
            {
                "id": item.get("id"),
                "date": item.get("date").isoformat() if hasattr(item.get("date"), "isoformat") else item.get("date"),
                "title": item.get("title"),
                "urgency": urgency.replace("_", " ").title(),
                "item_type": item_type.replace("_", " ").title(),
                "description": item.get("description"),
                "is_blocker": bool(item.get("is_blocker")),
            }
        )
    return rows


def _calendar_item_matches_metric(urgency: str, item_type: str, metric_key: str) -> bool:
    if metric_key == "calendar_overdue":
        return urgency == "overdue"
    if metric_key == "calendar_upcoming":
        return urgency in {"today", "due_soon", "upcoming"}
    if metric_key == "calendar_missing_dates":
        return urgency == "missing" or item_type == "missing_date"
    if metric_key == "calendar_scheduled_communications":
        return item_type == "communication"
    if metric_key == "calendar_followups_due":
        return item_type == "sponsor_followup" and urgency in {"overdue", "today", "due_soon", "upcoming"}
    return urgency in {"missing", "overdue", "today", "due_soon", "upcoming"} or item_type == "communication"


def _sponsor_unreceived_columns() -> list[dict[str, str]]:
    return [
        {"key": "sponsor_name", "label": "Sponsor"},
        {"key": "email", "label": "Email"},
        {"key": "phone", "label": "Phone"},
        {"key": "drop_off_due_at", "label": "Due"},
        {"key": "drop_off_status", "label": "Drop-Off"},
        {"key": "unreceived_gift_count", "label": "Gifts"},
        {"key": "gifts", "label": "Gift List"},
    ]


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
