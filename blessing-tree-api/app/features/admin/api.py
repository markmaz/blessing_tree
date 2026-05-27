from __future__ import annotations

import uuid
from datetime import datetime

from flask import g, request
from flask_restx import Namespace, Resource
from sqlalchemy import or_

from app.db import SessionLocal
from app.decorators.security import token_required
from app.features.admin.campaign_operations_serializers import (
    serialize_milestone_definition,
    serialize_readiness_rule,
)
from app.features.admin.campaign_operations_service import CampaignOperationsAdminService
from app.features.admin.constants import LLM_PROVIDER_CATALOG
from app.features.admin.feature_flag_service import FeatureFlagService
from app.features.admin.health_service import AdminHealthService
from app.features.admin.invitation_service import AdminInvitationService
from app.features.admin.llm_service import AdminLlmService
from app.features.admin.serializers import (
    serialize_admin_user_campaign_access,
    serialize_admin_user,
    serialize_feature_flag,
    serialize_invitation,
    serialize_llm_configuration,
)
from app.features.admin.user_access_service import AdminUserAccessService
from app.features.rbac.decorators import require_app_admin
from app.models.app_user import AppUser
from app.models.ask_prompt_log import AskPromptLog
from app.models.campaign import Campaign

admin_ns = Namespace("admin", description="Application administration operations")

_invitation_service = AdminInvitationService()
_llm_service = AdminLlmService()
_feature_flag_service = FeatureFlagService()
_health_service = AdminHealthService(llm_service=_llm_service)
_campaign_operations_service = CampaignOperationsAdminService()
_user_access_service = AdminUserAccessService()


def _serialize_ask_prompt_log(row: tuple[AskPromptLog, Campaign | None, AppUser | None]) -> dict[str, object]:
    log, campaign, user = row
    return {
        "id": str(log.id),
        "campaign_id": str(log.campaign_id),
        "campaign_name": campaign.name if campaign is not None else None,
        "user_id": str(log.user_id) if log.user_id else None,
        "user_name": user.display_name if user is not None else None,
        "prompt": log.prompt,
        "result_kind": log.result_kind,
        "result_key": log.result_key,
        "confidence": log.confidence,
        "source": log.source,
        "response_summary": log.response_summary_json or {},
        "feedback_rating": log.feedback_rating,
        "feedback_comment": log.feedback_comment,
        "feedback_at": log.feedback_at.isoformat() if log.feedback_at else None,
        "reviewed_at": log.reviewed_at.isoformat() if log.reviewed_at else None,
        "reviewed_by_user_id": str(log.reviewed_by_user_id) if log.reviewed_by_user_id else None,
        "review_note": log.review_note,
        "created_at": log.created_at.isoformat() if log.created_at else None,
    }


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


@admin_ns.route("/ask/review")
class AdminAskReviewResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        review_only = str(request.args.get("review_only") or "true").lower() != "false"
        try:
            limit = min(max(int(request.args.get("limit") or 100), 1), 500)
        except ValueError:
            limit = 100
        with SessionLocal() as db:
            query = (
                db.query(AskPromptLog, Campaign, AppUser)
                .outerjoin(Campaign, Campaign.id == AskPromptLog.campaign_id)
                .outerjoin(AppUser, AppUser.id == AskPromptLog.user_id)
                .order_by(AskPromptLog.created_at.desc())
            )
            if review_only:
                query = query.filter(
                    AskPromptLog.reviewed_at.is_(None),
                    or_(
                        AskPromptLog.feedback_rating == "NEGATIVE",
                        AskPromptLog.confidence < 0.55,
                        AskPromptLog.result_kind == "clarification",
                    )
                )
            rows = query.limit(limit).all()
            return {
                "logs": [_serialize_ask_prompt_log(row) for row in rows],
                "review_only": review_only,
                "limit": limit,
            }, 200


@admin_ns.route("/ask/review/<string:prompt_log_id>")
class AdminAskReviewDetailResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, prompt_log_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            log = db.get(AskPromptLog, uuid.UUID(prompt_log_id))
            if log is None:
                return {"error": "Ask prompt log not found"}, 404
            log.reviewed_at = datetime.utcnow()
            log.reviewed_by_user_id = uuid.UUID(str(g.user_id)) if getattr(g, "user_id", None) else None
            log.review_note = str(payload.get("review_note") or "").strip()[:1000] or None
            db.commit()
            row = (
                db.query(AskPromptLog, Campaign, AppUser)
                .outerjoin(Campaign, Campaign.id == AskPromptLog.campaign_id)
                .outerjoin(AppUser, AppUser.id == AskPromptLog.user_id)
                .filter(AskPromptLog.id == log.id)
                .one()
            )
            return {"log": _serialize_ask_prompt_log(row)}, 200


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


@admin_ns.route("/users/<string:user_id>")
class AdminUserResource(Resource):
    @token_required
    @require_app_admin()
    def delete(self, user_id: str):
        with SessionLocal() as db:
            _invitation_service.delete_user(
                db,
                user_id,
                requested_by_user_id=getattr(g, "user_id", None),
            )
            return "", 204


@admin_ns.route("/users/<string:user_id>/role")
class AdminUserRoleResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, user_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            user = _invitation_service.update_user_role(db, user_id, payload.get("role"))
            return {"user": serialize_admin_user(user)}, 200


@admin_ns.route("/users/<string:user_id>/campaign-access")
class AdminUserCampaignAccessResource(Resource):
    @token_required
    @require_app_admin()
    def get(self, user_id: str):
        with SessionLocal() as db:
            payload = _user_access_service.get_user_campaign_access(db, user_id)
            return serialize_admin_user_campaign_access(payload), 200

    @token_required
    @require_app_admin()
    def put(self, user_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            access_payload = _user_access_service.replace_user_campaign_access(db, user_id, payload)
            return serialize_admin_user_campaign_access(access_payload), 200


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


@admin_ns.route("/llm/models")
class AdminLlmModelsResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            return _llm_service.list_available_models(db), 200


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


@admin_ns.route("/campaign-operations/milestone-definitions")
class AdminCampaignMilestoneDefinitionListResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            definitions = _campaign_operations_service.list_milestone_definitions(db)
            return {
                "milestone_definitions": [
                    serialize_milestone_definition(definition)
                    for definition in definitions
                ]
            }, 200

    @token_required
    @require_app_admin()
    def post(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            definition = _campaign_operations_service.create_milestone_definition(db, payload)
            return {"milestone_definition": serialize_milestone_definition(definition)}, 201


@admin_ns.route("/campaign-operations/milestone-definitions/<string:definition_id>")
class AdminCampaignMilestoneDefinitionDetailResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, definition_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            definition = _campaign_operations_service.update_milestone_definition(db, definition_id, payload)
            return {"milestone_definition": serialize_milestone_definition(definition)}, 200


@admin_ns.route("/campaign-operations/readiness-rules")
class AdminCampaignReadinessRuleListResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            rules = _campaign_operations_service.list_readiness_rules(db)
            return {"readiness_rules": [serialize_readiness_rule(rule) for rule in rules]}, 200

    @token_required
    @require_app_admin()
    def post(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            rule = _campaign_operations_service.create_readiness_rule(db, payload)
            return {"readiness_rule": serialize_readiness_rule(rule)}, 201


@admin_ns.route("/campaign-operations/readiness-rules/<string:rule_id>")
class AdminCampaignReadinessRuleDetailResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, rule_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            rule = _campaign_operations_service.update_readiness_rule(db, rule_id, payload)
            return {"readiness_rule": serialize_readiness_rule(rule)}, 200


@admin_ns.route("/campaign-operations/readiness-rule-options")
class AdminCampaignReadinessRuleOptionsResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            options = _campaign_operations_service.readiness_rule_options(db)
            return {
                **{key: value for key, value in options.items() if key != "milestone_definitions"},
                "milestone_definitions": [
                    serialize_milestone_definition(definition)
                    for definition in options["milestone_definitions"]
                ],
            }, 200
