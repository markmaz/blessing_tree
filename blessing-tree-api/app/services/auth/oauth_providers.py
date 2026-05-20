from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    metadata_url: str
    scopes: str
    client_id_env: str
    client_secret_env: str
    redirect_env: str


PROVIDERS: dict[str, ProviderConfig] = {
    "GOOGLE": ProviderConfig(
        name="google",
        metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        scopes="openid email profile",
        client_id_env="GOOGLE_CLIENT_ID",
        client_secret_env="GOOGLE_CLIENT_SECRET",
        redirect_env="GOOGLE_REDIRECT_URI",
    ),
    "YAHOO": ProviderConfig(
        name="yahoo",
        metadata_url="https://api.login.yahoo.com/.well-known/openid-configuration",
        scopes="openid email profile",
        client_id_env="YAHOO_CLIENT_ID",
        client_secret_env="YAHOO_CLIENT_SECRET",
        redirect_env="YAHOO_REDIRECT_URI",
    ),
}
