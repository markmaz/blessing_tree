from __future__ import annotations

import uuid

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.ask.service import AskBlessingTreeService
from app.features.campaigns import campaign_ns
from app.features.rbac.decorators import require_campaign_capability

_ask_service = AskBlessingTreeService()


@campaign_ns.route("/<string:campaign_id>/ask")
class CampaignAskResource(Resource):
    @require_campaign_capability("campaign.view")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            response = _ask_service.ask(
                db,
                campaign_id=uuid.UUID(campaign_id),
                user_id=uuid.UUID(str(g.user_id)) if getattr(g, "user_id", None) else None,
                prompt=str(payload.get("prompt") or ""),
                include_debug=bool(payload.get("include_debug")),
            )
        return response


@campaign_ns.route("/<string:campaign_id>/ask/<string:prompt_log_id>/feedback")
class CampaignAskFeedbackResource(Resource):
    @require_campaign_capability("campaign.view")
    def post(self, campaign_id: str, prompt_log_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            log = _ask_service.record_feedback(
                db,
                campaign_id=uuid.UUID(campaign_id),
                prompt_log_id=uuid.UUID(prompt_log_id),
                rating=str(payload.get("rating") or ""),
                comment=str(payload.get("comment") or ""),
            )
        return {
            "prompt_log_id": str(log.id),
            "feedback_rating": log.feedback_rating,
            "feedback_at": log.feedback_at.isoformat() if log.feedback_at else None,
        }
