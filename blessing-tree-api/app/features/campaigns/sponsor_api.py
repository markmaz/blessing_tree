from __future__ import annotations

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.admin.audit_service import AuditEventService, build_changes
from app.features.campaigns import campaign_ns
from app.features.campaigns.communication_send_service import CampaignCommunicationSendService
from app.features.rbac.decorators import require_campaign_capability
from app.features.sponsors import (
    CampaignSponsorService,
    serialize_pending_sponsor_registration,
    serialize_public_sponsor_verification_result,
    serialize_sponsor_interaction,
    serialize_sponsor_workspace,
    serialize_workspace_sponsor,
)
from app.features.sponsors.email_delivery import send_public_sponsor_verification_email_with_fallback

_sponsor_service = CampaignSponsorService()
_communication_send_service = CampaignCommunicationSendService()
_audit_event_service = AuditEventService()

SPONSOR_FIELD_MAP = {
    "first_name": "First Name",
    "last_name": "Last Name",
    "display_name": "Display Name",
    "organization_name": "Organization",
    "email": "Email",
    "phone": "Phone",
    "address_line1": "Address Line 1",
    "address_line2": "Address Line 2",
    "city": "City",
    "state": "State",
    "postal_code": "Postal Code",
    "preferred_contact": "Preferred Contact",
    "source": "Source",
    "source_detail": "Source Detail",
    "notes": "Notes",
    "is_active": "Active",
    "do_not_contact": "Do Not Contact",
    "status": "Campaign Status",
    "interest_status": "Interest Status",
    "drop_off_status": "Drop-Off Status",
    "drop_off_due_at": "Drop-Off Due At",
    "drop_off_completed_at": "Drop-Off Completed At",
    "self_registered": "Self Registered",
    "sponsor_code": "Sponsor Code",
    "participation_notes": "Participation Notes",
}

INTERACTION_FIELD_MAP = {
    "channel": "Channel",
    "direction": "Direction",
    "subject": "Subject",
    "origin_type": "Origin",
    "outcome": "Outcome",
    "notes": "Notes",
    "occurred_at": "Occurred At",
    "follow_up_at": "Follow-Up At",
}


@campaign_ns.route("/<string:campaign_id>/sponsor-workspace")
class CampaignSponsorWorkspaceResource(Resource):
    @require_campaign_capability("campaign.sponsors.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _sponsor_service.get_workspace_payload(db, campaign_id)
        return serialize_sponsor_workspace(**payload)


@campaign_ns.route("/<string:campaign_id>/sponsors")
class CampaignSponsorListResource(Resource):
    @require_campaign_capability("campaign.sponsors.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            sponsors = _sponsor_service.list_sponsors(
                db,
                campaign_id,
                search=request.args.get("search"),
                status=request.args.get("status"),
                interest_status=request.args.get("interest_status"),
                drop_off_status=request.args.get("drop_off_status"),
            )
        return [serialize_workspace_sponsor(sponsorship) for sponsorship in sponsors]

    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            sponsorship = _sponsor_service.create_sponsor(db, campaign_id, payload)
            response = serialize_workspace_sponsor(sponsorship)
            _record_sponsor_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="sponsor",
                entity_id=sponsorship.sponsor_id,
                entity_label=sponsorship.sponsor.display_name,
                summary=f"Created sponsor {sponsorship.sponsor.display_name}.",
                changes=build_changes(before={}, after=_snapshot_sponsorship(sponsorship), field_map=SPONSOR_FIELD_MAP),
                metadata={"sponsorship_id": str(sponsorship.id)},
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/sponsors/<string:sponsor_id>")
class CampaignSponsorDetailResource(Resource):
    @require_campaign_capability("campaign.sponsors.view")
    def get(self, campaign_id: str, sponsor_id: str):
        with SessionLocal() as db:
            sponsorship = _sponsor_service.get_sponsor(db, campaign_id, sponsor_id)
        return serialize_workspace_sponsor(sponsorship)

    @require_campaign_capability("campaign.sponsors.manage")
    def patch(self, campaign_id: str, sponsor_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _snapshot_sponsorship(_sponsor_service.get_sponsor(db, campaign_id, sponsor_id))
            sponsorship = _sponsor_service.update_sponsor(db, campaign_id, sponsor_id, payload)
            response = serialize_workspace_sponsor(sponsorship)
            _record_sponsor_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="sponsor",
                entity_id=sponsorship.sponsor_id,
                entity_label=sponsorship.sponsor.display_name,
                summary=f"Updated sponsor {sponsorship.sponsor.display_name}.",
                changes=build_changes(before=before, after=_snapshot_sponsorship(sponsorship), field_map=SPONSOR_FIELD_MAP),
                metadata={"sponsorship_id": str(sponsorship.id)},
            )
        return response

    @require_campaign_capability("campaign.sponsors.manage")
    def delete(self, campaign_id: str, sponsor_id: str):
        with SessionLocal() as db:
            before = _snapshot_sponsorship(_sponsor_service.get_sponsor(db, campaign_id, sponsor_id))
            _sponsor_service.delete_sponsor(db, campaign_id, sponsor_id)
            _record_sponsor_event(
                db,
                campaign_id=campaign_id,
                action="deleted",
                entity_type="sponsor",
                entity_id=sponsor_id,
                entity_label=str(before.get("display_name") or sponsor_id),
                summary=f"Deleted sponsor {before.get('display_name') or sponsor_id}.",
                metadata={"previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/sponsors/<string:sponsor_id>/interactions")
class CampaignSponsorInteractionListResource(Resource):
    @require_campaign_capability("campaign.sponsors.view")
    def get(self, campaign_id: str, sponsor_id: str):
        with SessionLocal() as db:
            interactions = _sponsor_service.list_interactions(db, campaign_id, sponsor_id)
        return [serialize_sponsor_interaction(interaction) for interaction in interactions]

    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str, sponsor_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            interaction = _sponsor_service.create_interaction(
                db,
                campaign_id,
                sponsor_id,
                payload,
                created_by_user_id=getattr(g, "user_id", None),
            )
            response = serialize_sponsor_interaction(interaction)
            _record_sponsor_event(
                db,
                campaign_id=campaign_id,
                action="created",
                entity_type="sponsor_interaction",
                entity_id=interaction.id,
                entity_label=interaction.subject or interaction.channel,
                summary=f"Added sponsor interaction for {interaction.sponsor.display_name if interaction.sponsor else sponsor_id}.",
                changes=build_changes(before={}, after=_snapshot_interaction(interaction), field_map=INTERACTION_FIELD_MAP),
                metadata={"sponsor_id": sponsor_id},
            )
        return response, 201


@campaign_ns.route("/<string:campaign_id>/sponsors/<string:sponsor_id>/interactions/<string:interaction_id>")
class CampaignSponsorInteractionDetailResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def patch(self, campaign_id: str, sponsor_id: str, interaction_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_interactions = _sponsor_service.list_interactions(db, campaign_id, sponsor_id)
            before_interaction = next((item for item in before_interactions if str(item.id) == str(interaction_id)), None)
            before = _snapshot_interaction(before_interaction) if before_interaction else {}
            interaction = _sponsor_service.update_interaction(db, campaign_id, sponsor_id, interaction_id, payload)
            response = serialize_sponsor_interaction(interaction)
            _record_sponsor_event(
                db,
                campaign_id=campaign_id,
                action="updated",
                entity_type="sponsor_interaction",
                entity_id=interaction.id,
                entity_label=interaction.subject or interaction.channel,
                summary=f"Updated sponsor interaction for {interaction.sponsor.display_name if interaction.sponsor else sponsor_id}.",
                changes=build_changes(before=before, after=_snapshot_interaction(interaction), field_map=INTERACTION_FIELD_MAP),
                metadata={"sponsor_id": sponsor_id},
            )
        return response

    @require_campaign_capability("campaign.sponsors.manage")
    def delete(self, campaign_id: str, sponsor_id: str, interaction_id: str):
        with SessionLocal() as db:
            before_interactions = _sponsor_service.list_interactions(db, campaign_id, sponsor_id)
            before_interaction = next((item for item in before_interactions if str(item.id) == str(interaction_id)), None)
            before = _snapshot_interaction(before_interaction) if before_interaction else {}
            _sponsor_service.delete_interaction(db, campaign_id, sponsor_id, interaction_id)
            _record_sponsor_event(
                db,
                campaign_id=campaign_id,
                action="deleted",
                entity_type="sponsor_interaction",
                entity_id=interaction_id,
                entity_label=str(before.get("subject") or before.get("channel") or interaction_id),
                summary=f"Deleted sponsor interaction for {before.get('sponsor_name') or sponsor_id}.",
                metadata={"sponsor_id": sponsor_id, "previous": before},
            )
        return "", 204


@campaign_ns.route("/<string:campaign_id>/sponsors/<string:sponsor_id>/communications/preview")
class CampaignSponsorCommunicationPreviewResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str, sponsor_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            return _communication_send_service.preview_sponsor_send(
                db,
                campaign_id=campaign_id,
                sponsor_id=sponsor_id,
                template_id=str(payload.get("template_id") or ""),
            ), 200


@campaign_ns.route("/<string:campaign_id>/sponsors/<string:sponsor_id>/communications/send")
class CampaignSponsorCommunicationSendResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str, sponsor_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            return _communication_send_service.send_sponsor_template(
                db,
                campaign_id=campaign_id,
                sponsor_id=sponsor_id,
                template_id=str(payload.get("template_id") or ""),
                created_by_user_id=getattr(g, "user_id", None),
            ), 200


@campaign_ns.route("/<string:campaign_id>/pending-sponsor-registrations")
class CampaignPendingSponsorRegistrationListResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            registrations = _sponsor_service.list_pending_registrations(db, campaign_id)
        return [serialize_pending_sponsor_registration(registration) for registration in registrations]


@campaign_ns.route("/<string:campaign_id>/pending-sponsor-registrations/<string:registration_id>/resend")
class CampaignPendingSponsorRegistrationResendResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str, registration_id: str):
        with SessionLocal() as db:
            registration = _sponsor_service.resend_pending_registration(db, campaign_id, registration_id)
            campaign_name = registration.campaign.name
            public_slug = registration.campaign.public_sponsor_slug
            response = serialize_pending_sponsor_registration(registration)
        email_sent = False
        if public_slug:
            email_sent = send_public_sponsor_verification_email_with_fallback(
                email=registration.email,
                display_name=registration.display_name or registration.email,
                campaign_name=campaign_name,
                public_slug=public_slug,
                verification_token=registration.verification_token,
            )
        return {
            "registration": response,
            "email_delivery_status": "sent" if email_sent else "failed",
            "message": (
                "Verification email resent."
                if email_sent
                else "Registration was refreshed, but the verification email could not be sent."
            ),
        }, 200


@campaign_ns.route("/<string:campaign_id>/pending-sponsor-registrations/<string:registration_id>/cancel")
class CampaignPendingSponsorRegistrationCancelResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str, registration_id: str):
        with SessionLocal() as db:
            registration = _sponsor_service.cancel_pending_registration(db, campaign_id, registration_id)
            response = serialize_pending_sponsor_registration(registration)
        return {"registration": response, "message": "Pending sponsor registration cancelled."}, 200


@campaign_ns.route("/<string:campaign_id>/pending-sponsor-registrations/<string:registration_id>/verify")
class CampaignPendingSponsorRegistrationVerifyResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str, registration_id: str):
        with SessionLocal() as db:
            result = _sponsor_service.manually_verify_pending_registration(db, campaign_id, registration_id)
            response = serialize_public_sponsor_verification_result(**result)
        return response, 200


def _actor_user_id() -> str | None:
    user_id = getattr(g, "user_id", None)
    return str(user_id) if user_id else None


def _record_sponsor_event(
    db,
    *,
    campaign_id: str,
    action: str,
    entity_type: str,
    entity_id: object,
    entity_label: str,
    summary: str,
    changes: list[dict[str, object]] | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    _audit_event_service.record_event(
        db,
        area="sponsors",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        campaign_id=campaign_id,
        actor_user_id=_actor_user_id(),
        summary=summary,
        changes=changes,
        metadata=metadata,
    )
    db.commit()


def _snapshot_sponsorship(sponsorship) -> dict[str, object]:
    sponsor = sponsorship.sponsor
    return {
        "first_name": sponsor.first_name,
        "last_name": sponsor.last_name,
        "display_name": sponsor.display_name,
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
        "do_not_contact": bool(sponsor.do_not_contact),
        "status": sponsorship.status,
        "interest_status": sponsorship.interest_status,
        "drop_off_status": sponsorship.drop_off_status,
        "drop_off_due_at": sponsorship.drop_off_due_at.isoformat() if sponsorship.drop_off_due_at else None,
        "drop_off_completed_at": (
            sponsorship.drop_off_completed_at.isoformat() if sponsorship.drop_off_completed_at else None
        ),
        "self_registered": bool(sponsorship.self_registered),
        "sponsor_code": sponsorship.sponsor_code,
        "participation_notes": sponsorship.notes,
    }


def _snapshot_interaction(interaction) -> dict[str, object]:
    return {
        "sponsor_name": interaction.sponsor.display_name if interaction.sponsor else None,
        "channel": interaction.channel,
        "direction": interaction.direction,
        "subject": interaction.subject,
        "origin_type": interaction.origin_type,
        "outcome": interaction.outcome,
        "notes": interaction.notes,
        "occurred_at": interaction.occurred_at.isoformat() if interaction.occurred_at else None,
        "follow_up_at": interaction.follow_up_at.isoformat() if interaction.follow_up_at else None,
    }
