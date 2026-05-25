from __future__ import annotations

from app.models.admin_llm_configuration import AdminLlmConfiguration
from app.models.admin_user_invitation import AdminUserInvitation
from app.models.app_feature_flag import AppFeatureFlag
from app.models.app_user import AppUser
from app.models.campaign import Campaign


def serialize_admin_user(user: AppUser) -> dict[str, object]:
    return {
        "id": str(user.id),
        "email": user.email,
        "display_name": user.display_name,
        "role": user.role,
        "is_active": bool(user.is_active),
        "last_login_at": user.last_login_at.isoformat() if user.last_login_at else None,
        "created_at": user.created_at.isoformat(),
        "updated_at": user.updated_at.isoformat(),
    }


def serialize_invitation(
    invitation: AdminUserInvitation,
    *,
    invite_url: str | None = None,
) -> dict[str, object]:
    status = "pending"
    if invitation.revoked_at:
        status = "revoked"
    elif invitation.accepted_at:
        status = "accepted"
    elif invitation.expires_at <= invitation.created_at:
        status = "expired"

    payload = {
        "id": str(invitation.id),
        "user_id": str(invitation.user_id),
        "email": invitation.email,
        "status": status,
        "expires_at": invitation.expires_at.isoformat(),
        "accepted_at": invitation.accepted_at.isoformat() if invitation.accepted_at else None,
        "revoked_at": invitation.revoked_at.isoformat() if invitation.revoked_at else None,
        "created_at": invitation.created_at.isoformat(),
        "updated_at": invitation.updated_at.isoformat(),
    }
    if invite_url:
        payload["invite_url"] = invite_url
    return payload


def serialize_llm_configuration(
    config: AdminLlmConfiguration | None,
) -> dict[str, object]:
    if config is None:
        return {
            "configured": False,
            "provider": "OPENAI_COMPATIBLE",
            "label": "Primary LLM",
            "base_url": "",
            "model": "",
            "api_key_configured": False,
            "is_enabled": False,
            "last_tested_at": None,
            "last_test_status": None,
            "last_test_message": None,
        }
    return {
        "configured": True,
        "id": str(config.id),
        "provider": config.provider,
        "label": config.label,
        "base_url": config.base_url,
        "model": config.model,
        "api_key_configured": bool(config.api_key_encrypted),
        "is_enabled": bool(config.is_enabled),
        "last_tested_at": config.last_tested_at.isoformat() if config.last_tested_at else None,
        "last_test_status": config.last_test_status,
        "last_test_message": config.last_test_message,
    }


def serialize_feature_flag(flag: AppFeatureFlag) -> dict[str, object]:
    return {
        "feature_key": flag.feature_key,
        "label": flag.label,
        "description": flag.description,
        "is_enabled": bool(flag.is_enabled),
        "created_at": flag.created_at.isoformat(),
        "updated_at": flag.updated_at.isoformat(),
    }


def serialize_admin_user_campaign_access(payload: dict[str, object]) -> dict[str, object]:
    return {
        "user_id": payload["user_id"],
        "campaigns": [
            {
                "campaign": serialize_admin_campaign_access_campaign(row["campaign"]),
                "role_keys": row["role_keys"],
                "capabilities": row["capabilities"],
            }
            for row in payload["campaigns"]
        ],
        "role_catalog": payload["role_catalog"],
    }


def serialize_admin_campaign_access_campaign(campaign: Campaign) -> dict[str, object]:
    return {
        "id": str(campaign.id),
        "name": campaign.name,
        "year": campaign.year,
        "status": campaign.status,
    }
