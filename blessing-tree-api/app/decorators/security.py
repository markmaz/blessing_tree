from __future__ import annotations

import functools
from typing import Any, Iterable

from flask import g, make_response, request

from app.exceptions.service_error import ServiceError
from app.features.rbac.constants import APP_ADMIN_ROLE, normalize_app_role
from app.services.auth import AuthService

_auth_service = AuthService()


def _extract_bearer_token() -> str:
    auth = request.headers.get("Authorization", "")
    if not auth:
        raise ServiceError("Missing authorization token", status_code=401)

    parts = auth.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise ServiceError("Malformed authorization header", status_code=401)

    token = parts[1].strip()
    if not token:
        raise ServiceError("Missing bearer token", status_code=401)

    return token


def _as_str_list(value: Any) -> list[str]:
    if value is None:
        return []
    if isinstance(value, str):
        return [value.strip()] if value.strip() else []
    if isinstance(value, (list, tuple, set)):
        return [str(v).strip() for v in value if str(v).strip()]
    return []


def _has_admin(values: Iterable[str]) -> bool:
    return any(normalize_app_role(v) == APP_ADMIN_ROLE for v in values)


def _extract_user_context(payload: dict) -> tuple[str, str, str, bool]:
    user_id = (
        payload.get("sub")
        or payload.get("user_id")
        or payload.get("uid")
        or payload.get("username")
        or payload.get("email")
    )

    display_name = (
        payload.get("name")
        or payload.get("display_name")
        or payload.get("preferred_username")
        or payload.get("username")
        or payload.get("email")
        or user_id
    )

    role_claim = payload.get("role")
    role = str(role_claim).strip().upper() if isinstance(role_claim, str) else ""

    roles = _as_str_list(payload.get("roles"))
    groups = _as_str_list(payload.get("groups"))

    is_admin = normalize_app_role(role) == APP_ADMIN_ROLE or _has_admin(roles) or _has_admin(groups) or bool(payload.get("is_admin") or payload.get("admin"))

    if not role:
        if is_admin:
            role = "ADMIN"
        elif roles:
            role = roles[0].upper()
        elif groups:
            role = groups[0].upper()

    return str(user_id or "").strip(), str(display_name or "").strip(), role, is_admin


def ensure_authenticated_request() -> None:
    """Validate Bearer token and populate request-scoped user context once."""
    if getattr(g, "user_id", None):
        return

    token = _extract_bearer_token()
    payload = _auth_service.verify_token(token)
    if not isinstance(payload, dict):
        raise ServiceError("Invalid or expired token", status_code=401)

    user_id, display_name, role, is_admin = _extract_user_context(payload)
    if not user_id:
        raise ServiceError(
            "Invalid token payload: missing user identity",
            status_code=401,
            details={"required_claims": ["sub (preferred)", "email (fallback)"]},
        )

    g.user_data = payload
    g.user_id = user_id
    g.user_display_name = display_name
    g.user_role = role
    g.global_app_role = APP_ADMIN_ROLE if is_admin else normalize_app_role(role)
    g.is_admin = is_admin


def token_required(f):
    """Validate Bearer token and populate request-scoped user context."""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if request.method == "OPTIONS":
            return make_response("", 204)

        ensure_authenticated_request()
        return f(*args, **kwargs)

    return decorated_function


def require_roles(*allowed_roles: str):
    """Ensure the current user has one of the allowed roles."""
    allowed = {r.strip().upper() for r in allowed_roles if r and r.strip()}

    def decorator(f):
        @functools.wraps(f)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return make_response("", 204)

            ensure_authenticated_request()
            role = getattr(g, "user_role", "").upper()
            if not role:
                raise ServiceError("Authentication required", status_code=401)

            if role not in allowed:
                raise ServiceError(
                    "Forbidden",
                    status_code=403,
                    details={"allowed_roles": sorted(allowed), "role": role},
                )
            return f(*args, **kwargs)

        return wrapper

    return decorator
