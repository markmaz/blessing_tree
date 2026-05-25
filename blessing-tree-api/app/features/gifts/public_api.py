from __future__ import annotations

from flask import request
from flask_restx import Resource

from app.db import SessionLocal
from app.exceptions.service_error import ServiceError
from app.features.gifts import GiftLabelService, GiftSearchService, serialize_gift_search_response
from app.features.gifts.serializers import serialize_public_scan_lookup
from app.features.public import public_ns
from app.models.campaign import Campaign

_gift_search_service = GiftSearchService()
_gift_label_service = GiftLabelService()


@public_ns.route("/campaigns/<string:public_slug>/gifts/search")
class PublicGiftSearchResource(Resource):
    @public_ns.doc(security=[])
    def get(self, public_slug: str):
        with SessionLocal() as db:
            campaign, parsed, results = _gift_search_service.search_public_gifts(
                db,
                public_slug,
                query=request.args.get("q", ""),
                filters=request.args.to_dict(flat=True),
                limit=_limit_arg(),
            )
        return serialize_gift_search_response(
            campaign_id=str(campaign.id),
            parsed_filters=parsed.to_dict(),
            results=results,
            public=True,
        )


@public_ns.route("/campaigns/<string:public_slug>/gifts/search/parse")
class PublicGiftSearchParseResource(Resource):
    @public_ns.doc(security=[])
    def post(self, public_slug: str):
        payload = request.get_json(silent=True) or {}
        parsed = _gift_search_service.parse(payload.get("query") or payload.get("q") or "")
        return {"public_slug": public_slug, "parsed_filters": parsed.to_dict()}


@public_ns.route("/gifts/scan/<string:label_code>")
class PublicGiftScanResource(Resource):
    @public_ns.doc(security=[])
    def get(self, label_code: str):
        with SessionLocal() as db:
            item = _gift_label_service.public_scan_lookup(db, label_code=label_code)
            campaign = db.get(Campaign, item.wishlist.campaign_id)
            if campaign is None:
                raise ServiceError("Campaign not found for gift label", status_code=404)
            response = serialize_public_scan_lookup(campaign, item)
        return response


@public_ns.route("/gifts/scan/<string:label_code>/actions")
class PublicGiftScanActionsResource(Resource):
    @public_ns.doc(security=[])
    def post(self, label_code: str):
        payload = request.get_json(silent=True) or {}
        action = str(payload.get("action") or "").strip()
        if not action:
            return {"error": "action is required", "details": {"field": "action"}}, 400
        with SessionLocal() as db:
            item = _gift_label_service.public_scan_action(
                db,
                label_code=label_code,
                action=action,
                notes=str(payload.get("notes") or "").strip() or None,
            )
            campaign = db.get(Campaign, item.wishlist.campaign_id)
            if campaign is None:
                raise ServiceError("Campaign not found for gift label", status_code=404)
            response = serialize_public_scan_lookup(campaign, item)
        return response


def _limit_arg() -> int:
    value = request.args.get("limit")
    if not value:
        return 100
    try:
        return int(value)
    except ValueError:
        return 100
