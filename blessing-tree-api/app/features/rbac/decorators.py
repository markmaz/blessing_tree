from __future__ import annotations

import functools

from flask import g, make_response, request

from app.db import SessionLocal
from app.decorators.security import ensure_authenticated_request
from app.exceptions.service_error import ServiceError
from app.features.rbac.services.authorization_service import AuthorizationService
from app.features.rbac.scope import resolve_campaign_scope_id

_authorization_service = AuthorizationService()


def require_app_admin():
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return make_response("", 204)

            ensure_authenticated_request()
            with SessionLocal() as db:
                is_admin = _authorization_service.user_is_app_admin(db, getattr(g, "user_id", None))

            if not is_admin:
                raise ServiceError(
                    "App admin access required",
                    status_code=403,
                    details={"code": "app_admin_required"},
                )

            return fn(*args, **kwargs)

        return wrapper

    return decorator


def require_campaign_capability(
    capability: str,
    *,
    campaign_id_arg: str = "campaign_id",
    allow_query_fallback: bool = False,
    allow_body_fallback: bool = False,
):
    def decorator(fn):
        @functools.wraps(fn)
        def wrapper(*args, **kwargs):
            if request.method == "OPTIONS":
                return make_response("", 204)

            ensure_authenticated_request()
            campaign_id = resolve_campaign_scope_id(
                campaign_id_arg=campaign_id_arg,
                route_kwargs=kwargs,
                allow_query_fallback=allow_query_fallback,
                allow_body_fallback=allow_body_fallback,
            )

            with SessionLocal() as db:
                allowed = _authorization_service.user_has_campaign_capability(
                    db,
                    getattr(g, "user_id", None),
                    campaign_id,
                    capability,
                )

            if not allowed:
                raise ServiceError(
                    "Forbidden",
                    status_code=403,
                    details={
                        "code": "missing_campaign_capability",
                        "campaign_id": campaign_id,
                        "capability": capability,
                    },
                )

            g.campaign_id = campaign_id
            return fn(*args, **kwargs)

        return wrapper

    return decorator
