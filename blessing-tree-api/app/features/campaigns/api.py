from __future__ import annotations

from flask import g, request
from flask_restx import Namespace, Resource

from app.db import SessionLocal
from app.decorators.security import token_required
from app.features.campaigns.serializers import (
    serialize_campaign,
    serialize_campaign_access,
    serialize_campaign_list_item,
    serialize_campaign_summary,
)
from app.features.campaigns.service import CampaignService
from app.features.rbac.decorators import require_app_admin, require_campaign_capability

campaign_ns = Namespace("campaigns", description="Campaign operations")

_campaign_service = CampaignService()


@campaign_ns.route("")
class CampaignListResource(Resource):
    @token_required
    def get(self):
        with SessionLocal() as db:
            campaigns = _campaign_service.list_visible_campaigns(
                db,
                getattr(g, "user_id"),
                status=request.args.get("status"),
                year=request.args.get("year"),
                search=request.args.get("search"),
                include_archived=_as_bool(request.args.get("include_archived")),
            )
            payload = [
                serialize_campaign_list_item(
                    campaign,
                    serialize_campaign_access(
                        **_campaign_service.get_campaign_access_payload(db, getattr(g, "user_id"), str(campaign.id)),
                    ),
                )
                for campaign in campaigns
            ]
        return payload

    @require_app_admin()
    def post(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            campaign = _campaign_service.create_campaign(db, getattr(g, "user_id"), payload)
        return serialize_campaign(campaign), 201


@campaign_ns.route("/<string:campaign_id>")
class CampaignDetailResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            campaign = _campaign_service.get_campaign(db, campaign_id)
        return serialize_campaign(campaign)

    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            campaign = _campaign_service.get_campaign(db, campaign_id)
            updated = _campaign_service.update_campaign(
                db,
                campaign,
                payload,
                is_app_admin=_campaign_service.authorization.user_is_app_admin(db, getattr(g, "user_id")),
            )
        return serialize_campaign(updated)


@campaign_ns.route("/<string:campaign_id>/access")
class CampaignAccessResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _campaign_service.get_campaign_access_payload(db, getattr(g, "user_id"), campaign_id)
        return serialize_campaign_access(**payload)


@campaign_ns.route("/<string:campaign_id>/summary")
class CampaignSummaryResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            counts = _campaign_service.get_campaign_summary_counts(db, campaign_id)
        return serialize_campaign_summary(campaign_id, counts)


def _as_bool(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "on"}
