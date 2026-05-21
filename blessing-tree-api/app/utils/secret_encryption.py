from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet

from app.config import JWT_SECRET


def _build_fernet() -> Fernet:
    digest = hashlib.sha256(str(JWT_SECRET or "").encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def encrypt_secret(value: str | None) -> str | None:
    normalized = str(value or "").strip()
    if not normalized:
        return None
    return _build_fernet().encrypt(normalized.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: str | None) -> str | None:
    normalized = str(value or "").strip()
    if not normalized:
        return None
    return _build_fernet().decrypt(normalized.encode("utf-8")).decode("utf-8")
