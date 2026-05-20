from __future__ import annotations

from datetime import datetime, timedelta, timezone

import jwt

from app.config import ACCESS_TOKEN_TTL_MINUTES, JWT_AUDIENCE, JWT_ISSUER, JWT_SECRET
from app.services.auth.exceptions import AuthError


class JwtService:
    def __init__(
        self,
        secret: str | None = JWT_SECRET,
        issuer: str | None = JWT_ISSUER,
        audience: str | None = JWT_AUDIENCE,
        access_ttl_minutes: int = ACCESS_TOKEN_TTL_MINUTES,
    ) -> None:
        if not secret:
            raise AuthError("JWT_SECRET is not configured", status_code=500)
        if not issuer:
            raise AuthError("JWT_ISSUER is not configured", status_code=500)
        if not audience:
            raise AuthError("JWT_AUDIENCE is not configured", status_code=500)

        self.secret = secret
        self.issuer = issuer
        self.audience = audience
        self.access_ttl_minutes = access_ttl_minutes

    def issue_access_token(
        self,
        user_id: str,
        email: str | None,
        name: str | None,
        role: str | None,
        ttl_minutes: int | None = None,
    ) -> dict:
        now = datetime.now(timezone.utc)
        ttl_minutes = ttl_minutes if ttl_minutes is not None else self.access_ttl_minutes
        ttl = int(ttl_minutes * 60)
        payload = {
            "iss": self.issuer,
            "aud": self.audience,
            "sub": user_id,
            "email": email or "",
            "name": name or "",
            "role": role or "",
            "iat": int(now.timestamp()),
            "exp": int((now + timedelta(seconds=ttl)).timestamp()),
            "typ": "access",
        }
        token = jwt.encode(payload, self.secret, algorithm="HS256")
        return {
            "access_token": token,
            "token_type": "Bearer",
            "expires_in": ttl,
        }

    def decode_access_token(self, token: str) -> dict:
        payload = jwt.decode(
            token,
            self.secret,
            algorithms=["HS256"],
            issuer=self.issuer,
            audience=self.audience,
        )
        if payload.get("typ") != "access":
            raise AuthError("Invalid token type", status_code=401)
        return payload
