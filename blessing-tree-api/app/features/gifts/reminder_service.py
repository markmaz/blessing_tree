from __future__ import annotations

import re
import uuid
from collections import defaultdict
from dataclasses import dataclass
from datetime import UTC, datetime, time, timedelta
from typing import Any

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.email import send_email_message
from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.campaigns.template_renderer import CampaignTemplateRenderer
from app.models.campaign_gift_reminder_rule import (
    GIFT_REMINDER_AUDIENCE_RECEIVED,
    GIFT_REMINDER_AUDIENCES,
    CampaignGiftReminderRule,
)
from app.models.campaign_milestone import CampaignMilestone
from app.models.communication_template import CommunicationTemplate
from app.models.sponsor import Sponsor
from app.models.sponsor_constants import SPONSOR_INTERACTION_ORIGIN_CAMPAIGN_COMMUNICATION
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsor_reminder import SponsorReminder
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

CONTACTABLE_GIFT_STATUSES = {"COMMITTED", "EXCEPTION"}
RECEIVED_OR_LATER_GIFT_STATUSES = {
    "RECEIVED",
    "WRAPPED",
    "TAGGED",
    "READY_FOR_DISTRIBUTION",
    "DISTRIBUTED",
    "PICKED_UP",
}
DEFAULT_SEND_TIME_LOCAL = "09:00"


@dataclass(frozen=True)
class GiftReminderRecipient:
    sponsor: Sponsor
    sponsorship: Sponsorship
    gifts: list[WishlistItem]


class GiftReminderService:
    def __init__(
        self,
        campaign_service: CampaignService | None = None,
        template_renderer: CampaignTemplateRenderer | None = None,
    ) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.template_renderer = template_renderer or CampaignTemplateRenderer()

    def list_rules(self, db: Session, *, campaign_id: uuid.UUID) -> dict[str, Any]:
        self.campaigns.get_campaign(db, str(campaign_id))
        return {
            "campaign_id": str(campaign_id),
            "rules": self._rule_query(db, campaign_id).all(),
            "template_options": self._template_options(db, campaign_id),
            "milestone_options": self._milestone_options(db, campaign_id),
        }

    def create_rule(self, db: Session, *, campaign_id: uuid.UUID, payload: dict[str, Any]) -> CampaignGiftReminderRule:
        self.campaigns.get_campaign(db, str(campaign_id))
        label = _required_text(payload.get("label"), "label")
        rule = CampaignGiftReminderRule(
            id=uuid.uuid4(),
            campaign_id=campaign_id,
            rule_key=_rule_key(payload.get("rule_key"), label),
            label=label,
            is_enabled=_bool_value(payload.get("is_enabled"), default=True),
            audience=_audience_value(payload.get("audience")),
            milestone_key=_clean_text(payload.get("milestone_key")),
            offset_days=_int_value(payload.get("offset_days"), default=0),
            send_time_local=_send_time_value(payload.get("send_time_local")),
            template_id=self._template_id(db, campaign_id, payload.get("template_id")),
            channel="EMAIL",
            suppress_if_all_received=_bool_value(payload.get("suppress_if_all_received"), default=True),
        )
        db.add(rule)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ServiceError("Gift reminder rule key already exists for this campaign", status_code=409) from exc
        db.refresh(rule)
        return rule

    def update_rule(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        rule_id: uuid.UUID,
        payload: dict[str, Any],
    ) -> CampaignGiftReminderRule:
        rule = self._load_rule(db, campaign_id, rule_id)
        if "label" in payload:
            rule.label = _required_text(payload.get("label"), "label")
        if "is_enabled" in payload:
            rule.is_enabled = _bool_value(payload.get("is_enabled"), default=True)
        if "audience" in payload:
            rule.audience = _audience_value(payload.get("audience"))
        if "milestone_key" in payload:
            rule.milestone_key = _clean_text(payload.get("milestone_key"))
        if "offset_days" in payload:
            rule.offset_days = _int_value(payload.get("offset_days"), default=0)
        if "send_time_local" in payload:
            rule.send_time_local = _send_time_value(payload.get("send_time_local"))
        if "template_id" in payload:
            rule.template_id = self._template_id(db, campaign_id, payload.get("template_id"))
        if "suppress_if_all_received" in payload:
            rule.suppress_if_all_received = _bool_value(payload.get("suppress_if_all_received"), default=True)
        db.commit()
        db.refresh(rule)
        return rule

    def preview_rule(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        rule_id: uuid.UUID,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        rule = self._load_rule(db, campaign_id, rule_id)
        return self._preview(db, rule, now=now)

    def send_rule(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        rule_id: uuid.UUID,
        force: bool = False,
        now: datetime | None = None,
    ) -> dict[str, Any]:
        rule = self._load_rule(db, campaign_id, rule_id)
        return self._send_rule(db, rule, force=force, now=now)

    def evaluate_due_rules(self, db: Session, *, now: datetime | None = None) -> dict[str, Any]:
        evaluated_at = now or _now()
        rule_ids = [
            rule_id
            for (rule_id,) in db.query(CampaignGiftReminderRule.id)
            .filter(CampaignGiftReminderRule.is_enabled == 1)
            .order_by(CampaignGiftReminderRule.created_at.asc())
            .all()
        ]
        results: list[dict[str, Any]] = []
        for rule_id in rule_ids:
            rule = (
                db.query(CampaignGiftReminderRule)
                .options(joinedload(CampaignGiftReminderRule.campaign), joinedload(CampaignGiftReminderRule.template))
                .filter(CampaignGiftReminderRule.id == rule_id)
                .one_or_none()
            )
            if rule is None:
                continue
            results.append(self._send_rule(db, rule, force=False, now=evaluated_at))
        return {
            "task": "gift_reminders",
            "processed": len(results),
            "results": results,
        }

    def _send_rule(
        self,
        db: Session,
        rule: CampaignGiftReminderRule,
        *,
        force: bool,
        now: datetime | None,
    ) -> dict[str, Any]:
        evaluated_at = now or _now()
        preview = self._preview(db, rule, now=evaluated_at)
        due_at = preview["due_at"]
        if not force and (due_at is None or evaluated_at < due_at):
            rule.last_evaluated_at = evaluated_at
            db.commit()
            return {
                "rule_id": str(rule.id),
                "status": "not_due",
                "due_at": due_at.isoformat() if due_at else None,
                "recipient_count": preview["recipient_count"],
            }

        if rule.template is None or not rule.template.is_active:
            rule.last_evaluated_at = evaluated_at
            db.commit()
            return {
                "rule_id": str(rule.id),
                "status": "blocked",
                "reason": "template_inactive",
                "recipient_count": 0,
            }

        recipients: list[GiftReminderRecipient] = preview["recipients"]
        sent_count = 0
        skipped_count = 0
        failed_count = 0
        errors: list[str] = []
        for recipient in recipients:
            if self._already_sent(db, rule, recipient.sponsor.id, due_at):
                skipped_count += 1
                continue
            if not recipient.sponsor.email or recipient.sponsor.do_not_contact:
                self._record_reminder(
                    db,
                    rule=rule,
                    recipient=recipient,
                    due_at=due_at,
                    sent_at=None,
                    status="SKIPPED",
                    sent_via="NONE",
                    interaction=None,
                    notes="Sponsor has no usable email address or is marked do not contact.",
                )
                skipped_count += 1
                continue

            subject, html_body, text_body = self.template_renderer.render(
                campaign_name=rule.campaign.name,
                campaign_year=rule.campaign.year,
                subject_template=rule.template.subject_template,
                body_template=rule.template.body_template,
                merge_fields=_merge_fields(recipient),
            )
            interaction = self._record_interaction(
                db,
                rule=rule,
                recipient=recipient,
                subject=subject,
                outcome="COMPLETED",
                occurred_at=evaluated_at,
            )
            try:
                send_email_message(
                    recipients=[recipient.sponsor.email],
                    subject=subject,
                    html=html_body,
                    text_body=text_body,
                )
                self._record_reminder(
                    db,
                    rule=rule,
                    recipient=recipient,
                    due_at=due_at,
                    sent_at=evaluated_at,
                    status="SENT",
                    sent_via="EMAIL",
                    interaction=interaction,
                    notes=f"Gift reminder rule {rule.label} sent.",
                )
                recipient.sponsor.last_contacted_at = evaluated_at
                sent_count += 1
            except Exception as exc:
                interaction.outcome = "BOUNCED"
                self._record_reminder(
                    db,
                    rule=rule,
                    recipient=recipient,
                    due_at=due_at,
                    sent_at=None,
                    status="SKIPPED",
                    sent_via="NONE",
                    interaction=interaction,
                    notes=f"Gift reminder send failed: {exc}",
                )
                failed_count += 1
                if len(errors) < 5:
                    errors.append(f"{recipient.sponsor.email}: {exc}")

        rule.last_evaluated_at = evaluated_at
        db.commit()
        return {
            "rule_id": str(rule.id),
            "status": "sent" if sent_count else ("skipped" if failed_count == 0 else "failed"),
            "due_at": due_at.isoformat() if due_at else None,
            "recipient_count": len(recipients),
            "sent_count": sent_count,
            "skipped_count": skipped_count,
            "failed_count": failed_count,
            "errors": errors,
        }

    def _preview(self, db: Session, rule: CampaignGiftReminderRule, *, now: datetime | None) -> dict[str, Any]:
        evaluated_at = now or _now()
        due_at = self._due_at(db, rule)
        recipients = self._resolve_recipients(db, rule)
        return {
            "rule_id": str(rule.id),
            "campaign_id": str(rule.campaign_id),
            "due_at": due_at,
            "is_due": due_at is not None and evaluated_at >= due_at,
            "recipient_count": len(recipients),
            "recipients": recipients,
        }

    def _resolve_recipients(self, db: Session, rule: CampaignGiftReminderRule) -> list[GiftReminderRecipient]:
        statuses = (
            RECEIVED_OR_LATER_GIFT_STATUSES
            if rule.audience == GIFT_REMINDER_AUDIENCE_RECEIVED
            else CONTACTABLE_GIFT_STATUSES
        )
        rows = (
            db.query(WishlistItem)
            .options(
                joinedload(WishlistItem.wishlist),
                joinedload(WishlistItem.sponsorship_item)
                .joinedload(SponsorshipItem.sponsorship)
                .joinedload(Sponsorship.sponsor),
            )
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .join(SponsorshipItem, SponsorshipItem.wishlist_item_id == WishlistItem.id)
            .join(Sponsorship, Sponsorship.id == SponsorshipItem.sponsorship_id)
            .filter(
                Wishlist.campaign_id == rule.campaign_id,
                Sponsorship.campaign_id == rule.campaign_id,
                Sponsorship.status == "ACTIVE",
                WishlistItem.status.in_(statuses),
            )
            .order_by(WishlistItem.description.asc())
            .all()
        )
        by_sponsorship: dict[uuid.UUID, list[WishlistItem]] = defaultdict(list)
        for item in rows:
            sponsorship = item.sponsorship_item.sponsorship if item.sponsorship_item is not None else None
            if sponsorship is not None:
                by_sponsorship[sponsorship.id].append(item)

        recipients: list[GiftReminderRecipient] = []
        for items in by_sponsorship.values():
            sponsorship = items[0].sponsorship_item.sponsorship
            sponsor = sponsorship.sponsor
            if sponsor is None:
                continue
            recipients.append(GiftReminderRecipient(sponsor=sponsor, sponsorship=sponsorship, gifts=items))
        recipients.sort(key=lambda row: row.sponsor.display_name.lower())
        return recipients

    def _due_at(self, db: Session, rule: CampaignGiftReminderRule) -> datetime | None:
        if not rule.milestone_key:
            return None
        milestone = (
            db.query(CampaignMilestone)
            .filter(
                CampaignMilestone.campaign_id == rule.campaign_id,
                CampaignMilestone.milestone_key == rule.milestone_key,
            )
            .one_or_none()
        )
        if milestone is None:
            return None
        due_date = milestone.occurs_on + timedelta(days=rule.offset_days or 0)
        send_time = _parse_send_time(rule.send_time_local)
        return datetime.combine(due_date, send_time)

    def _already_sent(
        self,
        db: Session,
        rule: CampaignGiftReminderRule,
        sponsor_id: uuid.UUID,
        due_at: datetime | None,
    ) -> bool:
        due_marker = due_at.isoformat() if due_at else "manual"
        return (
            db.query(SponsorReminder.id)
            .filter(
                SponsorReminder.campaign_id == rule.campaign_id,
                SponsorReminder.sponsor_id == sponsor_id,
                SponsorReminder.status == "SENT",
                SponsorReminder.notes.like(f"%gift_rule:{rule.id};due:{due_marker}%"),
            )
            .first()
            is not None
        )

    def _record_interaction(
        self,
        db: Session,
        *,
        rule: CampaignGiftReminderRule,
        recipient: GiftReminderRecipient,
        subject: str,
        outcome: str,
        occurred_at: datetime,
    ) -> SponsorInteraction:
        interaction = SponsorInteraction(
            id=uuid.uuid4(),
            campaign_id=rule.campaign_id,
            sponsor_id=recipient.sponsor.id,
            channel="EMAIL",
            direction="OUTBOUND",
            subject=subject,
            origin_type=SPONSOR_INTERACTION_ORIGIN_CAMPAIGN_COMMUNICATION,
            outcome=outcome,
            notes=f"Gift reminder rule {rule.label} delivered to sponsor audience.",
            occurred_at=occurred_at,
            related_sponsorship_id=recipient.sponsorship.id,
        )
        db.add(interaction)
        return interaction

    def _record_reminder(
        self,
        db: Session,
        *,
        rule: CampaignGiftReminderRule,
        recipient: GiftReminderRecipient,
        due_at: datetime | None,
        sent_at: datetime | None,
        status: str,
        sent_via: str,
        interaction: SponsorInteraction | None,
        notes: str,
    ) -> None:
        due_marker = due_at.isoformat() if due_at else "manual"
        db.add(
            SponsorReminder(
                id=uuid.uuid4(),
                campaign_id=rule.campaign_id,
                sponsor_id=recipient.sponsor.id,
                reminder_type="CUSTOM",
                planned_at=due_at or _now(),
                sent_at=sent_at,
                status=status,
                sent_via=sent_via,
                interaction_id=interaction.id if interaction is not None else None,
                notes=f"gift_rule:{rule.id};due:{due_marker}; {notes}",
            )
        )

    def _load_rule(self, db: Session, campaign_id: uuid.UUID, rule_id: uuid.UUID) -> CampaignGiftReminderRule:
        rule = (
            self._rule_query(db, campaign_id)
            .filter(CampaignGiftReminderRule.id == rule_id)
            .one_or_none()
        )
        if rule is None:
            raise ServiceError("Gift reminder rule not found", status_code=404)
        return rule

    def _rule_query(self, db: Session, campaign_id: uuid.UUID):
        return (
            db.query(CampaignGiftReminderRule)
            .options(joinedload(CampaignGiftReminderRule.campaign), joinedload(CampaignGiftReminderRule.template))
            .filter(CampaignGiftReminderRule.campaign_id == campaign_id)
            .order_by(CampaignGiftReminderRule.created_at.asc(), CampaignGiftReminderRule.label.asc())
        )

    def _template_id(self, db: Session, campaign_id: uuid.UUID, raw_value: object) -> uuid.UUID | None:
        value = _clean_text(raw_value)
        if value is None:
            return None
        template_id = _uuid_value(value, "template_id")
        template = (
            db.query(CommunicationTemplate)
            .filter(
                CommunicationTemplate.id == template_id,
                CommunicationTemplate.campaign_id == campaign_id,
                CommunicationTemplate.channel == "EMAIL",
                CommunicationTemplate.audience == "SPONSOR",
                CommunicationTemplate.is_active == 1,
            )
            .one_or_none()
        )
        if template is None:
            raise ServiceError("Gift reminder template must be an active sponsor email template", status_code=400)
        return template_id

    def _template_options(self, db: Session, campaign_id: uuid.UUID) -> list[CommunicationTemplate]:
        return (
            db.query(CommunicationTemplate)
            .filter(
                CommunicationTemplate.campaign_id == campaign_id,
                CommunicationTemplate.channel == "EMAIL",
                CommunicationTemplate.audience == "SPONSOR",
                CommunicationTemplate.is_active == 1,
            )
            .order_by(CommunicationTemplate.name.asc())
            .all()
        )

    def _milestone_options(self, db: Session, campaign_id: uuid.UUID) -> list[CampaignMilestone]:
        return (
            db.query(CampaignMilestone)
            .filter(CampaignMilestone.campaign_id == campaign_id)
            .order_by(CampaignMilestone.sort_order.asc(), CampaignMilestone.occurs_on.asc())
            .all()
        )


def _merge_fields(recipient: GiftReminderRecipient) -> dict[str, str]:
    descriptions = ", ".join(item.description for item in recipient.gifts)
    return {
        "sponsor.name": recipient.sponsor.display_name,
        "sponsor.email": recipient.sponsor.email or "",
        "gift.count": str(len(recipient.gifts)),
        "gift.descriptions": descriptions,
        "gifts.descriptions": descriptions,
    }


def _now() -> datetime:
    return datetime.now(UTC).replace(tzinfo=None)


def _clean_text(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    return text or None


def _required_text(value: object, field: str) -> str:
    text = _clean_text(value)
    if text is None:
        raise ServiceError(f"{field} is required", status_code=400, details={"field": field})
    return text


def _rule_key(raw_value: object, label: str) -> str:
    text = _clean_text(raw_value) or label
    slug = re.sub(r"[^a-z0-9]+", "_", text.lower()).strip("_")
    return (slug or f"gift_rule_{uuid.uuid4().hex[:8]}")[:100]


def _audience_value(value: object) -> str:
    text = _required_text(value, "audience").upper()
    if text not in GIFT_REMINDER_AUDIENCES:
        raise ServiceError("Invalid gift reminder audience", status_code=400, details={"field": "audience"})
    return text


def _send_time_value(value: object) -> str:
    text = _clean_text(value) or DEFAULT_SEND_TIME_LOCAL
    _parse_send_time(text)
    return text


def _parse_send_time(value: str) -> time:
    try:
        hour_text, minute_text = value.split(":", 1)
        return time(hour=int(hour_text), minute=int(minute_text))
    except (ValueError, TypeError) as exc:
        raise ServiceError("send_time_local must use HH:MM format", status_code=400, details={"field": "send_time_local"}) from exc


def _int_value(value: object, *, default: int) -> int:
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ServiceError("Expected an integer value", status_code=400) from exc


def _bool_value(value: object, *, default: bool) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value != 0
    text = str(value).strip().lower()
    if text in {"1", "true", "yes", "on"}:
        return True
    if text in {"0", "false", "no", "off"}:
        return False
    return default


def _uuid_value(value: object, field: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (TypeError, ValueError) as exc:
        raise ServiceError(f"{field} must be a UUID", status_code=400, details={"field": field}) from exc
