from __future__ import annotations

import re
import uuid
from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session, joinedload

from app.email import send_email_message
from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService
from app.features.campaigns.recipient_resolver import CampaignRecipientResolver, ResolvedCampaignRecipient
from app.features.campaigns.studio_constants import COMMUNICATION_AUDIENCE_SPONSOR
from app.features.campaigns.template_renderer import CampaignTemplateRenderer
from app.models.campaign_communication_send import (
    COMMUNICATION_SEND_STATUS_FAILED,
    COMMUNICATION_SEND_STATUS_PARTIAL,
    COMMUNICATION_SEND_STATUS_PENDING,
    COMMUNICATION_SEND_STATUS_SENT,
    COMMUNICATION_SEND_TARGET_AUDIENCE,
    COMMUNICATION_SEND_TARGET_CONTEXT_SPONSOR,
    COMMUNICATION_SEND_TARGET_MANUAL_EMAIL,
    COMMUNICATION_SEND_TARGET_SELECTED_CONTACTS,
    COMMUNICATION_SEND_TARGET_SELECTED_MEMBERS,
    COMMUNICATION_SEND_TARGET_SELECTED_SPONSORS,
    COMMUNICATION_SEND_TARGET_TEAM,
    CampaignCommunicationSend,
)
from app.models.campaign_communication_send_recipient import (
    COMMUNICATION_SEND_RECIPIENT_TYPE_CONTACT,
    COMMUNICATION_SEND_RECIPIENT_TYPE_MANUAL,
    COMMUNICATION_SEND_RECIPIENT_TYPE_MEMBER,
    COMMUNICATION_SEND_RECIPIENT_TYPE_SPONSOR,
    CampaignCommunicationSendRecipient,
)
from app.models.campaign_milestone import CampaignMilestone
from app.models.communication_template import CommunicationTemplate
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.sponsor_constants import SPONSOR_INTERACTION_ORIGIN_CAMPAIGN_COMMUNICATION
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsorship import Sponsorship
from app.models.sponsorship_item import SponsorshipItem
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

_MERGE_FIELD_PATTERN = re.compile(r"{{\s*([A-Za-z0-9_.-]+)\s*}}")
_RECEIVED_STATUS_INDEX = 3
_WISHLIST_STATUS_ORDER = {
    "OPEN": 0,
    "RESERVED": 1,
    "COMMITTED": 2,
    "RECEIVED": 3,
    "WRAPPED": 4,
    "TAGGED": 5,
    "READY_FOR_DISTRIBUTION": 6,
    "DISTRIBUTED": 7,
    "PICKED_UP": 8,
    "EXCEPTION": 9,
    "CANCELLED": 10,
}


@dataclass(frozen=True)
class SponsorGiftMergeContext:
    merge_fields: dict[str, str]
    warnings: list[dict[str, str]]


class CampaignCommunicationSendService:
    def __init__(
        self,
        campaign_service: CampaignService | None = None,
        template_renderer: CampaignTemplateRenderer | None = None,
        recipient_resolver: CampaignRecipientResolver | None = None,
    ) -> None:
        self.campaigns = campaign_service or CampaignService()
        self.template_renderer = template_renderer or CampaignTemplateRenderer()
        self.recipient_resolver = recipient_resolver or CampaignRecipientResolver()

    def preview_sponsor_send(
        self,
        db: Session,
        *,
        campaign_id: str,
        sponsor_id: str,
        template_id: str,
    ) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        sponsorship = self._get_sponsorship(db, campaign_id, sponsor_id)
        template = self._get_sponsor_template(db, campaign_id, template_id)
        recipient_email = self._sponsor_email(sponsorship)

        merge_context = self._build_sponsor_merge_context(db, sponsorship=sponsorship, template=template)
        subject, html_body, text_body = self.template_renderer.render(
            campaign_name=campaign.name,
            campaign_year=campaign.year,
            subject_template=template.subject_template,
            body_template=template.body_template,
            merge_fields=merge_context.merge_fields,
        )
        return {
            "template_id": str(template.id),
            "sponsor_id": str(sponsorship.sponsor_id),
            "recipient_email": recipient_email,
            "subject": subject,
            "html": html_body,
            "text": text_body,
            "merge_fields": merge_context.merge_fields,
            "warnings": merge_context.warnings,
        }

    def send_sponsor_template(
        self,
        db: Session,
        *,
        campaign_id: str,
        sponsor_id: str,
        template_id: str,
        created_by_user_id: str | None,
    ) -> dict[str, object]:
        preview = self.preview_sponsor_send(
            db,
            campaign_id=campaign_id,
            sponsor_id=sponsor_id,
            template_id=template_id,
        )
        sponsorship = self._get_sponsorship(db, campaign_id, sponsor_id)
        template = self._get_sponsor_template(db, campaign_id, template_id)
        occurred_at = datetime.now(UTC).replace(tzinfo=None)
        sender_id = uuid.UUID(str(created_by_user_id)) if created_by_user_id else None

        send = CampaignCommunicationSend(
            id=uuid.uuid4(),
            campaign_id=sponsorship.campaign_id,
            template_id=template.id,
            target_mode=COMMUNICATION_SEND_TARGET_CONTEXT_SPONSOR,
            status="PENDING",
            subject=str(preview["subject"]),
            recipient_count=1,
            delivered_count=0,
            failed_count=0,
            created_by_user_id=sender_id,
        )
        db.add(send)
        db.flush()

        recipient = CampaignCommunicationSendRecipient(
            id=uuid.uuid4(),
            send_id=send.id,
            recipient_type=COMMUNICATION_SEND_RECIPIENT_TYPE_SPONSOR,
            recipient_ref_id=sponsorship.sponsor_id,
            email=str(preview["recipient_email"]),
            display_name=sponsorship.sponsor.display_name,
            status="PENDING",
        )
        db.add(recipient)
        db.flush()

        try:
            send_email_message(
                recipients=[str(preview["recipient_email"])],
                subject=str(preview["subject"]),
                html=str(preview["html"]),
                text_body=str(preview["text"]),
            )
        except Exception as exc:
            send.status = COMMUNICATION_SEND_STATUS_FAILED
            send.failed_count = 1
            send.error_message = str(exc)
            recipient.status = COMMUNICATION_SEND_STATUS_FAILED
            recipient.error_message = str(exc)
            db.commit()
            raise ServiceError(
                "Sponsor email could not be sent",
                status_code=502,
                details={"send_id": str(send.id)},
            ) from exc

        send.status = COMMUNICATION_SEND_STATUS_SENT
        send.delivered_count = 1
        recipient.status = COMMUNICATION_SEND_STATUS_SENT
        recipient.sent_at = occurred_at

        interaction = SponsorInteraction(
            id=uuid.uuid4(),
            campaign_id=sponsorship.campaign_id,
            sponsor_id=sponsorship.sponsor_id,
            channel="EMAIL",
            direction="OUTBOUND",
            subject=str(preview["subject"]),
            origin_type=SPONSOR_INTERACTION_ORIGIN_CAMPAIGN_COMMUNICATION,
            outcome="COMPLETED",
            notes=f"Sent communication template '{template.name}'.",
            occurred_at=occurred_at,
            created_by_user_id=sender_id,
            related_sponsorship_id=sponsorship.id,
            related_delivery_attempt_id=str(send.id),
        )
        db.add(interaction)
        sponsorship.sponsor.last_contacted_at = occurred_at
        db.commit()

        return {
            "send_id": str(send.id),
            "template_id": str(template.id),
            "sponsor_id": str(sponsorship.sponsor_id),
            "recipient_email": str(preview["recipient_email"]),
            "subject": str(preview["subject"]),
            "status": send.status,
            "warnings": preview["warnings"],
        }

    def send_campaign_template(
        self,
        db: Session,
        *,
        campaign_id: str,
        template_id: str,
        target_mode: str,
        created_by_user_id: str | None,
        manual_recipients: list[dict[str, object]] | None = None,
        team_ids: list[str] | None = None,
        sponsor_ids: list[str] | None = None,
        member_ids: list[str] | None = None,
        contact_ids: list[str] | None = None,
    ) -> dict[str, object]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        template = self._get_email_template(db, campaign_id, template_id)
        normalized_target_mode = str(target_mode or COMMUNICATION_SEND_TARGET_AUDIENCE).strip().upper()
        sender_id = uuid.UUID(str(created_by_user_id)) if created_by_user_id else None

        if normalized_target_mode == COMMUNICATION_SEND_TARGET_AUDIENCE:
            recipients = self.recipient_resolver.resolve_for_audience(
                db,
                campaign_id=campaign_id,
                audience=template.audience,
            )
        elif normalized_target_mode == COMMUNICATION_SEND_TARGET_MANUAL_EMAIL:
            recipients = _manual_recipients(manual_recipients or [])
        elif normalized_target_mode == COMMUNICATION_SEND_TARGET_TEAM:
            recipients = self.recipient_resolver.resolve_for_team_ids(
                db,
                campaign_id=campaign_id,
                team_ids=team_ids or [],
            )
        elif normalized_target_mode == COMMUNICATION_SEND_TARGET_SELECTED_SPONSORS:
            recipients = self.recipient_resolver.resolve_for_sponsor_ids(
                db,
                campaign_id=campaign_id,
                sponsor_ids=sponsor_ids or [],
            )
        elif normalized_target_mode == COMMUNICATION_SEND_TARGET_SELECTED_MEMBERS:
            recipients = self.recipient_resolver.resolve_for_member_ids(
                db,
                campaign_id=campaign_id,
                member_ids=member_ids or [],
            )
        elif normalized_target_mode == COMMUNICATION_SEND_TARGET_SELECTED_CONTACTS:
            recipients = self.recipient_resolver.resolve_for_contact_ids(
                db,
                campaign_id=campaign_id,
                contact_ids=contact_ids or [],
            )
        else:
            raise ServiceError(
                "Unsupported send target mode",
                status_code=400,
                details={"target_mode": normalized_target_mode},
            )

        if not recipients:
            raise ServiceError("At least one email recipient is required", status_code=400)

        first_subject, _, _ = self.template_renderer.render(
            campaign_name=campaign.name,
            campaign_year=campaign.year,
            subject_template=template.subject_template,
            body_template=template.body_template,
            merge_fields=recipients[0].merge_fields,
        )
        send = CampaignCommunicationSend(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            template_id=template.id,
            target_mode=normalized_target_mode,
            status=COMMUNICATION_SEND_STATUS_PENDING,
            subject=first_subject,
            recipient_count=len(recipients),
            delivered_count=0,
            failed_count=0,
            created_by_user_id=sender_id,
        )
        db.add(send)
        db.flush()

        occurred_at = datetime.now(UTC).replace(tzinfo=None)
        delivered_sponsor_ids: list[str] = []
        errors: list[str] = []
        for resolved_recipient in recipients:
            recipient_row = CampaignCommunicationSendRecipient(
                id=uuid.uuid4(),
                send_id=send.id,
                recipient_type=_recipient_type(template.audience, normalized_target_mode, resolved_recipient),
                recipient_ref_id=_recipient_ref_id(resolved_recipient),
                email=resolved_recipient.email,
                display_name=resolved_recipient.display_name,
                status=COMMUNICATION_SEND_STATUS_PENDING,
            )
            db.add(recipient_row)
            db.flush()

            subject, html_body, text_body = self.template_renderer.render(
                campaign_name=campaign.name,
                campaign_year=campaign.year,
                subject_template=template.subject_template,
                body_template=template.body_template,
                merge_fields=resolved_recipient.merge_fields,
            )
            try:
                send_email_message(
                    recipients=[resolved_recipient.email],
                    subject=subject,
                    html=html_body,
                    text_body=text_body,
                )
            except Exception as exc:
                send.failed_count += 1
                recipient_row.status = COMMUNICATION_SEND_STATUS_FAILED
                recipient_row.error_message = str(exc)
                if len(errors) < 5:
                    errors.append(f"{resolved_recipient.email}: {exc}")
                continue

            send.delivered_count += 1
            recipient_row.status = COMMUNICATION_SEND_STATUS_SENT
            recipient_row.sent_at = occurred_at
            if resolved_recipient.sponsor_id:
                delivered_sponsor_ids.append(resolved_recipient.sponsor_id)

        if send.delivered_count == 0:
            send.status = COMMUNICATION_SEND_STATUS_FAILED
        elif send.failed_count > 0:
            send.status = COMMUNICATION_SEND_STATUS_PARTIAL
        else:
            send.status = COMMUNICATION_SEND_STATUS_SENT
        send.error_message = "; ".join(errors) if errors else None

        if template.audience == COMMUNICATION_AUDIENCE_SPONSOR:
            self._record_sponsor_send_interactions(
                db,
                campaign_id=campaign.id,
                send_id=send.id,
                subject=send.subject,
                delivered_sponsor_ids=delivered_sponsor_ids,
                created_by_user_id=sender_id,
                occurred_at=occurred_at,
            )

        db.commit()
        return {
            "send_id": str(send.id),
            "template_id": str(template.id),
            "target_mode": send.target_mode,
            "status": send.status,
            "subject": send.subject,
            "recipient_count": send.recipient_count,
            "delivered_count": send.delivered_count,
            "failed_count": send.failed_count,
            "error_message": send.error_message,
        }

    def _get_sponsorship(self, db: Session, campaign_id: str, sponsor_id: str) -> Sponsorship:
        sponsorship = (
            db.query(Sponsorship)
            .options(
                joinedload(Sponsorship.sponsor),
                joinedload(Sponsorship.items)
                .joinedload(SponsorshipItem.wishlist_item)
                .joinedload(WishlistItem.wishlist)
                .joinedload(Wishlist.recipient)
                .joinedload(Recipient.recipient_group),
            )
            .filter(
                Sponsorship.campaign_id == uuid.UUID(str(campaign_id)),
                Sponsorship.sponsor_id == uuid.UUID(str(sponsor_id)),
            )
            .one_or_none()
        )
        if sponsorship is None:
            raise ServiceError("Sponsor not found", status_code=404, details={"sponsor_id": sponsor_id})
        return sponsorship

    def _get_sponsor_template(self, db: Session, campaign_id: str, template_id: str) -> CommunicationTemplate:
        template = self._get_email_template(db, campaign_id, template_id)
        if template.audience != COMMUNICATION_AUDIENCE_SPONSOR:
            raise ServiceError(
                "Only sponsor audience templates can be sent from the sponsor screen",
                status_code=409,
                details={"template_id": template_id, "audience": template.audience},
            )
        return template

    @staticmethod
    def _get_email_template(db: Session, campaign_id: str, template_id: str) -> CommunicationTemplate:
        template = (
            db.query(CommunicationTemplate)
            .filter(
                CommunicationTemplate.campaign_id == uuid.UUID(str(campaign_id)),
                CommunicationTemplate.id == uuid.UUID(str(template_id)),
            )
            .one_or_none()
        )
        if template is None:
            raise ServiceError("Communication template not found", status_code=404, details={"template_id": template_id})
        if not template.is_active:
            raise ServiceError("Communication template is inactive", status_code=409, details={"template_id": template_id})
        if template.channel != "EMAIL":
            raise ServiceError("Only email templates can be sent", status_code=409, details={"template_id": template_id})
        return template

    @staticmethod
    def _record_sponsor_send_interactions(
        db: Session,
        *,
        campaign_id: uuid.UUID,
        send_id: uuid.UUID,
        subject: str,
        delivered_sponsor_ids: list[str],
        created_by_user_id: uuid.UUID | None,
        occurred_at: datetime,
    ) -> None:
        if not delivered_sponsor_ids:
            return
        delivered_id_set = {uuid.UUID(str(sponsor_id)) for sponsor_id in delivered_sponsor_ids}
        sponsorships = (
            db.query(Sponsorship)
            .options(joinedload(Sponsorship.sponsor))
            .filter(
                Sponsorship.campaign_id == campaign_id,
                Sponsorship.sponsor_id.in_(delivered_id_set),
            )
            .all()
        )
        for sponsorship in sponsorships:
            interaction = SponsorInteraction(
                id=uuid.uuid4(),
                campaign_id=campaign_id,
                sponsor_id=sponsorship.sponsor_id,
                channel="EMAIL",
                direction="OUTBOUND",
                subject=subject,
                origin_type=SPONSOR_INTERACTION_ORIGIN_CAMPAIGN_COMMUNICATION,
                outcome="COMPLETED",
                notes="Sent campaign communication from Campaign Studio.",
                occurred_at=occurred_at,
                created_by_user_id=created_by_user_id,
                related_sponsorship_id=sponsorship.id,
                related_delivery_attempt_id=str(send_id),
            )
            db.add(interaction)
            sponsorship.sponsor.last_contacted_at = occurred_at

    @staticmethod
    def _sponsor_email(sponsorship: Sponsorship) -> str:
        email = str(sponsorship.sponsor.email or "").strip().lower()
        if "@" not in email:
            raise ServiceError("Sponsor must have a valid email address before sending email", status_code=409)
        return email

    def _build_sponsor_merge_context(
        self,
        db: Session,
        *,
        sponsorship: Sponsorship,
        template: CommunicationTemplate,
    ) -> SponsorGiftMergeContext:
        sponsor = sponsorship.sponsor
        gift_rows = self._gift_rows(sponsorship)
        awaiting_rows = [row for row in gift_rows if _status_index(row["status"]) < _RECEIVED_STATUS_INDEX]
        received_rows = [row for row in gift_rows if _status_index(row["status"]) >= _RECEIVED_STATUS_INDEX]
        due_date = self._gift_turn_in_due(db, campaign_id=sponsorship.campaign_id)
        referenced_fields = _referenced_fields(template)

        merge_fields = {
            "sponsor.first_name": _first_name(sponsor.display_name),
            "sponsor.full_name": sponsor.display_name,
            "sponsor.email": str(sponsor.email or ""),
            "sponsor.phone": str(sponsor.phone or ""),
            "gift.commitment_count": str(len(gift_rows)),
            "gift.commitment_summary": _commitment_summary(gift_rows),
            "gift.items_list": _format_gift_list(gift_rows),
            "gift.items_table": _format_gift_list(gift_rows),
            "gift.awaiting_turn_in_list": _format_gift_list(awaiting_rows),
            "gift.awaiting_turn_in_table": _format_gift_list(awaiting_rows),
            "gift.received_or_later_list": _format_gift_list(received_rows),
            "gift.received_or_later_table": _format_gift_list(received_rows),
            "gift.recipient_names": ", ".join(_unique(row["recipient_label"] for row in gift_rows)),
            "gift.due_date": due_date,
            "gift.dropoff_instructions": "",
        }
        warnings = _build_gift_warnings(
            referenced_fields=referenced_fields,
            all_count=len(gift_rows),
            awaiting_count=len(awaiting_rows),
            received_count=len(received_rows),
            due_date=due_date,
        )
        return SponsorGiftMergeContext(merge_fields=merge_fields, warnings=warnings)

    @staticmethod
    def _gift_rows(sponsorship: Sponsorship) -> list[dict[str, str]]:
        rows: list[dict[str, str]] = []
        for sponsorship_item in sponsorship.items or []:
            item = sponsorship_item.wishlist_item
            if item is None or item.status == "CANCELLED":
                continue
            wishlist = item.wishlist
            recipient = wishlist.recipient if wishlist is not None else None
            group = recipient.recipient_group if recipient is not None else None
            rows.append(
                {
                    "recipient_label": _public_safe_recipient_label(recipient),
                    "group_name": group.group_name if isinstance(group, RecipientGroup) else "",
                    "description": item.description,
                    "status": item.status,
                    "quantity": str(sponsorship_item.qty_committed or item.qty_requested or 1),
                }
            )
        return rows

    @staticmethod
    def _gift_turn_in_due(db: Session, *, campaign_id: uuid.UUID) -> str:
        milestone = (
            db.query(CampaignMilestone)
            .filter(
                CampaignMilestone.campaign_id == campaign_id,
                CampaignMilestone.milestone_key == "gift_turn_in_due",
            )
            .one_or_none()
        )
        if milestone is None or milestone.occurs_on is None:
            return ""
        return milestone.occurs_on.isoformat()


def _referenced_fields(template: CommunicationTemplate) -> set[str]:
    values = [template.subject_template or "", template.body_template or ""]
    fields: set[str] = set()
    for value in values:
        fields.update(match.group(1) for match in _MERGE_FIELD_PATTERN.finditer(value))
    return fields


def _manual_recipients(items: list[dict[str, object]]) -> list[ResolvedCampaignRecipient]:
    recipients: list[ResolvedCampaignRecipient] = []
    for index, item in enumerate(items):
        email = str(item.get("email") or "").strip().lower()
        if "@" not in email or len(email) > 255:
            raise ServiceError(
                "Manual recipients require valid email addresses",
                status_code=400,
                details={"index": index, "field": "email"},
            )
        display_name = str(item.get("display_name") or "").strip() or email
        recipients.append(
            ResolvedCampaignRecipient(
                email=email,
                display_name=display_name[:255],
                merge_fields={
                    "contact.first_name": _first_name(display_name),
                    "contact.full_name": display_name,
                    "recipient.first_name": _first_name(display_name),
                    "recipient.full_name": display_name,
                    "manager.name": display_name,
                    "volunteer.first_name": _first_name(display_name),
                    "volunteer.full_name": display_name,
                },
            )
        )
    return _dedupe_resolved_recipients(recipients)


def _recipient_type(
    audience: str,
    target_mode: str,
    recipient: ResolvedCampaignRecipient,
) -> str:
    if target_mode == COMMUNICATION_SEND_TARGET_MANUAL_EMAIL:
        return COMMUNICATION_SEND_RECIPIENT_TYPE_MANUAL
    if recipient.sponsor_id:
        return COMMUNICATION_SEND_RECIPIENT_TYPE_SPONSOR
    if recipient.member_id:
        return COMMUNICATION_SEND_RECIPIENT_TYPE_MEMBER
    if recipient.contact_id:
        return COMMUNICATION_SEND_RECIPIENT_TYPE_CONTACT
    if str(audience or "").upper() in {"VOLUNTEER", "MANAGER", "GENERAL"}:
        return COMMUNICATION_SEND_RECIPIENT_TYPE_MEMBER
    return COMMUNICATION_SEND_RECIPIENT_TYPE_CONTACT


def _recipient_ref_id(recipient: ResolvedCampaignRecipient) -> uuid.UUID | None:
    value = recipient.sponsor_id or recipient.member_id or recipient.contact_id
    return uuid.UUID(str(value)) if value else None


def _dedupe_resolved_recipients(
    recipients: list[ResolvedCampaignRecipient],
) -> list[ResolvedCampaignRecipient]:
    seen: set[str] = set()
    deduped: list[ResolvedCampaignRecipient] = []
    for recipient in recipients:
        email = recipient.email.strip().lower()
        if not email or email in seen:
            continue
        seen.add(email)
        deduped.append(recipient)
    return deduped


def _build_gift_warnings(
    *,
    referenced_fields: set[str],
    all_count: int,
    awaiting_count: int,
    received_count: int,
    due_date: str,
) -> list[dict[str, str]]:
    warnings: list[dict[str, str]] = []
    if referenced_fields.intersection({"gift.items_list", "gift.items_table", "gift.commitment_summary"}) and all_count == 0:
        warnings.append({"code": "no_committed_gifts", "message": "This sponsor has no committed gifts."})
    if referenced_fields.intersection({"gift.awaiting_turn_in_list", "gift.awaiting_turn_in_table"}) and awaiting_count == 0:
        warnings.append({"code": "no_awaiting_turn_in_gifts", "message": "This sponsor has no gifts awaiting turn-in."})
    if referenced_fields.intersection({"gift.received_or_later_list", "gift.received_or_later_table"}) and received_count == 0:
        warnings.append({"code": "no_received_gifts", "message": "This sponsor has no received gifts yet."})
    if "gift.due_date" in referenced_fields and not due_date:
        warnings.append({"code": "missing_gift_turn_in_due", "message": "Gift Turn-In Due milestone is not set."})
    return warnings


def _format_gift_list(rows: list[dict[str, str]]) -> str:
    if not rows:
        return ""
    return "\n".join(
        (
            f"- {row['recipient_label']}: {row['description']}"
            f" ({_status_label(row['status'])}, Qty {row['quantity']})"
        )
        for row in rows
    )


def _commitment_summary(rows: list[dict[str, str]]) -> str:
    if not rows:
        return "No committed gifts are currently assigned."
    count = len(rows)
    return f"{count} committed gift{'s' if count != 1 else ''}."


def _public_safe_recipient_label(recipient: Recipient | None) -> str:
    if recipient is None:
        return "Recipient"
    if recipient.public_label:
        return recipient.public_label
    if recipient.display_label:
        return recipient.display_label
    first_name = str(recipient.first_name or "").strip()
    last_name = str(recipient.last_name or "").strip()
    if first_name and last_name:
        return f"{first_name} {last_name[0]}."
    if first_name:
        return first_name
    return "Recipient"


def _first_name(display_name: str | None) -> str:
    value = str(display_name or "").strip()
    return value.split(" ", 1)[0] if value else "Sponsor"


def _status_index(status: str) -> int:
    return _WISHLIST_STATUS_ORDER.get(str(status or "").upper(), _RECEIVED_STATUS_INDEX)


def _status_label(status: str) -> str:
    return str(status or "").replace("_", " ").title()


def _unique(values) -> list[str]:
    seen: set[str] = set()
    results: list[str] = []
    for value in values:
        normalized = str(value or "").strip()
        if normalized and normalized not in seen:
            seen.add(normalized)
            results.append(normalized)
    return results
