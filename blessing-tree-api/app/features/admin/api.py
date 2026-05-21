from __future__ import annotations

from flask import g, request
from flask_restx import Namespace, Resource

from app.db import SessionLocal
from app.decorators.security import token_required
from app.features.admin.constants import LLM_PROVIDER_CATALOG
from app.features.admin.feature_flag_service import FeatureFlagService
from app.features.admin.health_service import AdminHealthService
from app.features.admin.invitation_service import AdminInvitationService
from app.features.admin.llm_service import AdminLlmService
from app.features.admin.serializers import (
    serialize_admin_user,
    serialize_feature_flag,
    serialize_invitation,
    serialize_llm_configuration,
)
from app.features.rbac.decorators import require_app_admin

admin_ns = Namespace("admin", description="Application administration operations")

_invitation_service = AdminInvitationService()
_llm_service = AdminLlmService()
_feature_flag_service = FeatureFlagService()
_health_service = AdminHealthService(llm_service=_llm_service)


@admin_ns.route("/users")
class AdminUsersResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            users = _invitation_service.list_users(db)
            invitations = _invitation_service.list_invitations(db)
            return {
                "users": [serialize_admin_user(user) for user in users],
                "invitations": [serialize_invitation(invitation) for invitation in invitations],
                "role_catalog": _invitation_service.list_global_role_catalog(),
            }, 200

    @token_required
    @require_app_admin()
    def post(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            user, invitation, invite_url = _invitation_service.create_invitation(
                db,
                payload,
                invited_by_user_id=getattr(g, "user_id", None),
            )
            return {
                "user": serialize_admin_user(user),
                "invitation": serialize_invitation(invitation, invite_url=invite_url),
            }, 201


@admin_ns.route("/users/<string:user_id>/status")
class AdminUserStatusResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, user_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            user = _invitation_service.update_user_status(
                db,
                user_id,
                is_active=bool(payload.get("is_active")),
            )
            return {"user": serialize_admin_user(user)}, 200


@admin_ns.route("/invitations/<string:invitation_id>/resend")
class AdminInvitationResendResource(Resource):
    @token_required
    @require_app_admin()
    def post(self, invitation_id: str):
        with SessionLocal() as db:
            invitation, invite_url = _invitation_service.resend_invitation(
                db,
                invitation_id,
                invited_by_user_id=getattr(g, "user_id", None),
            )
            return {
                "invitation": serialize_invitation(invitation, invite_url=invite_url),
            }, 200


@admin_ns.route("/llm")
class AdminLlmConfigResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            config = _llm_service.get_configuration(db)
            return {
                "configuration": serialize_llm_configuration(config),
                "provider_catalog": [dict(item) for item in LLM_PROVIDER_CATALOG],
            }, 200

    @token_required
    @require_app_admin()
    def put(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            config = _llm_service.save_configuration(db, payload)
            return {"configuration": serialize_llm_configuration(config)}, 200


@admin_ns.route("/llm/test")
class AdminLlmTestResource(Resource):
    @token_required
    @require_app_admin()
    def post(self):
        with SessionLocal() as db:
            return _llm_service.test_configuration(db), 200


@admin_ns.route("/health")
class AdminHealthResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            return _health_service.get_health(db), 200


@admin_ns.route("/features")
class AdminFeatureFlagsResource(Resource):
    @token_required
    def get(self):
        with SessionLocal() as db:
            flags = _feature_flag_service.list_flags(db)
            return {"features": [serialize_feature_flag(flag) for flag in flags]}, 200


@admin_ns.route("/features/<string:feature_key>")
class AdminFeatureFlagDetailResource(Resource):
    @token_required
    @require_app_admin()
    def put(self, feature_key: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            flag = _feature_flag_service.update_flag(
                db,
                feature_key,
                is_enabled=bool(payload.get("is_enabled")),
            )
            return {"feature": serialize_feature_flag(flag)}, 200
