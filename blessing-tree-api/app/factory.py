from __future__ import annotations

import json
import logging
import time
import uuid
from urllib.parse import urlsplit, urlunsplit

import valkey
from flask import Flask, g, jsonify, request
from flask_cors import CORS
from flask_restx import Api

import app.models.models  # noqa: F401

from app.celery import celery, init_celery
from app.config import FRONTEND_BASE_URL, LOG_QUEUE, VALKEY_ADDRESS, VALKEY_CONFIG, VALKEY_PORT
from app.exceptions.service_error import ServiceError
from app.extensions import mail
from app.features.account import account_ns
from app.features.admin import admin_ns
from app.features.campaigns import campaign_ns
from app.features.meta import meta_ns
from app.features.public import public_ns
from app.routes.auth_routes import auth_ns, init_oauth
from app.services.auth import AuthService
from app.utils import build_url
from app.versioning import get_backend_version
from app.config.logging_config import configure_logging
from app.config.mail_config import MailConfig

NAME = "api"
VERSION = "v1"
auth_service = AuthService()
BACKEND_VERSION = get_backend_version()


def build_cors_origins(frontend_base_url: str | None) -> list[str]:
    origins = {
        "https://blessing-tree.com",
        "http://localhost:3000",
        "http://localhost:5173",
    }
    if frontend_base_url:
        origins.add(frontend_base_url)
        parts = urlsplit(frontend_base_url)
        if parts.hostname == "localhost":
            origins.add(urlunsplit((parts.scheme, f"127.0.0.1:{parts.port or ''}".rstrip(":"), parts.path, parts.query, parts.fragment)))
        elif parts.hostname == "127.0.0.1":
            origins.add(urlunsplit((parts.scheme, f"localhost:{parts.port or ''}".rstrip(":"), parts.path, parts.query, parts.fragment)))

    return sorted(origin for origin in origins if origin)

def try_get_json_body(req):
    try:
        data = req.get_json()
        if data:
            masked = data.copy()
            for key in ["password", "token"]:
                if key in masked:
                    masked[key] = "*****"
            return masked
    except Exception:
        pass
    return None

def extract_user_id():
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        payload = auth_service.verify_token(token)
        if payload and isinstance(payload, dict):
            return payload.get("sub") or "unknown_user"
    return "unknown_user"

def create_app():
    app = Flask(__name__)
    app.config["RESTX_MASK_SWAGGER"] = False
    app.url_map.strict_slashes = False
    app.config["FRONTEND_BASE_URL"] = FRONTEND_BASE_URL
    authorizations = {"BearerAuth": {"type": "apiKey", "in": "header", "name": "Authorization"}}

    app.config.from_object(MailConfig)
    mail.init_app(app=app)

    app.config["CELERY_BROKER_URL"] = VALKEY_CONFIG
    app.config["CELERY_RESULT_BACKEND"] = VALKEY_CONFIG

    init_celery(app)
    app.config["CELERY"] = celery

    api = Api(
        app,
        version=BACKEND_VERSION,
        title="Blessing Tree API",
        description="The Blessing Tree API",
        doc="/swagger-ui",
        mask_swagger=False,
        security="BearerAuth",
        authorizations=authorizations,
    )

    cors_origins = build_cors_origins(FRONTEND_BASE_URL)

    CORS(
        app,
        resources={r"/api/*": {"origins": cors_origins}},
        supports_credentials=True,
        expose_headers=["Content-Disposition"],
    )

    api.add_namespace(auth_ns, path=build_url("/", NAME, VERSION, "auth"))
    api.add_namespace(account_ns, path=build_url("/", NAME, VERSION, "account"))
    api.add_namespace(admin_ns, path=build_url("/", NAME, VERSION, "admin"))
    api.add_namespace(campaign_ns, path=build_url("/", NAME, VERSION, "campaigns"))
    api.add_namespace(meta_ns, path=build_url("/", NAME, VERSION, "meta"))
    api.add_namespace(public_ns, path=build_url("/", NAME, VERSION, "public"))

    @api.errorhandler(ServiceError)
    def handle_api_service_error(error):
        return error.to_dict(), error.status_code

    configure_logging()
    logger = logging.getLogger(__name__)
    logger.info("Starting the application...")

    try:
        init_oauth(app)
    except Exception as exc:
        logger.warning("OAuth initialization failed: %s", exc)


    valkey_client = valkey.StrictValkey(host=VALKEY_ADDRESS, port=VALKEY_PORT, decode_responses=True)

    @app.before_request
    def log_request_metadata():
        g.start_time = time.time()
        g.correlation_id = str(uuid.uuid4())
        g.audit_data = {
            "timestamp": int(g.start_time),
            "correlation_id": g.correlation_id,
            "user_id": extract_user_id(),
            "endpoint": request.path,
            "method": request.method,
            "ip_address": request.headers.get("X-Forwarded-For", request.remote_addr),
            "user_agent": request.headers.get("User-Agent", "unknown"),
            "request_body": try_get_json_body(request),
            "authenticated": request.authorization is not None or hasattr(g, "user"),
        }

    @app.after_request
    def log_response_metadata(response):
        duration_ms = int((time.time() - g.start_time) * 1000)
        g.audit_data["status_code"] = response.status_code
        g.audit_data["response_time_ms"] = duration_ms
        try:
            valkey_client.rpush(LOG_QUEUE, json.dumps(g.audit_data))
        except Exception as e:
            app.logger.error(f"Error storing audit log in Valkey: {e}")

        response.headers["X-Correlation-ID"] = g.correlation_id
        return response

    @app.errorhandler(ServiceError)
    def handle_service_error(error):
        response = jsonify(error.to_dict())
        response.status_code = error.status_code
        return response

    return app
