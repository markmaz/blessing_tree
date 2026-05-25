from __future__ import annotations

import hashlib

import valkey
from flask import request
from flask_restx import Resource

from app.config import BT_TRUSTED_PROXY_IPS, VALKEY_ADDRESS, VALKEY_PORT
from app.db import SessionLocal
from app.exceptions.service_error import ServiceError
from app.features.public import public_ns
from app.features.sponsors import (
    CampaignSponsorService,
    serialize_public_sponsor_config,
    serialize_public_sponsor_submission,
    serialize_public_sponsor_verification_result,
)
from app.features.sponsors.email_delivery import send_public_sponsor_verification_email_with_fallback

_sponsor_service = CampaignSponsorService()


def _client_ip() -> str:
    forwarded_for = request.headers.get("X-Forwarded-For")
    remote_addr = str(request.remote_addr or "unknown")
    trusted_proxies = set(BT_TRUSTED_PROXY_IPS)
    if forwarded_for and (remote_addr in trusted_proxies or "*" in trusted_proxies):
        return forwarded_for.split(",")[0].strip()
    return remote_addr


def _user_agent() -> str | None:
    return request.headers.get("User-Agent")


def _rate_limit_key(prefix: str, raw: str) -> str:
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"bt:{prefix}:{digest}"


def _enforce_rate_limit(*, prefix: str, raw_key: str, max_attempts: int, window_seconds: int) -> None:
    if not raw_key:
        return
    try:
        client = valkey.StrictValkey(host=VALKEY_ADDRESS, port=int(VALKEY_PORT), decode_responses=True)
        key = _rate_limit_key(prefix, raw_key)
        current = client.incr(key)
        if current == 1:
            client.expire(key, window_seconds)
        if current > max_attempts:
            raise ServiceError("Too many public sponsor requests. Try again later.", status_code=429)
    except ServiceError:
        raise
    except Exception:
        return


@public_ns.route("/campaigns/<string:public_slug>/sponsor-config")
class PublicSponsorConfigResource(Resource):
    @public_ns.doc(security=[])
    def get(self, public_slug: str):
        with SessionLocal() as db:
            payload = _sponsor_service.get_public_signup_config(db, public_slug)
            response = serialize_public_sponsor_config(**payload)
        return response


@public_ns.route("/campaigns/<string:public_slug>/sponsors")
class PublicSponsorRegistrationResource(Resource):
    @public_ns.doc(security=[])
    def post(self, public_slug: str):
        payload = request.get_json(silent=True) or {}
        honeypot = str(payload.get("website") or "").strip()
        if honeypot:
            return {
                "status": "pending_verification",
                "message": "If your email can be verified, you will receive a verification link shortly.",
            }, 202

        email = str(((payload.get("sponsor") or {}).get("email") if isinstance(payload.get("sponsor"), dict) else payload.get("email")) or "").strip().lower()
        _enforce_rate_limit(prefix="public-sponsor-ip", raw_key=_client_ip(), max_attempts=10, window_seconds=3600)
        _enforce_rate_limit(prefix="public-sponsor-email", raw_key=email, max_attempts=5, window_seconds=3600)

        with SessionLocal() as db:
            registration = _sponsor_service.submit_public_registration(
                db,
                public_slug,
                payload,
                submitted_ip=_client_ip(),
                user_agent=_user_agent(),
            )
            campaign_name = registration.campaign.name
            response_payload = serialize_public_sponsor_submission(registration)
        email_sent = send_public_sponsor_verification_email_with_fallback(
            email=registration.email,
            display_name=registration.display_name or registration.email,
            campaign_name=campaign_name,
            public_slug=public_slug,
            verification_token=registration.verification_token,
        )
        return {
            **response_payload,
            "status": "pending_verification",
            "email_delivery_status": "sent" if email_sent else "failed",
            "message": (
                "Check your email to verify your sponsor signup. You will choose gifts after your email is verified."
                if email_sent
                else "Your sponsor signup was received, but the verification email could not be sent. Please contact the campaign team."
            ),
        }, 202


@public_ns.route("/campaigns/<string:public_slug>/sponsors/verify")
class PublicSponsorVerificationResource(Resource):
    @public_ns.doc(security=[])
    def post(self, public_slug: str):
        payload = request.get_json(silent=True) or {}
        token = str(payload.get("token") or "").strip()
        if not token:
            raise ServiceError("token is required", status_code=400, details={"field": "token"})
        _enforce_rate_limit(prefix="public-sponsor-verify-ip", raw_key=_client_ip(), max_attempts=20, window_seconds=3600)
        with SessionLocal() as db:
            result = _sponsor_service.verify_public_registration(db, public_slug, token)
            response = serialize_public_sponsor_verification_result(**result)
        return response


@public_ns.route("/campaigns/<string:public_slug>/sponsors/verified-gifts")
class PublicSponsorVerifiedGiftResource(Resource):
    @public_ns.doc(security=[])
    def post(self, public_slug: str):
        payload = request.get_json(silent=True) or {}
        token = str(payload.get("token") or "").strip()
        if not token:
            raise ServiceError("token is required", status_code=400, details={"field": "token"})
        _enforce_rate_limit(prefix="public-sponsor-gifts-ip", raw_key=_client_ip(), max_attempts=30, window_seconds=3600)
        with SessionLocal() as db:
            result = _sponsor_service.commit_verified_public_gifts(
                db,
                public_slug,
                token,
                payload.get("selected_wishlist_item_ids"),
            )
            response = serialize_public_sponsor_verification_result(**result)
        return response
