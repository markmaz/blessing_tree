from __future__ import annotations

import os

from flask import jsonify, make_response, request
from flask_restx import Namespace, Resource, fields

from app.features.admin.invitation_service import AdminInvitationService
from app.config import (
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH,
    REFRESH_COOKIE_SAMESITE,
    REFRESH_COOKIE_SECURE,
    REFRESH_TOKEN_TTL_DAYS,
)
from app.db import SessionLocal
from app.exceptions.service_error import ServiceError
from app.services.auth import AuthError, AuthService

# Frontend must call fetch/axios with credentials: "include" to receive refresh cookie.

auth_ns = Namespace("auth", description="Authentication operations")

local_login_model = auth_ns.model(
    "LocalLogin",
    {
        "email": fields.String(required=True, description="Email address"),
        "password": fields.String(required=True, description="Password"),
    },
)

invite_accept_model = auth_ns.model(
    "InviteAccept",
    {
        "email": fields.String(required=True, description="Invited email address"),
        "display_name": fields.String(required=True, description="Display name"),
        "password": fields.String(required=True, description="Local account password"),
    },
)

_invitation_service = AdminInvitationService()


def _handle_auth_error(exc: AuthError):
    raise ServiceError(str(exc), status_code=exc.status_code, details=getattr(exc, "details", {}))


def _cookie_secure() -> bool:
    if REFRESH_COOKIE_SECURE:
        return True
    env = os.getenv("CURRENT_ENVIRONMENT", "").strip().lower()
    return env in {"prod", "production"}


def _set_refresh_cookie(response, raw_refresh: str, ttl_seconds: int) -> None:
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        raw_refresh,
        httponly=True,
        secure=_cookie_secure(),
        samesite=REFRESH_COOKIE_SAMESITE,
        max_age=ttl_seconds,
        path=REFRESH_COOKIE_PATH,
    )


def _clear_refresh_cookie(response) -> None:
    response.set_cookie(
        REFRESH_COOKIE_NAME,
        "",
        httponly=True,
        secure=_cookie_secure(),
        samesite=REFRESH_COOKIE_SAMESITE,
        max_age=0,
        path=REFRESH_COOKIE_PATH,
    )


def _client_ip() -> str | None:
    return request.headers.get("X-Forwarded-For", request.remote_addr)


def _user_agent() -> str | None:
    return request.headers.get("User-Agent")


def _refresh_ttl_seconds() -> int:
    return int(REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60)


@auth_ns.route("/local/login")
class LocalLogin(Resource):
    @auth_ns.expect(local_login_model)
    @auth_ns.doc(security=[])
    def post(self):
        payload = request.get_json(silent=True) or {}
        email = payload.get("email")
        password = payload.get("password")

        if not email or not password:
            raise ServiceError("Missing email or password", status_code=400)

        try:
            auth_service = AuthService()
            with SessionLocal() as db:
                access_payload, refresh_raw = auth_service.login_local(
                    db,
                    email,
                    password,
                    ip=_client_ip(),
                    user_agent=_user_agent(),
                )
            response = make_response(jsonify(access_payload))
            _set_refresh_cookie(response, refresh_raw, _refresh_ttl_seconds())
            return response
        except AuthError as exc:
            _handle_auth_error(exc)


@auth_ns.route("/refresh")
class Refresh(Resource):
    @auth_ns.doc(security=[])
    def post(self):
        raw_refresh = request.cookies.get(REFRESH_COOKIE_NAME)
        if not raw_refresh:
            response = make_response(jsonify({"error": "Missing refresh token"}), 401)
            _clear_refresh_cookie(response)
            return response

        try:
            auth_service = AuthService()
            with SessionLocal() as db:
                access_payload, new_refresh = auth_service.refresh(
                    db,
                    raw_refresh,
                    ip=_client_ip(),
                    user_agent=_user_agent(),
                )
            response = make_response(jsonify(access_payload))
            _set_refresh_cookie(response, new_refresh, _refresh_ttl_seconds())
            return response
        except AuthError as exc:
            response = make_response(jsonify({"error": str(exc)}), exc.status_code)
            _clear_refresh_cookie(response)
            return response


@auth_ns.route("/logout")
class Logout(Resource):
    @auth_ns.doc(security=[])
    def post(self):
        raw_refresh = request.cookies.get(REFRESH_COOKIE_NAME)
        try:
            auth_service = AuthService()
            with SessionLocal() as db:
                auth_service.logout(db, raw_refresh)
        except AuthError as exc:
            _handle_auth_error(exc)

        response = make_response(("", 204))
        _clear_refresh_cookie(response)
        return response


@auth_ns.route("/invite/validate/<string:token>")
class InviteValidation(Resource):
    @auth_ns.doc(security=[])
    def get(self, token: str):
        if not token:
            raise ServiceError("Missing token", status_code=400)

        with SessionLocal() as db:
            return _invitation_service.validate_invitation_token(db, token), 200


@auth_ns.route("/invite/accept")
class InviteAccept(Resource):
    @auth_ns.expect(invite_accept_model)
    @auth_ns.doc(security=[])
    def post(self):
        payload = request.get_json(silent=True) or {}
        token = str(request.args.get("token") or payload.get("token") or "").strip()
        if not token:
            raise ServiceError("Missing token", status_code=400)

        with SessionLocal() as db:
            user = _invitation_service.accept_invitation(db, token, payload)
            return {
                "user_id": str(user.id),
                "email": user.email,
                "display_name": user.display_name,
                "status": "active",
            }, 200
