from __future__ import annotations

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.campaigns import campaign_ns
from app.features.gifts.sponsor_dropoff_service import SponsorDropoffService
from app.features.rbac.decorators import require_campaign_capability

_sponsor_dropoff_service = SponsorDropoffService()


@campaign_ns.route("/<string:campaign_id>/mobile/dropoff/<string:token>")
class CampaignMobileDropoffResource(Resource):
    @require_campaign_capability("campaign.gifts.check_in")
    def get(self, campaign_id: str, token: str):
        with SessionLocal() as db:
            payload = _sponsor_dropoff_service.resolve_payload(
                db,
                campaign_id=campaign_id,
                token=token,
                scanned_by_user_id=getattr(g, "user_id", None),
                user_agent=request.headers.get("User-Agent"),
            )
            db.commit()
            return payload, 200
