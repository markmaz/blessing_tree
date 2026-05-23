from __future__ import annotations

from flask import request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.campaigns import campaign_ns
from app.features.recipients import (
    CampaignRecipientService,
    serialize_group_contact,
    serialize_people_workspace,
    serialize_recipient,
    serialize_recipient_group,
    serialize_wishlist,
    serialize_wishlist_item,
)
from app.features.recipients.address_lookup_service import CampaignRecipientAddressLookupService
from app.features.rbac.decorators import require_campaign_capability

_recipient_service = CampaignRecipientService()
_address_lookup_service = CampaignRecipientAddressLookupService()


@campaign_ns.route("/<string:campaign_id>/people-workspace")
class CampaignPeopleWorkspaceResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _recipient_service.get_workspace_payload(db, campaign_id)
        return serialize_people_workspace(**payload)


@campaign_ns.route("/<string:campaign_id>/recipient-address-search")
class RecipientAddressSearchResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str):
        suggestions = _address_lookup_service.search(
            request.args.get("q", ""),
            country_code=request.args.get("country_code"),
        )
        return {"suggestions": suggestions}


@campaign_ns.route("/<string:campaign_id>/recipient-groups")
class RecipientGroupListResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            groups = _recipient_service.list_groups(
                db,
                campaign_id,
                search=request.args.get("search"),
                group_type=request.args.get("group_type"),
                status=request.args.get("status"),
            )
        return [serialize_recipient_group(group) for group in groups]

    @require_campaign_capability("campaign.recipients.edit")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            group = _recipient_service.create_group(db, campaign_id, payload)
        return serialize_recipient_group(group), 201


@campaign_ns.route("/<string:campaign_id>/recipient-groups/<string:group_id>")
class RecipientGroupDetailResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str, group_id: str):
        with SessionLocal() as db:
            group = _recipient_service.get_group(db, campaign_id, group_id)
        return serialize_recipient_group(group)

    @require_campaign_capability("campaign.recipients.edit")
    def patch(self, campaign_id: str, group_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            group = _recipient_service.update_group(db, campaign_id, group_id, payload)
        return serialize_recipient_group(group)

    @require_campaign_capability("campaign.recipients.edit")
    def delete(self, campaign_id: str, group_id: str):
        with SessionLocal() as db:
            _recipient_service.delete_group(db, campaign_id, group_id)
        return "", 204


@campaign_ns.route("/<string:campaign_id>/recipient-groups/<string:group_id>/contacts")
class RecipientGroupContactCreateResource(Resource):
    @require_campaign_capability("campaign.recipients.edit")
    def post(self, campaign_id: str, group_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            contact = _recipient_service.create_contact(db, campaign_id, group_id, payload)
        return serialize_group_contact(contact), 201


@campaign_ns.route("/<string:campaign_id>/recipient-groups/<string:group_id>/contacts/<string:contact_id>")
class RecipientGroupContactDetailResource(Resource):
    @require_campaign_capability("campaign.recipients.edit")
    def patch(self, campaign_id: str, group_id: str, contact_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            contact = _recipient_service.update_contact(db, campaign_id, group_id, contact_id, payload)
        return serialize_group_contact(contact)

    @require_campaign_capability("campaign.recipients.edit")
    def delete(self, campaign_id: str, group_id: str, contact_id: str):
        with SessionLocal() as db:
            _recipient_service.delete_contact(db, campaign_id, group_id, contact_id)
        return "", 204


@campaign_ns.route("/<string:campaign_id>/recipients")
class RecipientListResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            recipients = _recipient_service.list_recipients(
                db,
                campaign_id,
                search=request.args.get("search"),
                group_id=request.args.get("group_id"),
                program_type=request.args.get("program_type"),
                recipient_kind=request.args.get("recipient_kind"),
                status=request.args.get("status"),
            )
        return [serialize_recipient(recipient) for recipient in recipients]

    @require_campaign_capability("campaign.recipients.edit")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            recipient = _recipient_service.create_recipient(db, campaign_id, payload)
        return serialize_recipient(recipient), 201


@campaign_ns.route("/<string:campaign_id>/recipients/<string:recipient_id>")
class RecipientDetailResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str, recipient_id: str):
        with SessionLocal() as db:
            recipient = _recipient_service.get_recipient(db, campaign_id, recipient_id)
        return serialize_recipient(recipient)

    @require_campaign_capability("campaign.recipients.edit")
    def patch(self, campaign_id: str, recipient_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            recipient = _recipient_service.update_recipient(db, campaign_id, recipient_id, payload)
        return serialize_recipient(recipient)

    @require_campaign_capability("campaign.recipients.edit")
    def delete(self, campaign_id: str, recipient_id: str):
        with SessionLocal() as db:
            _recipient_service.delete_recipient(db, campaign_id, recipient_id)
        return "", 204


@campaign_ns.route("/<string:campaign_id>/recipients/<string:recipient_id>/wishlist")
class RecipientWishlistResource(Resource):
    @require_campaign_capability("campaign.recipients.view")
    def get(self, campaign_id: str, recipient_id: str):
        with SessionLocal() as db:
            wishlist = _recipient_service.get_wishlist(db, campaign_id, recipient_id)
        return serialize_wishlist(wishlist)

    @require_campaign_capability("campaign.recipients.edit")
    def put(self, campaign_id: str, recipient_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            wishlist = _recipient_service.upsert_wishlist(db, campaign_id, recipient_id, payload)
        return serialize_wishlist(wishlist)


@campaign_ns.route("/<string:campaign_id>/recipients/<string:recipient_id>/wishlist/items")
class RecipientWishlistItemCreateResource(Resource):
    @require_campaign_capability("campaign.recipients.edit")
    def post(self, campaign_id: str, recipient_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            item = _recipient_service.create_wishlist_item(db, campaign_id, recipient_id, payload)
        return serialize_wishlist_item(item), 201


@campaign_ns.route("/<string:campaign_id>/recipients/<string:recipient_id>/wishlist/items/<string:item_id>")
class RecipientWishlistItemDetailResource(Resource):
    @require_campaign_capability("campaign.recipients.edit")
    def patch(self, campaign_id: str, recipient_id: str, item_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            item = _recipient_service.update_wishlist_item(db, campaign_id, recipient_id, item_id, payload)
        return serialize_wishlist_item(item)

    @require_campaign_capability("campaign.recipients.edit")
    def delete(self, campaign_id: str, recipient_id: str, item_id: str):
        with SessionLocal() as db:
            _recipient_service.delete_wishlist_item(db, campaign_id, recipient_id, item_id)
        return "", 204
