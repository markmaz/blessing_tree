from __future__ import annotations

import uuid

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.campaigns import campaign_ns
from app.features.gifts import (
    GiftLabelService,
    GiftOperationsService,
    GiftPoolService,
    GiftReminderService,
    GiftReportService,
    GiftReservationService,
    GiftSearchService,
    CampaignGiftTagTemplateService,
    serialize_gift_search_response,
)
from app.features.rbac.decorators import require_campaign_capability
from app.features.gifts.serializers import (
    serialize_donation,
    serialize_fulfillment,
    serialize_label_print_job,
    serialize_gift_pool_line,
    serialize_gift_pool_matches,
    serialize_gift_pool_response,
    serialize_gift_reminder_preview,
    serialize_gift_reminder_rule,
    serialize_gift_reminder_rules_response,
    serialize_gift_tag_template,
    serialize_gift_workflow_report,
    serialize_gift_operations_item,
    serialize_gift_operations_response,
    serialize_gift_search_item,
    serialize_scan_lookup,
)

_gift_search_service = GiftSearchService()
_gift_reservation_service = GiftReservationService()
_gift_operations_service = GiftOperationsService()
_gift_pool_service = GiftPoolService()
_gift_label_service = GiftLabelService(operations_service=_gift_operations_service)
_gift_reminder_service = GiftReminderService()
_gift_report_service = GiftReportService()
_gift_tag_template_service = CampaignGiftTagTemplateService()


@campaign_ns.route("/<string:campaign_id>/gifts/search")
class CampaignGiftSearchResource(Resource):
    @require_campaign_capability("campaign.gifts.search")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            parsed, results = _gift_search_service.search_staff_gifts(
                db,
                campaign_id,
                query=request.args.get("q", ""),
                filters=request.args.to_dict(flat=True),
                limit=_limit_arg(),
            )
        return serialize_gift_search_response(
            campaign_id=campaign_id,
            parsed_filters=parsed.to_dict(),
            results=results,
            public=False,
        )


@campaign_ns.route("/<string:campaign_id>/gifts/search/parse")
class CampaignGiftSearchParseResource(Resource):
    @require_campaign_capability("campaign.gifts.search")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        parsed = _gift_search_service.parse(payload.get("query") or payload.get("q") or "")
        return {"campaign_id": campaign_id, "parsed_filters": parsed.to_dict()}


@campaign_ns.route("/<string:campaign_id>/gifts/operations")
class CampaignGiftOperationsResource(Resource):
    @require_campaign_capability("campaign.gifts.check_in")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _gift_operations_service.get_operations_payload(
                db,
                campaign_id,
                status=request.args.get("status"),
                search=request.args.get("search"),
            )
        return serialize_gift_operations_response(**payload)


@campaign_ns.route("/<string:campaign_id>/gifts/reports/workflow")
class CampaignGiftWorkflowReportResource(Resource):
    @require_campaign_capability("campaign.reports.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            report = _gift_report_service.get_workflow_report(db, campaign_id=uuid.UUID(campaign_id))
            response = serialize_gift_workflow_report(report)
        return response


@campaign_ns.route("/<string:campaign_id>/gift-tag-template")
class CampaignGiftTagTemplateResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            template = _gift_tag_template_service.get_template(db, campaign_id)
            response = serialize_gift_tag_template(template)
        return {"template": response}

    @require_campaign_capability("campaign.admin")
    def put(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            template = _gift_tag_template_service.update_template(
                db,
                campaign_id=campaign_id,
                user_id=str(getattr(g, "user_id")) if getattr(g, "user_id", None) else None,
                payload=payload,
            )
            response = serialize_gift_tag_template(template)
        return {"template": response}


@campaign_ns.route("/<string:campaign_id>/gift-reminder-rules")
class CampaignGiftReminderRulesResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _gift_reminder_service.list_rules(db, campaign_id=uuid.UUID(campaign_id))
            response = serialize_gift_reminder_rules_response(**payload)
        return response

    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            rule = _gift_reminder_service.create_rule(
                db,
                campaign_id=uuid.UUID(campaign_id),
                payload=payload,
            )
            response = serialize_gift_reminder_rule(rule)
        return {"rule": response}, 201


@campaign_ns.route("/<string:campaign_id>/gift-reminder-rules/<string:rule_id>")
class CampaignGiftReminderRuleResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def patch(self, campaign_id: str, rule_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            rule = _gift_reminder_service.update_rule(
                db,
                campaign_id=uuid.UUID(campaign_id),
                rule_id=uuid.UUID(rule_id),
                payload=payload,
            )
            response = serialize_gift_reminder_rule(rule)
        return {"rule": response}


@campaign_ns.route("/<string:campaign_id>/gift-reminder-rules/<string:rule_id>/preview")
class CampaignGiftReminderPreviewResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str, rule_id: str):
        with SessionLocal() as db:
            preview = _gift_reminder_service.preview_rule(
                db,
                campaign_id=uuid.UUID(campaign_id),
                rule_id=uuid.UUID(rule_id),
            )
            response = serialize_gift_reminder_preview(preview)
        return response


@campaign_ns.route("/<string:campaign_id>/gift-reminder-rules/<string:rule_id>/send")
class CampaignGiftReminderSendResource(Resource):
    @require_campaign_capability("campaign.sponsors.manage")
    def post(self, campaign_id: str, rule_id: str):
        with SessionLocal() as db:
            result = _gift_reminder_service.send_rule(
                db,
                campaign_id=uuid.UUID(campaign_id),
                rule_id=uuid.UUID(rule_id),
                force=True,
            )
        return result


@campaign_ns.route("/<string:campaign_id>/gift-labels/print-jobs")
class CampaignGiftLabelPrintJobsResource(Resource):
    @require_campaign_capability("campaign.gifts.check_in")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        item_ids = payload.get("wishlist_item_ids") or []
        if not isinstance(item_ids, list):
            return {"error": "wishlist_item_ids must be a list", "details": {"field": "wishlist_item_ids"}}, 400
        with SessionLocal() as db:
            job = _gift_label_service.create_print_job(
                db,
                campaign_id=uuid.UUID(campaign_id),
                wishlist_item_ids=[uuid.UUID(str(item_id)) for item_id in item_ids],
                actor_user_id=_actor_user_id(),
                copies=int(payload.get("copies") or 1),
                manual_quantity=int(payload.get("manual_quantity") or 0),
                label_format=str(payload.get("format") or "TAPE"),
                printer_name=str(payload.get("printer_name") or "").strip() or None,
                notes=str(payload.get("notes") or "").strip() or None,
            )
            response = serialize_label_print_job(job)
        return {"print_job": response}, 201


@campaign_ns.route("/<string:campaign_id>/gift-labels/print-jobs/<string:job_id>")
class CampaignGiftLabelPrintJobResource(Resource):
    @require_campaign_capability("campaign.gifts.check_in")
    def get(self, campaign_id: str, job_id: str):
        with SessionLocal() as db:
            job = _gift_label_service.get_print_job(
                db,
                campaign_id=uuid.UUID(campaign_id),
                job_id=uuid.UUID(job_id),
            )
            response = serialize_label_print_job(job)
        return {"print_job": response}


@campaign_ns.route("/<string:campaign_id>/gifts/scan/<string:label_code>")
class CampaignGiftScanResource(Resource):
    @require_campaign_capability("campaign.gifts.check_in")
    def get(self, campaign_id: str, label_code: str):
        with SessionLocal() as db:
            item = _gift_label_service.scan_lookup(
                db,
                campaign_id=uuid.UUID(campaign_id),
                label_code=label_code,
                actor_user_id=_actor_user_id(),
            )
            response = serialize_scan_lookup(item)
        return response


@campaign_ns.route("/<string:campaign_id>/gifts/scan/<string:label_code>/actions")
class CampaignGiftScanActionsResource(Resource):
    @require_campaign_capability("campaign.gifts.check_in")
    def post(self, campaign_id: str, label_code: str):
        payload = request.get_json(silent=True) or {}
        action = str(payload.get("action") or "").strip()
        if not action:
            return {"error": "action is required", "details": {"field": "action"}}, 400
        with SessionLocal() as db:
            item = _gift_label_service.scan_action(
                db,
                campaign_id=uuid.UUID(campaign_id),
                label_code=label_code,
                action=action,
                actor_user_id=_actor_user_id(),
                notes=str(payload.get("notes") or "").strip() or None,
            )
            response = serialize_scan_lookup(item)
        return response


@campaign_ns.route("/<string:campaign_id>/gift-pool")
class CampaignGiftPoolResource(Resource):
    @require_campaign_capability("campaign.gifts.pool.manage")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _gift_pool_service.get_pool(
                db,
                campaign_id,
                status=request.args.get("status"),
                search=request.args.get("search"),
            )
        return serialize_gift_pool_response(**payload)


@campaign_ns.route("/<string:campaign_id>/donations")
class CampaignDonationsResource(Resource):
    @require_campaign_capability("campaign.gifts.pool.manage")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            donation = _gift_pool_service.create_donation(
                db,
                campaign_id=uuid.UUID(campaign_id),
                actor_user_id=_actor_user_id(),
                payload=payload,
            )
            response = serialize_donation(donation)
        return {"donation": response}, 201


@campaign_ns.route("/<string:campaign_id>/donations/<string:donation_id>/lines")
class CampaignDonationLinesResource(Resource):
    @require_campaign_capability("campaign.gifts.pool.manage")
    def post(self, campaign_id: str, donation_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            line = _gift_pool_service.create_donation_line(
                db,
                campaign_id=uuid.UUID(campaign_id),
                donation_id=uuid.UUID(donation_id),
                actor_user_id=_actor_user_id(),
                payload=payload,
            )
            response = serialize_gift_pool_line(line)
        return {"line": response}, 201


@campaign_ns.route("/<string:campaign_id>/donation-lines/<string:line_id>")
class CampaignDonationLineResource(Resource):
    @require_campaign_capability("campaign.gifts.pool.manage")
    def patch(self, campaign_id: str, line_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            line = _gift_pool_service.update_donation_line(
                db,
                campaign_id=uuid.UUID(campaign_id),
                line_id=uuid.UUID(line_id),
                payload=payload,
            )
            response = serialize_gift_pool_line(line)
        return {"line": response}


@campaign_ns.route("/<string:campaign_id>/donation-lines/<string:line_id>/matches")
class CampaignDonationLineMatchesResource(Resource):
    @require_campaign_capability("campaign.gifts.pool.manage")
    def get(self, campaign_id: str, line_id: str):
        with SessionLocal() as db:
            matches = _gift_pool_service.get_matches(
                db,
                campaign_id=uuid.UUID(campaign_id),
                line_id=uuid.UUID(line_id),
                limit=_limit_arg(),
            )
            response = serialize_gift_pool_matches(matches)
        return response


@campaign_ns.route("/<string:campaign_id>/donation-lines/<string:line_id>/assign")
class CampaignDonationLineAssignResource(Resource):
    @require_campaign_capability("campaign.gifts.pool.manage")
    def post(self, campaign_id: str, line_id: str):
        payload = request.get_json(silent=True) or {}
        wishlist_item_id = str(payload.get("wishlist_item_id") or "").strip()
        if not wishlist_item_id:
            return {"error": "wishlist_item_id is required", "details": {"field": "wishlist_item_id"}}, 400
        with SessionLocal() as db:
            fulfillment = _gift_pool_service.assign_line(
                db,
                campaign_id=uuid.UUID(campaign_id),
                line_id=uuid.UUID(line_id),
                wishlist_item_id=uuid.UUID(wishlist_item_id),
                quantity=payload.get("quantity") or 1,
                actor_user_id=_actor_user_id(),
                notes=str(payload.get("notes") or "").strip() or None,
            )
            db.refresh(fulfillment.donation_line)
            response = {
                "fulfillment": serialize_fulfillment(fulfillment),
                "line": serialize_gift_pool_line(fulfillment.donation_line),
                "gift": serialize_gift_search_item(fulfillment.wishlist_item, public=False),
            }
        return response, 201


@campaign_ns.route("/<string:campaign_id>/gifts/<string:wishlist_item_id>/commit")
class CampaignGiftCommitResource(Resource):
    @require_campaign_capability("campaign.gifts.commit")
    def post(self, campaign_id: str, wishlist_item_id: str):
        payload = request.get_json(silent=True) or {}
        sponsor_id = str(payload.get("sponsor_id") or "").strip()
        if not sponsor_id:
            return {"error": "sponsor_id is required", "details": {"field": "sponsor_id"}}, 400
        with SessionLocal() as db:
            sponsorship_item = _gift_reservation_service.staff_commit_gift(
                db,
                campaign_id=uuid.UUID(campaign_id),
                wishlist_item_id=uuid.UUID(wishlist_item_id),
                sponsor_id=uuid.UUID(sponsor_id),
                committed_by_user_id=uuid.UUID(str(g.user_id)) if getattr(g, "user_id", None) else None,
                notes=str(payload.get("notes") or "").strip() or None,
            )
            gift_payload = serialize_gift_search_item(sponsorship_item.wishlist_item, public=False)
        return {"gift": gift_payload, "sponsorship_item_id": str(sponsorship_item.id)}, 201


@campaign_ns.route("/<string:campaign_id>/gifts/<string:wishlist_item_id>/release")
class CampaignGiftReleaseResource(Resource):
    @require_campaign_capability("campaign.gifts.commit")
    def post(self, campaign_id: str, wishlist_item_id: str):
        with SessionLocal() as db:
            item = _gift_reservation_service.release_gift(
                db,
                campaign_id=uuid.UUID(campaign_id),
                wishlist_item_id=uuid.UUID(wishlist_item_id),
            )
            payload = serialize_gift_search_item(item, public=False)
        return {"gift": payload}


@campaign_ns.route("/<string:campaign_id>/gifts/<string:wishlist_item_id>/receive")
class CampaignGiftReceiveResource(Resource):
    @require_campaign_capability("campaign.gifts.check_in")
    def post(self, campaign_id: str, wishlist_item_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            item = _gift_operations_service.receive_gift(
                db,
                campaign_id=uuid.UUID(campaign_id),
                wishlist_item_id=uuid.UUID(wishlist_item_id),
                actor_user_id=_actor_user_id(),
                storage_location_id=uuid.UUID(str(payload["storage_location_id"])) if payload.get("storage_location_id") else None,
                notes=str(payload.get("notes") or "").strip() or None,
            )
            response = serialize_gift_operations_item(item)
        return {"gift": response}


@campaign_ns.route("/<string:campaign_id>/gifts/<string:wishlist_item_id>/wrap")
class CampaignGiftWrapResource(Resource):
    @require_campaign_capability("campaign.gifts.wrap")
    def post(self, campaign_id: str, wishlist_item_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            item = _gift_operations_service.wrap_gift(
                db,
                campaign_id=uuid.UUID(campaign_id),
                wishlist_item_id=uuid.UUID(wishlist_item_id),
                actor_user_id=_actor_user_id(),
                notes=str(payload.get("notes") or "").strip() or None,
            )
            response = serialize_gift_operations_item(item)
        return {"gift": response}


@campaign_ns.route("/<string:campaign_id>/gifts/<string:wishlist_item_id>/ready")
class CampaignGiftReadyResource(Resource):
    @require_campaign_capability("campaign.gifts.wrap")
    def post(self, campaign_id: str, wishlist_item_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            item = _gift_operations_service.mark_ready(
                db,
                campaign_id=uuid.UUID(campaign_id),
                wishlist_item_id=uuid.UUID(wishlist_item_id),
                actor_user_id=_actor_user_id(),
                notes=str(payload.get("notes") or "").strip() or None,
            )
            response = serialize_gift_operations_item(item)
        return {"gift": response}


@campaign_ns.route("/<string:campaign_id>/gifts/<string:wishlist_item_id>/pickup")
class CampaignGiftPickupResource(Resource):
    @require_campaign_capability("campaign.gifts.distribute")
    def post(self, campaign_id: str, wishlist_item_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            item = _gift_operations_service.mark_picked_up(
                db,
                campaign_id=uuid.UUID(campaign_id),
                wishlist_item_id=uuid.UUID(wishlist_item_id),
                actor_user_id=_actor_user_id(),
                notes=str(payload.get("notes") or "").strip() or None,
            )
            response = serialize_gift_operations_item(item)
        return {"gift": response}


@campaign_ns.route("/<string:campaign_id>/gifts/<string:wishlist_item_id>/exception")
class CampaignGiftExceptionResource(Resource):
    @require_campaign_capability("campaign.gifts.distribute")
    def post(self, campaign_id: str, wishlist_item_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            item = _gift_operations_service.mark_exception(
                db,
                campaign_id=uuid.UUID(campaign_id),
                wishlist_item_id=uuid.UUID(wishlist_item_id),
                actor_user_id=_actor_user_id(),
                notes=str(payload.get("notes") or "").strip() or None,
            )
            response = serialize_gift_operations_item(item)
        return {"gift": response}


def _limit_arg() -> int:
    value = request.args.get("limit")
    if not value:
        return 100
    try:
        return int(value)
    except ValueError:
        return 100


def _actor_user_id() -> uuid.UUID | None:
    user_id = getattr(g, "user_id", None)
    return uuid.UUID(str(user_id)) if user_id else None
