from __future__ import annotations

from flask import Response, g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.exceptions.service_error import ServiceError
from app.features.campaigns import campaign_ns
from app.features.gifts.sponsor_dropoff_service import SponsorDropoffService, build_dropoff_url, qr_png_bytes
from app.features.rbac.decorators import require_campaign_capability

_sponsor_dropoff_service = SponsorDropoffService()


@campaign_ns.route("/<string:campaign_id>/mobile/dropoff/<string:token>")
class CampaignMobileDropoffResource(Resource):
    @require_campaign_capability("campaign.gifts.check_in")
    def get(self, campaign_id: str, token: str):
        with SessionLocal() as db:
            try:
                payload = _sponsor_dropoff_service.resolve_payload(
                    db,
                    campaign_id=campaign_id,
                    token=token,
                    scanned_by_user_id=getattr(g, "user_id", None),
                    user_agent=request.headers.get("User-Agent"),
                )
                db.commit()
                return payload, 200
            except ServiceError:
                db.commit()
                raise


@campaign_ns.route("/mobile/dropoff-qr/<string:token>.png")
class CampaignMobileDropoffQrResource(Resource):
    def get(self, token: str):
        image_bytes = qr_png_bytes(build_dropoff_url(token, campaign_id=request.args.get("campaignId")))
        if not image_bytes:
            return {"error": "QR code could not be generated"}, 500
        return Response(
            image_bytes,
            mimetype="image/png",
            headers={
                "Cache-Control": "public, max-age=86400",
                "Content-Disposition": 'inline; filename="sponsor-dropoff-qr.png"',
            },
        )
