from __future__ import annotations

import hashlib
import json
import secrets
import time
from typing import Any

from app.adapters.valkey_client import get_client


class RefreshTokenService:
    def __init__(self, valkey_client=None) -> None:
        self.valkey = valkey_client or get_client()

    @staticmethod
    def generate_refresh_token_raw() -> str:
        return secrets.token_urlsafe(48)

    @staticmethod
    def hash_refresh_token(raw: str) -> str:
        return hashlib.sha256(raw.encode("utf-8")).hexdigest()

    @staticmethod
    def _session_key(hash_hex: str) -> str:
        return f"bt:rt:{hash_hex}"

    @staticmethod
    def _user_set_key(user_id: str) -> str:
        return f"bt:user_sessions:{user_id}"

    def store_session(self, hash_hex: str, payload: dict[str, Any], ttl_seconds: int) -> None:
        key = self._session_key(hash_hex)
        self.valkey.set(key, json.dumps(payload), ex=ttl_seconds)

    def get_session(self, hash_hex: str) -> dict[str, Any] | None:
        key = self._session_key(hash_hex)
        data = self.valkey.get(key)
        if not data:
            return None
        return json.loads(data)

    def delete_session(self, hash_hex: str) -> None:
        key = self._session_key(hash_hex)
        self.valkey.delete(key)

    def add_user_session(self, user_id: str, hash_hex: str, ttl_seconds: int) -> None:
        key = self._user_set_key(user_id)
        pipe = self.valkey.pipeline()
        pipe.sadd(key, hash_hex)
        pipe.expire(key, ttl_seconds)
        pipe.execute()

    def remove_user_session(self, user_id: str, hash_hex: str) -> None:
        key = self._user_set_key(user_id)
        self.valkey.srem(key, hash_hex)

    def revoke_refresh_token(self, raw: str) -> None:
        if not raw:
            return
        hash_hex = self.hash_refresh_token(raw)
        session = self.get_session(hash_hex)
        if session and isinstance(session, dict):
            user_id = session.get("user_id")
            if user_id:
                self.remove_user_session(str(user_id), hash_hex)
        self.delete_session(hash_hex)

    def rotate_refresh_token(
        self,
        old_raw: str,
        new_raw: str,
        user_id: str,
        ttl_seconds: int,
        payload: dict[str, Any],
    ) -> str:
        old_hash = self.hash_refresh_token(old_raw)
        new_hash = self.hash_refresh_token(new_raw)
        old_key = self._session_key(old_hash)
        new_key = self._session_key(new_hash)
        user_key = self._user_set_key(user_id)

        payload_json = json.dumps(payload)

        script = """
        if redis.call('EXISTS', KEYS[1]) == 0 then
          return 0
        end
        redis.call('DEL', KEYS[1])
        redis.call('SET', KEYS[2], ARGV[1], 'EX', ARGV[2])
        redis.call('SREM', KEYS[3], ARGV[3])
        redis.call('SADD', KEYS[3], ARGV[4])
        redis.call('EXPIRE', KEYS[3], ARGV[2])
        return 1
        """

        result = self.valkey.eval(
            script,
            3,
            old_key,
            new_key,
            user_key,
            payload_json,
            ttl_seconds,
            old_hash,
            new_hash,
        )
        if result != 1:
            raise RuntimeError("refresh token already rotated")

        return new_raw

    def revoke_all_user_sessions(self, user_id: str) -> int:
        key = self._user_set_key(user_id)
        hashes = self.valkey.smembers(key) or set()
        if not hashes:
            self.valkey.delete(key)
            return 0

        pipe = self.valkey.pipeline()
        for hash_hex in hashes:
            pipe.delete(self._session_key(hash_hex))
        pipe.delete(key)
        pipe.execute()
        return len(hashes)

    def build_session_payload(
        self,
        user_id: str,
        provider: str | None,
        ip: str | None,
        user_agent: str | None,
        ttl_seconds: int,
        rotated_from: str | None = None,
    ) -> dict[str, Any]:
        now = int(time.time())
        payload = {
            "user_id": user_id,
            "issued_at": now,
            "expires_at": now + ttl_seconds,
        }
        if provider:
            payload["provider"] = provider
        if ip:
            payload["ip"] = ip
        if user_agent:
            payload["user_agent"] = user_agent
        if rotated_from:
            payload["rotated_from"] = rotated_from
        return payload
