from __future__ import annotations

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.campaigns import campaign_ns
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
        return serialize_workspace_sponsor(sponsorship), 201


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
            sponsorship = _sponsor_service.update_sponsor(db, campaign_id, sponsor_id, payload)
        return serialize_workspace_sponsor(sponsorship)

    @require_campaign_capability("campaign.sponsors.manage")
    def delete(self, campaign_id: str, sponsor_id: str):
        with SessionLocal() as db:
            _sponsor_service.delete_sponsor(db, campaign_id, sponsor_id)
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
        return serialize_sponsor_interaction(interaction), 201


@campaign_ns.route("/<string:campaign_id>/sponsors/<string:sponsor_id>/interactions/<string:interaction_id>")
class CampaignSponsorInteractionDetailResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def patch(self, campaign_id: str, sponsor_id: str, interaction_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            interaction = _sponsor_service.update_interaction(db, campaign_id, sponsor_id, interaction_id, payload)
        return serialize_sponsor_interaction(interaction)

    @require_campaign_capability("campaign.sponsors.manage")
    def delete(self, campaign_id: str, sponsor_id: str, interaction_id: str):
        with SessionLocal() as db:
            _sponsor_service.delete_interaction(db, campaign_id, sponsor_id, interaction_id)
        return "", 204


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
