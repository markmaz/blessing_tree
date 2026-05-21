from __future__ import annotations

import os
from urllib.parse import urlencode

from authlib.integrations.flask_client import OAuth
from flask import current_app, jsonify, make_response, redirect, request, session
from flask_restx import Namespace, Resource, fields

from app.features.admin.invitation_service import AdminInvitationService
from app.config import (
    FRONTEND_BASE_URL,
    REFRESH_COOKIE_NAME,
    REFRESH_COOKIE_PATH,
    REFRESH_COOKIE_SAMESITE,
    REFRESH_COOKIE_SECURE,
    REFRESH_TOKEN_TTL_DAYS,
)
from app.db import SessionLocal
from app.exceptions.service_error import ServiceError
from app.services.auth import AuthError, AuthService, OAuthService

# Frontend: show Google and Yahoo buttons, divider "or", then email/password form. No self-signup.
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

_oauth = OAuth()
_oauth_service = OAuthService()
_invitation_service = AdminInvitationService()
_INVITE_TOKEN_SESSION_KEY = "bt_invite_token"
_INVITE_PROVIDER_SESSION_KEY = "bt_invite_provider"


def init_oauth(app):
    _oauth.init_app(app)
    _oauth_service.register_providers(app, _oauth)


def _redirect_uri_for(provider: str) -> str | None:
    env_key = f"{provider}_REDIRECT_URI"
    legacy_key = f"{provider}_OAUTH_REDIRECT_URI"
    return (
        request.args.get("redirect_uri")
        or current_app.config.get(env_key)
        or os.getenv(env_key)
        or current_app.config.get(legacy_key)
        or os.getenv(legacy_key)
    )


def _handle_auth_error(exc: AuthError):
    raise ServiceError(str(exc), status_code=exc.status_code, details=getattr(exc, "details", {}))


def _frontend_base_url() -> str:
    return str(current_app.config.get("FRONTEND_BASE_URL") or FRONTEND_BASE_URL or "http://localhost:5173").rstrip("/")


def _frontend_auth_callback_url(*, flow: str | None = None, provider: str | None = None) -> str:
    base = f"{_frontend_base_url()}/auth/callback"
    params: dict[str, str] = {}
    if flow:
        params["flow"] = flow
    if provider:
        params["provider"] = provider.lower()
    if not params:
        return base
    return f"{base}?{urlencode(params)}"


def _frontend_login_url(error: str | None = None) -> str:
    base = f"{_frontend_base_url()}/login"
    if not error:
        return base
    return f"{base}?{urlencode({'error': error})}"


def _frontend_register_url(token: str | None = None, error: str | None = None) -> str:
    base = f"{_frontend_base_url()}/auth/register"
    params: dict[str, str] = {}
    if token:
      params["token"] = token
    if error:
      params["error"] = error
    if not params:
      return base
    return f"{base}?{urlencode(params)}"


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


def _stash_invite_oauth(token: str, provider: str) -> None:
    session[_INVITE_TOKEN_SESSION_KEY] = token
    session[_INVITE_PROVIDER_SESSION_KEY] = provider


def _pop_invite_oauth(provider: str) -> str | None:
    stored_provider = session.get(_INVITE_PROVIDER_SESSION_KEY)
    stored_token = session.get(_INVITE_TOKEN_SESSION_KEY)
    if stored_provider != provider:
        return None
    session.pop(_INVITE_PROVIDER_SESSION_KEY, None)
    session.pop(_INVITE_TOKEN_SESSION_KEY, None)
    return str(stored_token) if stored_token else None


@auth_ns.route("/google/login")
class GoogleLogin(Resource):
    @auth_ns.doc(security=[])
    def get(self):
        redirect_uri = _redirect_uri_for("GOOGLE")
        if not redirect_uri:
            raise ServiceError("Missing redirect_uri", status_code=400)

        try:
            return _oauth_service.authorize_redirect("GOOGLE", redirect_uri)
        except AuthError as exc:
            _handle_auth_error(exc)


@auth_ns.route("/invite/google/login")
class InviteGoogleLogin(Resource):
    @auth_ns.doc(security=[])
    def get(self):
        token = str(request.args.get("token") or "").strip()
        if not token:
            raise ServiceError("Missing token", status_code=400)

        with SessionLocal() as db:
            _invitation_service.validate_invitation_token(db, token)

        redirect_uri = _redirect_uri_for("GOOGLE")
        if not redirect_uri:
            raise ServiceError("Missing redirect_uri", status_code=400)

        _stash_invite_oauth(token, "GOOGLE")
        try:
            return _oauth_service.authorize_redirect("GOOGLE", redirect_uri)
        except AuthError as exc:
            _handle_auth_error(exc)


@auth_ns.route("/google/callback")
class GoogleCallback(Resource):
    @auth_ns.doc(security=[])
    def get(self):
        invite_token = _pop_invite_oauth("GOOGLE")
        try:
            userinfo = _oauth_service.fetch_userinfo_from_callback("GOOGLE")
            if invite_token:
                with SessionLocal() as db:
                    _access_payload, refresh_raw = _invitation_service.accept_invitation_with_oauth(
                        db,
                        invite_token,
                        provider="GOOGLE",
                        userinfo=userinfo,
                        ip=_client_ip(),
                        user_agent=_user_agent(),
                    )[1]
                response = make_response(
                    redirect(_frontend_auth_callback_url(flow="invite", provider="GOOGLE"))
                )
                _set_refresh_cookie(response, refresh_raw, _refresh_ttl_seconds())
                return response
            auth_service = AuthService()
            with SessionLocal() as db:
                _access_payload, refresh_raw = auth_service.login_with_oauth(
                    db,
                    "GOOGLE",
                    userinfo,
                    ip=_client_ip(),
                    user_agent=_user_agent(),
                )
            response = make_response(redirect(_frontend_auth_callback_url(provider="GOOGLE")))
            _set_refresh_cookie(response, refresh_raw, _refresh_ttl_seconds())
            return response
        except AuthError as exc:
            if invite_token:
                return redirect(_frontend_register_url(invite_token, str(exc)))
            return redirect(_frontend_login_url(str(exc)))
        except ServiceError as exc:
            if invite_token:
                return redirect(_frontend_register_url(invite_token, str(exc)))
            raise


@auth_ns.route("/yahoo/login")
class YahooLogin(Resource):
    @auth_ns.doc(security=[])
    def get(self):
        redirect_uri = _redirect_uri_for("YAHOO")
        if not redirect_uri:
            raise ServiceError("Missing redirect_uri", status_code=400)

        try:
            return _oauth_service.authorize_redirect("YAHOO", redirect_uri)
        except AuthError as exc:
            _handle_auth_error(exc)


@auth_ns.route("/invite/yahoo/login")
class InviteYahooLogin(Resource):
    @auth_ns.doc(security=[])
    def get(self):
        token = str(request.args.get("token") or "").strip()
        if not token:
            raise ServiceError("Missing token", status_code=400)

        with SessionLocal() as db:
            _invitation_service.validate_invitation_token(db, token)

        redirect_uri = _redirect_uri_for("YAHOO")
        if not redirect_uri:
            raise ServiceError("Missing redirect_uri", status_code=400)

        _stash_invite_oauth(token, "YAHOO")
        try:
            return _oauth_service.authorize_redirect("YAHOO", redirect_uri)
        except AuthError as exc:
            _handle_auth_error(exc)


@auth_ns.route("/yahoo/callback")
class YahooCallback(Resource):
    @auth_ns.doc(security=[])
    def get(self):
        invite_token = _pop_invite_oauth("YAHOO")
        try:
            userinfo = _oauth_service.fetch_userinfo_from_callback("YAHOO")
            if invite_token:
                with SessionLocal() as db:
                    _access_payload, refresh_raw = _invitation_service.accept_invitation_with_oauth(
                        db,
                        invite_token,
                        provider="YAHOO",
                        userinfo=userinfo,
                        ip=_client_ip(),
                        user_agent=_user_agent(),
                    )[1]
                response = make_response(
                    redirect(_frontend_auth_callback_url(flow="invite", provider="YAHOO"))
                )
                _set_refresh_cookie(response, refresh_raw, _refresh_ttl_seconds())
                return response
            auth_service = AuthService()
            with SessionLocal() as db:
                _access_payload, refresh_raw = auth_service.login_with_oauth(
                    db,
                    "YAHOO",
                    userinfo,
                    ip=_client_ip(),
                    user_agent=_user_agent(),
                )
            response = make_response(redirect(_frontend_auth_callback_url(provider="YAHOO")))
            _set_refresh_cookie(response, refresh_raw, _refresh_ttl_seconds())
            return response
        except AuthError as exc:
            if invite_token:
                return redirect(_frontend_register_url(invite_token, str(exc)))
            return redirect(_frontend_login_url(str(exc)))
        except ServiceError as exc:
            if invite_token:
                return redirect(_frontend_register_url(invite_token, str(exc)))
            raise


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
