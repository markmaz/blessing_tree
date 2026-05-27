from __future__ import annotations

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.decorators.security import token_required
from app.features.account import account_ns
from app.features.account.serializers import serialize_account_profile, serialize_account_settings
from app.features.account.service import AccountService

_account_service = AccountService()


@account_ns.route("/profile")
class AccountProfileResource(Resource):
    @token_required
    def get(self):
        with SessionLocal() as db:
            user = _account_service.get_profile(db, getattr(g, "user_id"))
            return {"profile": serialize_account_profile(user)}, 200

    @token_required
    def patch(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            user = _account_service.update_profile(db, getattr(g, "user_id"), payload)
            return {"profile": serialize_account_profile(user)}, 200


@account_ns.route("/profile/password")
class AccountProfilePasswordResource(Resource):
    @token_required
    def put(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            _account_service.change_password(db, getattr(g, "user_id"), payload)
            return {"status": "updated"}, 200


@account_ns.route("/settings")
class AccountSettingsResource(Resource):
    @token_required
    def get(self):
        with SessionLocal() as db:
            settings = _account_service.get_settings(db, getattr(g, "user_id"))
            return {"settings": serialize_account_settings(settings)}, 200

    @token_required
    def put(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            settings = _account_service.update_settings(db, getattr(g, "user_id"), payload)
            return {"settings": serialize_account_settings(settings)}, 200
