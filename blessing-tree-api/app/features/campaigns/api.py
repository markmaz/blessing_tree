from __future__ import annotations

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.decorators.security import token_required
from app.features.admin.audit_service import AuditEventService, build_changes
from app.features.campaigns import campaign_ns
from app.features.campaigns.serializers import (
    serialize_campaign,
    serialize_campaign_access,
    serialize_campaign_list_item,
    serialize_campaign_summary,
)
from app.features.campaigns.season_reflection_service import CampaignSeasonReflectionService
from app.features.campaigns.service import CampaignService
from app.features.rbac.decorators import require_app_admin, require_campaign_capability

_campaign_service = CampaignService()
_season_reflection_service = CampaignSeasonReflectionService(campaigns=_campaign_service)
_audit_event_service = AuditEventService()

CAMPAIGN_FIELD_MAP = {
    "name": "Name",
    "year": "Year",
    "description": "Description",
    "season_theme": "Campaign Purpose",
    "public_sponsor_slug": "Public Sponsor Slug",
    "public_sponsor_signup_enabled": "Public Sponsor Sign-up",
    "status": "Status",
    "start_date": "Start Date",
    "end_date": "End Date",
}


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
            response = serialize_campaign(campaign)
            _audit_event_service.record_event(
                db,
                area="campaigns",
                action="created",
                entity_type="campaign",
                entity_id=campaign.id,
                entity_label=campaign.name,
                campaign_id=campaign.id,
                actor_user_id=getattr(g, "user_id", None),
                summary=f"Created campaign {campaign.name}.",
                changes=build_changes(before={}, after=response, field_map=CAMPAIGN_FIELD_MAP),
            )
            db.commit()
        return response, 201


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
            before = serialize_campaign(campaign)
            updated = _campaign_service.update_campaign(
                db,
                campaign,
                payload,
                is_app_admin=_campaign_service.authorization.user_is_app_admin(db, getattr(g, "user_id")),
            )
            response = serialize_campaign(updated)
            changes = build_changes(before=before, after=response, field_map=CAMPAIGN_FIELD_MAP)
            _audit_event_service.record_event(
                db,
                area="campaigns",
                action="status_changed" if any(change["field"] == "status" for change in changes) else "updated",
                entity_type="campaign",
                entity_id=updated.id,
                entity_label=updated.name,
                campaign_id=updated.id,
                actor_user_id=getattr(g, "user_id", None),
                summary=f"Updated campaign {updated.name}.",
                changes=changes,
            )
            db.commit()
        return response


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
            summary = _campaign_service.get_campaign_summary(db, campaign_id, user_id=getattr(g, "user_id", None))
        return serialize_campaign_summary(campaign_id, summary["counts"], summary["widgets"])


@campaign_ns.route("/<string:campaign_id>/season-reflection")
class CampaignSeasonReflectionResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            exclude_pair_ids = {
                value.strip()
                for value in str(request.args.get("exclude_pair_ids") or "").split(",")
                if value.strip()
            }
            return _season_reflection_service.get_reflection(
                db,
                campaign_id,
                exclude_pair_ids=exclude_pair_ids,
            )


def _as_bool(value: str | None) -> bool:
    return str(value or "").strip().lower() in {"1", "true", "yes", "y", "on"}
