from __future__ import annotations

import uuid
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.email import send_email_message
from app.features.campaigns.automation_constants import (
    CAMPAIGN_AUTOMATION_DISPATCH_ACTION,
    CAMPAIGN_AUTOMATION_EXECUTION_COMMUNICATION,
    CAMPAIGN_AUTOMATION_STATUS_BLOCKED,
    CAMPAIGN_AUTOMATION_STATUS_FAILED,
    CAMPAIGN_AUTOMATION_STATUS_SKIPPED,
    CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED,
    CAMPAIGN_DELIVERY_STATUS_FAILED,
    CAMPAIGN_DELIVERY_STATUS_SENT,
    CAMPAIGN_DELIVERY_STATUS_SKIPPED,
)
from app.features.campaigns.automation_repository import CampaignAutomationRepository
from app.features.campaigns.recipient_resolver import CampaignRecipientResolver
from app.features.campaigns.template_renderer import CampaignTemplateRenderer
from app.features.campaigns.studio_constants import COMMUNICATION_AUDIENCE_SPONSOR
from app.models.sponsor_constants import SPONSOR_INTERACTION_ORIGIN_CAMPAIGN_COMMUNICATION
from app.models.sponsor_interaction import SponsorInteraction
from app.models.sponsorship import Sponsorship


class CampaignAutomationDispatchService:
    def __init__(
        self,
        repository: CampaignAutomationRepository | None = None,
        recipient_resolver: CampaignRecipientResolver | None = None,
        template_renderer: CampaignTemplateRenderer | None = None,
    ) -> None:
        self.repository = repository or CampaignAutomationRepository()
        self.recipient_resolver = recipient_resolver or CampaignRecipientResolver()
        self.template_renderer = template_renderer or CampaignTemplateRenderer()

    def dispatch_schedule(self, db: Session, *, schedule_id: str) -> dict[str, object]:
        schedule = self.repository.get_schedule_for_dispatch(db, schedule_id=schedule_id)
        if schedule is None:
            return {"schedule_id": schedule_id, "status": CAMPAIGN_AUTOMATION_STATUS_SKIPPED}

        execution = self.repository.create_execution(
            db,
            campaign_id=schedule.campaign_id,
            schedule_id=schedule.id,
            execution_type=CAMPAIGN_AUTOMATION_EXECUTION_COMMUNICATION,
            action_key=CAMPAIGN_AUTOMATION_DISPATCH_ACTION,
        )

        if schedule.status != "SCHEDULED":
            self.repository.complete_execution(
                db,
                execution=execution,
                status=CAMPAIGN_AUTOMATION_STATUS_SKIPPED,
                details={"reason": "schedule_not_scheduled"},
            )
            db.commit()
            return {"schedule_id": str(schedule.id), "status": CAMPAIGN_AUTOMATION_STATUS_SKIPPED}

        if schedule.template is None or not schedule.template.is_active:
            return self._finish_blocked(
                db,
                schedule=schedule,
                execution=execution,
                reason="template_inactive",
                error_message="Communication template is missing or inactive.",
            )

        milestone = None
        if schedule.milestone_key:
            milestone = self.repository.get_campaign_milestone(
                db,
                campaign_id=str(schedule.campaign_id),
                milestone_key=schedule.milestone_key,
            )
            if milestone is None:
                return self._finish_blocked(
                    db,
                    schedule=schedule,
                    execution=execution,
                    reason="milestone_missing",
                    error_message="Linked milestone is missing for this communication schedule.",
                )

        recipients = self.recipient_resolver.resolve_for_audience(
            db,
            campaign_id=str(schedule.campaign_id),
            audience=schedule.template.audience,
        )
        if not recipients:
            return self._finish_blocked(
                db,
                schedule=schedule,
                execution=execution,
                reason="no_recipients",
                error_message="No recipients are currently available for this communication audience.",
            )

        delivered_count = 0
        failed_count = 0
        errors: list[str] = []
        sponsor_contacted_ids: list[str] = []
        for recipient in recipients:
            subject, html_body, text_body = self.template_renderer.render(
                campaign_name=schedule.campaign.name,
                campaign_year=schedule.campaign.year,
                subject_template=schedule.template.subject_template,
                body_template=schedule.template.body_template,
                merge_fields=recipient.merge_fields,
            )
            try:
                send_email_message(
                    recipients=[recipient.email],
                    subject=subject,
                    html=html_body,
                    text_body=text_body,
                )
                delivered_count += 1
                if recipient.sponsor_id:
                    sponsor_contacted_ids.append(recipient.sponsor_id)
            except Exception as exc:
                failed_count += 1
                if len(errors) < 5:
                    errors.append(f"{recipient.email}: {exc}")

        if schedule.template.audience == COMMUNICATION_AUDIENCE_SPONSOR:
            self._record_sponsor_communications(
                db,
                schedule=schedule,
                recipients=recipients,
                delivered_sponsor_ids=sponsor_contacted_ids,
                subject=subject if recipients else schedule.template.subject_template,
            )

        if delivered_count == 0:
            self.repository.mark_schedule_attempt(
                schedule,
                last_delivery_status=CAMPAIGN_DELIVERY_STATUS_FAILED,
                last_delivery_error="; ".join(errors) or "No recipients were delivered.",
                dispatched=False,
            )
            self.repository.complete_execution(
                db,
                execution=execution,
                status=CAMPAIGN_AUTOMATION_STATUS_FAILED,
                details={"errors": errors},
                error_message="All communication deliveries failed.",
                recipient_count=len(recipients),
                delivered_count=0,
                failed_count=failed_count,
            )
            db.commit()
            return {"schedule_id": str(schedule.id), "status": CAMPAIGN_AUTOMATION_STATUS_FAILED}

        status = (
            CAMPAIGN_AUTOMATION_STATUS_SUCCEEDED
            if failed_count == 0
            else CAMPAIGN_AUTOMATION_STATUS_FAILED
        )
        self.repository.mark_schedule_attempt(
            schedule,
            last_delivery_status=(
                CAMPAIGN_DELIVERY_STATUS_SENT
                if failed_count == 0
                else CAMPAIGN_DELIVERY_STATUS_FAILED
            ),
            last_delivery_error="; ".join(errors) if errors else None,
            dispatched=True,
        )
        self.repository.complete_execution(
            db,
            execution=execution,
            status=status,
            details={
                "milestone_key": schedule.milestone_key,
                "scheduled_for": schedule.scheduled_for.isoformat()
                if schedule.scheduled_for is not None
                else None,
                "dispatched_at": datetime.now(UTC).replace(tzinfo=None).isoformat(),
                "errors": errors,
            },
            error_message="; ".join(errors) if errors else None,
            recipient_count=len(recipients),
            delivered_count=delivered_count,
            failed_count=failed_count,
        )
        db.commit()
        return {"schedule_id": str(schedule.id), "status": status}

    def _finish_blocked(
        self,
        db: Session,
        *,
        schedule,
        execution,
        reason: str,
        error_message: str,
    ) -> dict[str, object]:
        self.repository.mark_schedule_attempt(
            schedule,
            last_delivery_status=CAMPAIGN_DELIVERY_STATUS_SKIPPED,
            last_delivery_error=error_message,
            dispatched=False,
        )
        self.repository.complete_execution(
            db,
            execution=execution,
            status=CAMPAIGN_AUTOMATION_STATUS_BLOCKED,
            details={"reason": reason},
            error_message=error_message,
        )
        db.commit()
        return {"schedule_id": str(schedule.id), "status": CAMPAIGN_AUTOMATION_STATUS_BLOCKED}

    def _record_sponsor_communications(
        self,
        db: Session,
        *,
        schedule,
        recipients,
        delivered_sponsor_ids: list[str],
        subject: str,
    ) -> None:
        occurred_at = datetime.now(UTC).replace(tzinfo=None)
        delivered_id_set = set(delivered_sponsor_ids)
        for recipient in recipients:
            if not recipient.sponsor_id:
                continue
            sponsorship = (
                db.query(Sponsorship)
                .filter(
                    Sponsorship.campaign_id == schedule.campaign_id,
                    Sponsorship.sponsor_id == recipient.sponsor_id,
                )
                .one_or_none()
            )
            if sponsorship is None:
                continue
            interaction = SponsorInteraction(
                id=uuid.uuid4(),
                campaign_id=schedule.campaign_id,
                sponsor_id=sponsorship.sponsor_id,
                channel="EMAIL",
                direction="OUTBOUND",
                subject=subject,
                origin_type=SPONSOR_INTERACTION_ORIGIN_CAMPAIGN_COMMUNICATION,
                outcome="COMPLETED" if recipient.sponsor_id in delivered_id_set else "BOUNCED",
                notes=f"Campaign schedule {schedule.id} delivered to sponsor audience.",
                occurred_at=occurred_at,
                related_sponsorship_id=sponsorship.id,
                related_schedule_id=schedule.id,
            )
            db.add(interaction)
            sponsorship.sponsor.last_contacted_at = occurred_at
