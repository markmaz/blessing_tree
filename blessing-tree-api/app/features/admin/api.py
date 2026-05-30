from __future__ import annotations

import uuid
from datetime import datetime

from flask import g, request
from flask_restx import Namespace, Resource
from sqlalchemy import or_

from app.db import SessionLocal
from app.decorators.security import token_required
from app.exceptions.service_error import ServiceError
from app.features.admin.audit_service import AuditEventService, build_changes
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
from app.features.recipients.organization_type_service import OrganizationTypeService
from app.features.recipients.serializers import serialize_organization_type
from app.features.admin.user_access_service import AdminUserAccessService
from app.features.rbac.decorators import require_app_admin
from app.models.app_feature_flag import AppFeatureFlag
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
_organization_type_service = OrganizationTypeService()
_audit_event_service = AuditEventService()


def _parse_positive_int_arg(name: str, default: int, maximum: int) -> int:
    raw_value = request.args.get(name)
    if raw_value is None:
        return default
    try:
        return min(max(int(raw_value), 1), maximum)
    except ValueError as exc:
        raise ServiceError(f"Invalid {name}", status_code=400, details={name: raw_value}) from exc


def _parse_datetime_arg(name: str) -> datetime | None:
    raw_value = request.args.get(name)
    if not raw_value:
        return None
    try:
        return datetime.fromisoformat(raw_value.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError as exc:
        raise ServiceError(f"Invalid {name}", status_code=400, details={name: raw_value}) from exc


def _current_actor_id() -> str | None:
    user_id = getattr(g, "user_id", None)
    return str(user_id) if user_id else None


def _record_admin_event(
    db,
    *,
    action: str,
    entity_type: str,
    summary: str,
    entity_id: object | None = None,
    entity_label: str | None = None,
    changes: list[dict[str, object]] | None = None,
    metadata: dict[str, object] | None = None,
) -> None:
    _audit_event_service.record_event(
        db,
        area="admin",
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        entity_label=entity_label,
        actor_user_id=_current_actor_id(),
        summary=summary,
        changes=changes,
        metadata=metadata,
    )
    db.commit()


def _snapshot_user(user: AppUser) -> dict[str, object]:
    return {
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "is_active": bool(user.is_active),
    }


def _get_user_snapshot(db, user_id: str) -> dict[str, object] | None:
    try:
        user_uuid = uuid.UUID(str(user_id))
    except (TypeError, ValueError, AttributeError):
        return None
    user = db.get(AppUser, user_uuid)
    return _snapshot_user(user) if user else None


def _snapshot_feature_flag(flag) -> dict[str, object]:
    return {
        "feature_key": flag.feature_key,
        "label": flag.label,
        "description": flag.description,
        "is_enabled": bool(flag.is_enabled),
    }


def _snapshot_llm_config(config) -> dict[str, object]:
    if config is None:
        return {}
    return {
        "provider": config.provider,
        "label": config.label,
        "base_url": config.base_url,
        "model": config.model,
        "api_key_configured": bool(config.api_key_encrypted),
        "is_enabled": bool(config.is_enabled),
    }


def _snapshot_organization_type(organization_type) -> dict[str, object]:
    return {
        "code": organization_type.code,
        "label": organization_type.label,
        "recipient_category": organization_type.recipient_category,
        "is_active": bool(organization_type.is_active),
        "sort_order": organization_type.sort_order,
    }


def _snapshot_milestone_definition(definition) -> dict[str, object]:
    return {
        "milestone_key": definition.milestone_key,
        "label": definition.label,
        "description": definition.description,
        "feature_area": definition.feature_area,
        "default_sort_order": definition.default_sort_order,
        "is_active": bool(definition.is_active),
    }


def _snapshot_readiness_rule(rule) -> dict[str, object]:
    return {
        "rule_key": rule.rule_key,
        "name": rule.name,
        "description": rule.description,
        "feature_area": rule.feature_area,
        "condition_type": rule.condition_type,
        "condition_config_json": rule.condition_config_json,
        "milestone_key": rule.milestone_key,
        "severity": rule.severity,
        "category": rule.category,
        "blocking_for_json": rule.blocking_for_json,
        "section": rule.section,
        "action_label": rule.action_label,
        "message": rule.message,
        "is_active": bool(rule.is_active),
    }


def _campaign_access_summary(payload: dict[str, object]) -> dict[str, list[str]]:
    summary: dict[str, list[str]] = {}
    for row in payload.get("campaigns", []):
        campaign = row.get("campaign") if isinstance(row, dict) else None
        if campaign is None:
            continue
        campaign_name = getattr(campaign, "name", None) or str(getattr(campaign, "id", "Campaign"))
        summary[campaign_name] = list(row.get("role_keys", []))
    return summary


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
            _record_admin_event(
                db,
                action="created",
                entity_type="app_user",
                entity_id=user.id,
                entity_label=user.display_name,
                summary=f"Invited user {user.display_name}.",
                changes=build_changes(
                    before={},
                    after=_snapshot_user(user),
                    field_map={
                        "email": "Email",
                        "display_name": "Display Name",
                        "role": "Global Role",
                        "is_active": "Active",
                    },
                ),
                metadata={"invitation_id": str(invitation.id)},
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
            _record_admin_event(
                db,
                action="updated",
                entity_type="ask_prompt_log",
                entity_id=log.id,
                entity_label=log.prompt[:120],
                summary="Marked an Ask Blessing Tree prompt as reviewed.",
                changes=[
                    {
                        "field": "reviewed_at",
                        "label": "Reviewed At",
                        "before": None,
                        "after": log.reviewed_at.isoformat() if log.reviewed_at else None,
                    },
                    {
                        "field": "review_note",
                        "label": "Review Note",
                        "before": None,
                        "after": log.review_note,
                    },
                ],
            )
            row = (
                db.query(AskPromptLog, Campaign, AppUser)
                .outerjoin(Campaign, Campaign.id == AskPromptLog.campaign_id)
                .outerjoin(AppUser, AppUser.id == AskPromptLog.user_id)
                .filter(AskPromptLog.id == log.id)
                .one()
            )
            return {"log": _serialize_ask_prompt_log(row)}, 200


@admin_ns.route("/audit-events")
class AdminAuditEventListResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            return _audit_event_service.list_events(
                db,
                page=_parse_positive_int_arg("page", 1, 10_000),
                page_size=_parse_positive_int_arg("page_size", 25, 100),
                date_from=_parse_datetime_arg("date_from"),
                date_to=_parse_datetime_arg("date_to"),
                actor_user_id=request.args.get("actor_user_id"),
                campaign_id=request.args.get("campaign_id"),
                area=request.args.get("area"),
                action=request.args.get("action"),
                entity_type=request.args.get("entity_type"),
                search=request.args.get("search"),
            ), 200


@admin_ns.route("/audit-events/<string:event_id>")
class AdminAuditEventDetailResource(Resource):
    @token_required
    @require_app_admin()
    def get(self, event_id: str):
        with SessionLocal() as db:
            return {"event": _audit_event_service.get_event_detail(db, event_id)}, 200


@admin_ns.route("/users/<string:user_id>/status")
class AdminUserStatusResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, user_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _get_user_snapshot(db, user_id) or {}
            user = _invitation_service.update_user_status(
                db,
                user_id,
                is_active=bool(payload.get("is_active")),
            )
            action = "activated" if user.is_active else "deactivated"
            _record_admin_event(
                db,
                action=action,
                entity_type="app_user",
                entity_id=user.id,
                entity_label=user.display_name,
                summary=f"{'Activated' if user.is_active else 'Deactivated'} user {user.display_name}.",
                changes=build_changes(
                    before=before,
                    after=_snapshot_user(user),
                    field_map={"is_active": "Active"},
                ),
            )
            return {"user": serialize_admin_user(user)}, 200


@admin_ns.route("/users/<string:user_id>")
class AdminUserResource(Resource):
    @token_required
    @require_app_admin()
    def delete(self, user_id: str):
        with SessionLocal() as db:
            before = _get_user_snapshot(db, user_id) or {}
            _invitation_service.delete_user(
                db,
                user_id,
                requested_by_user_id=getattr(g, "user_id", None),
            )
            _record_admin_event(
                db,
                action="deleted",
                entity_type="app_user",
                entity_id=user_id,
                entity_label=str(before.get("display_name") or before.get("email") or user_id),
                summary=f"Deleted deactivated user {before.get('display_name') or before.get('email') or user_id}.",
                metadata={
                    "deleted_user_email": before.get("email"),
                    "deleted_user_role": before.get("role"),
                },
            )
            return "", 204


@admin_ns.route("/users/<string:user_id>/role")
class AdminUserRoleResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, user_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before = _get_user_snapshot(db, user_id) or {}
            user = _invitation_service.update_user_role(db, user_id, payload.get("role"))
            _record_admin_event(
                db,
                action="updated",
                entity_type="app_user",
                entity_id=user.id,
                entity_label=user.display_name,
                summary=f"Changed user role for {user.display_name}.",
                changes=build_changes(
                    before=before,
                    after=_snapshot_user(user),
                    field_map={"role": "Global Role"},
                ),
            )
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
            before_payload = _user_access_service.get_user_campaign_access(db, user_id)
            access_payload = _user_access_service.replace_user_campaign_access(db, user_id, payload)
            _record_admin_event(
                db,
                action="updated",
                entity_type="user_campaign_access",
                entity_id=user_id,
                entity_label=str(user_id),
                summary="Updated campaign access for a user.",
                changes=[
                    {
                        "field": "campaign_access",
                        "label": "Campaign Access",
                        "before": _campaign_access_summary(before_payload),
                        "after": _campaign_access_summary(access_payload),
                    }
                ],
                metadata={"user_id": user_id},
            )
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
            _record_admin_event(
                db,
                action="created",
                entity_type="admin_user_invitation",
                entity_id=invitation.id,
                entity_label=invitation.email,
                summary=f"Resent invitation to {invitation.email}.",
                metadata={"user_id": str(invitation.user_id)},
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
            before = _snapshot_llm_config(_llm_service.get_configuration(db))
            config = _llm_service.save_configuration(db, payload)
            _record_admin_event(
                db,
                action="updated" if before else "created",
                entity_type="llm_configuration",
                entity_id=config.id,
                entity_label=config.label,
                summary=f"Saved LLM configuration {config.label}.",
                changes=build_changes(
                    before=before,
                    after=_snapshot_llm_config(config),
                    field_map={
                        "provider": "Provider",
                        "label": "Label",
                        "base_url": "Base URL",
                        "model": "Model",
                        "api_key_configured": "API Key Configured",
                        "is_enabled": "Enabled",
                    },
                ),
            )
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
            _feature_flag_service.ensure_defaults(db)
            before_flag = db.query(AppFeatureFlag).filter_by(feature_key=feature_key).one_or_none()
            before = _snapshot_feature_flag(before_flag) if before_flag else {}
            flag = _feature_flag_service.update_flag(
                db,
                feature_key,
                is_enabled=bool(payload.get("is_enabled")),
            )
            _record_admin_event(
                db,
                action="activated" if flag.is_enabled else "deactivated",
                entity_type="feature_flag",
                entity_label=flag.label,
                summary=f"{'Enabled' if flag.is_enabled else 'Disabled'} feature {flag.label}.",
                changes=build_changes(
                    before=before,
                    after=_snapshot_feature_flag(flag),
                    field_map={"is_enabled": "Enabled"},
                ),
                metadata={"feature_key": flag.feature_key},
            )
            return {"feature": serialize_feature_flag(flag)}, 200


@admin_ns.route("/organization-types")
class AdminOrganizationTypeListResource(Resource):
    @token_required
    @require_app_admin()
    def get(self):
        with SessionLocal() as db:
            organization_types = _organization_type_service.list_types(db, include_inactive=True)
            return {
                "organization_types": [
                    serialize_organization_type(organization_type)
                    for organization_type in organization_types
                ]
            }, 200

    @token_required
    @require_app_admin()
    def post(self):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            organization_type = _organization_type_service.create_type(db, payload)
            _record_admin_event(
                db,
                action="created",
                entity_type="organization_type",
                entity_id=organization_type.id,
                entity_label=organization_type.label,
                summary=f"Created organization type {organization_type.label}.",
                changes=build_changes(
                    before={},
                    after=_snapshot_organization_type(organization_type),
                    field_map={
                        "code": "Code",
                        "label": "Label",
                        "recipient_category": "People Served",
                        "is_active": "Active",
                        "sort_order": "Sort Order",
                    },
                ),
            )
            return {"organization_type": serialize_organization_type(organization_type)}, 201


@admin_ns.route("/organization-types/<string:code>")
class AdminOrganizationTypeDetailResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, code: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_type = _organization_type_service.get_type(db, code)
            before = _snapshot_organization_type(before_type)
            organization_type = _organization_type_service.update_type(db, code, payload)
            _record_admin_event(
                db,
                action="updated",
                entity_type="organization_type",
                entity_id=organization_type.id,
                entity_label=organization_type.label,
                summary=f"Updated organization type {organization_type.label}.",
                changes=build_changes(
                    before=before,
                    after=_snapshot_organization_type(organization_type),
                    field_map={
                        "label": "Label",
                        "recipient_category": "People Served",
                        "is_active": "Active",
                        "sort_order": "Sort Order",
                    },
                ),
            )
            return {"organization_type": serialize_organization_type(organization_type)}, 200

    @token_required
    @require_app_admin()
    def delete(self, code: str):
        with SessionLocal() as db:
            before_type = _organization_type_service.get_type(db, code)
            before = _snapshot_organization_type(before_type)
            organization_type_id = before_type.id
            _organization_type_service.delete_type(db, code)
            after_type = db.query(type(before_type)).filter_by(code=code).one_or_none()
            action = "deactivated" if after_type is not None and not after_type.is_active else "deleted"
            _record_admin_event(
                db,
                action=action,
                entity_type="organization_type",
                entity_id=organization_type_id,
                entity_label=str(before.get("label") or code),
                summary=f"Removed organization type {before.get('label') or code} from active use.",
                metadata={"code": code, "previous": before},
            )
            return "", 204


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
            _record_admin_event(
                db,
                action="created",
                entity_type="milestone_definition",
                entity_id=definition.id,
                entity_label=definition.label,
                summary=f"Created campaign milestone definition {definition.label}.",
                changes=build_changes(
                    before={},
                    after=_snapshot_milestone_definition(definition),
                    field_map={
                        "milestone_key": "Milestone Key",
                        "label": "Label",
                        "description": "Description",
                        "feature_area": "Feature Area",
                        "default_sort_order": "Sort Order",
                        "is_active": "Active",
                    },
                ),
            )
            return {"milestone_definition": serialize_milestone_definition(definition)}, 201


@admin_ns.route("/campaign-operations/milestone-definitions/<string:definition_id>")
class AdminCampaignMilestoneDefinitionDetailResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, definition_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_definition = _campaign_operations_service.get_milestone_definition(db, definition_id)
            before = _snapshot_milestone_definition(before_definition)
            definition = _campaign_operations_service.update_milestone_definition(db, definition_id, payload)
            _record_admin_event(
                db,
                action="updated",
                entity_type="milestone_definition",
                entity_id=definition.id,
                entity_label=definition.label,
                summary=f"Updated campaign milestone definition {definition.label}.",
                changes=build_changes(
                    before=before,
                    after=_snapshot_milestone_definition(definition),
                    field_map={
                        "label": "Label",
                        "description": "Description",
                        "feature_area": "Feature Area",
                        "default_sort_order": "Sort Order",
                        "is_active": "Active",
                    },
                ),
            )
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
            _record_admin_event(
                db,
                action="created",
                entity_type="readiness_rule",
                entity_id=rule.id,
                entity_label=rule.name,
                summary=f"Created readiness rule {rule.name}.",
                changes=build_changes(
                    before={},
                    after=_snapshot_readiness_rule(rule),
                    field_map={
                        "rule_key": "Rule Key",
                        "name": "Name",
                        "description": "Description",
                        "feature_area": "Feature Area",
                        "condition_type": "Condition Type",
                        "milestone_key": "Milestone",
                        "severity": "Severity",
                        "category": "Category",
                        "blocking_for_json": "Blocking For",
                        "section": "Section",
                        "action_label": "Action Label",
                        "message": "Message",
                        "is_active": "Active",
                    },
                ),
            )
            return {"readiness_rule": serialize_readiness_rule(rule)}, 201


@admin_ns.route("/campaign-operations/readiness-rules/<string:rule_id>")
class AdminCampaignReadinessRuleDetailResource(Resource):
    @token_required
    @require_app_admin()
    def patch(self, rule_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            before_rule = _campaign_operations_service.get_readiness_rule(db, rule_id)
            before = _snapshot_readiness_rule(before_rule)
            rule = _campaign_operations_service.update_readiness_rule(db, rule_id, payload)
            _record_admin_event(
                db,
                action="updated",
                entity_type="readiness_rule",
                entity_id=rule.id,
                entity_label=rule.name,
                summary=f"Updated readiness rule {rule.name}.",
                changes=build_changes(
                    before=before,
                    after=_snapshot_readiness_rule(rule),
                    field_map={
                        "name": "Name",
                        "description": "Description",
                        "feature_area": "Feature Area",
                        "condition_type": "Condition Type",
                        "condition_config_json": "Condition Settings",
                        "milestone_key": "Milestone",
                        "severity": "Severity",
                        "category": "Category",
                        "blocking_for_json": "Blocking For",
                        "section": "Section",
                        "action_label": "Action Label",
                        "message": "Message",
                        "is_active": "Active",
                    },
                ),
            )
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
