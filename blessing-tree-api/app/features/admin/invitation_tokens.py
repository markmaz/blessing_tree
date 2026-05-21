from __future__ import annotations

from itsdangerous import BadSignature, BadTimeSignature, URLSafeTimedSerializer

from app.config import JWT_SECRET

_SALT = "blessing-tree-admin-invite"


def _serializer() -> URLSafeTimedSerializer:
    return URLSafeTimedSerializer(secret_key=JWT_SECRET, salt=_SALT)


def issue_invitation_token(invitation_id: str, user_id: str, email: str) -> str:
    return _serializer().dumps(
        {
            "invitation_id": invitation_id,
            "user_id": user_id,
            "email": email,
        }
    )


def read_invitation_token(token: str, *, max_age_seconds: int) -> dict[str, str]:
    try:
        payload = _serializer().loads(token, max_age=max_age_seconds)
    except (BadSignature, BadTimeSignature) as exc:
        raise ValueError("Invalid or expired invitation token") from exc

    if not isinstance(payload, dict):
        raise ValueError("Invalid or expired invitation token")
    return {
        "invitation_id": str(payload.get("invitation_id") or "").strip(),
        "user_id": str(payload.get("user_id") or "").strip(),
        "email": str(payload.get("email") or "").strip().lower(),
    }
