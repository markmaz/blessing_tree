from __future__ import annotations

from dataclasses import dataclass
from typing import Any

import os

from authlib.integrations.flask_client import OAuth

from app.services.auth.exceptions import OAuthError
from app.services.auth.oauth_providers import PROVIDERS


@dataclass(frozen=True)
class OAuthUserInfo:
    sub: str
    email: str | None
    name: str | None


class OAuthService:
    def __init__(self) -> None:
        self._oauth: OAuth | None = None
        self._clients: dict[str, Any] = {}

    def register_providers(self, app, oauth: OAuth) -> None:
        self._oauth = oauth
        for provider_key, config in PROVIDERS.items():
            client_id = app.config.get(config.client_id_env) or os.getenv(config.client_id_env)
            client_secret = app.config.get(config.client_secret_env) or os.getenv(config.client_secret_env)

            if not client_id or not client_secret:
                continue

            client = oauth.register(
                name=config.name,
                client_id=client_id,
                client_secret=client_secret,
                server_metadata_url=config.metadata_url,
                client_kwargs={"scope": config.scopes},
            )
            self._clients[provider_key] = client

    def authorize_redirect(self, provider: str, redirect_uri: str):
        client = self._get_client(provider)
        return client.authorize_redirect(redirect_uri)

    def fetch_userinfo_from_callback(self, provider: str) -> OAuthUserInfo:
        client = self._get_client(provider)
        client.authorize_access_token()
        resp = client.get("userinfo")
        if resp is None or resp.status_code >= 400:
            raise OAuthError("Failed to fetch user info")

        data = resp.json() or {}
        sub = data.get("sub")
        if not sub:
            raise OAuthError("User info missing subject")

        return OAuthUserInfo(
            sub=sub,
            email=data.get("email"),
            name=data.get("name") or data.get("preferred_username"),
        )

    def _get_client(self, provider: str):
        if not provider:
            raise OAuthError("Missing provider")
        key = provider.strip().upper()
        client = self._clients.get(key)
        if client is None:
            raise OAuthError(f"OAuth provider not configured: {key}")
        return client
