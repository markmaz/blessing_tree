from __future__ import annotations

import uuid

from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.models.app_user import AppUser
from app.models.auth import AuthIdentity
from app.services.auth import AuthService, NotApproved, OAuthUserInfo


@compiles(TINYINT, "sqlite")
def _compile_tinyint_sqlite(_type, _compiler, **_kwargs) -> str:
    return "INTEGER"


class _FakeJwtService:
    def issue_access_token(
        self,
        user_id: str,
        email: str | None,
        name: str | None,
        role: str | None,
        ttl_minutes: int | None = None,
    ) -> dict:
        return {
            "access_token": f"token-{user_id}",
            "token_type": "Bearer",
            "expires_in": 600,
            "email": email or "",
            "name": name or "",
            "role": role or "",
        }


class _FakeRefreshTokenService:
    def generate_refresh_token_raw(self) -> str:
        return "refresh-token"

    def hash_refresh_token(self, raw: str) -> str:
        return f"hash-{raw}"

    def build_session_payload(
        self,
        user_id: str,
        provider: str | None,
        ip: str | None,
        user_agent: str | None,
        ttl_seconds: int,
        rotated_from: str | None = None,
    ) -> dict:
        return {
            "user_id": user_id,
            "provider": provider,
            "ip": ip,
            "user_agent": user_agent,
            "ttl_seconds": ttl_seconds,
        }

    def store_session(self, hash_hex: str, payload: dict, ttl_seconds: int) -> None:
        return None

    def add_user_session(self, user_id: str, hash_hex: str, ttl_seconds: int) -> None:
        return None


def _db_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    from app.models.base import Base

    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    return session_factory()


def _auth_service() -> AuthService:
    return AuthService(
        jwt_service=_FakeJwtService(),
        refresh_token_service=_FakeRefreshTokenService(),
    )


def test_login_with_oauth_allows_already_linked_identity() -> None:
    db = _db_session()
    try:
        user = AppUser(
            id=uuid.uuid4(),
            email="linked@blessingtree.test",
            display_name="Linked User",
            role="COORDINATOR",
            is_active=True,
        )
        db.add(user)
        db.flush()

        identity = AuthIdentity(
            id=uuid.uuid4(),
            user_id=user.id,
            provider="GOOGLE",
            provider_sub="provider-sub-123",
            email="linked@blessingtree.test",
            password_hash=None,
            is_active=True,
        )
        db.add(identity)
        db.commit()

        access_payload, refresh_raw = _auth_service().login_with_oauth(
            db,
            "GOOGLE",
            OAuthUserInfo(sub="provider-sub-123", email="linked@blessingtree.test", name="Linked User"),
            ip="127.0.0.1",
            user_agent="pytest",
        )

        db.refresh(user)
        db.refresh(identity)

        assert access_payload["token_type"] == "Bearer"
        assert refresh_raw == "refresh-token"
        assert user.last_login_at is not None
        assert identity.email == "linked@blessingtree.test"
    finally:
        db.close()


def test_login_with_oauth_rejects_preprovisioned_but_unlinked_user() -> None:
    db = _db_session()
    try:
        user = AppUser(
            id=uuid.uuid4(),
            email="invited@blessingtree.test",
            display_name="Invited User",
            role="COORDINATOR",
            is_active=True,
        )
        db.add(user)
        db.commit()

        service = _auth_service()

        try:
            service.login_with_oauth(
                db,
                "GOOGLE",
                OAuthUserInfo(sub="new-provider-sub", email="invited@blessingtree.test", name="Invited User"),
                ip="127.0.0.1",
                user_agent="pytest",
            )
        except NotApproved as exc:
            assert str(exc) == "Use your invitation link to finish setup"
            assert exc.details == {
                "email": "invited@blessingtree.test",
                "provider": "GOOGLE",
            }
        else:
            raise AssertionError("Expected NotApproved to be raised for unlinked invited user")

        identities = db.query(AuthIdentity).filter(AuthIdentity.user_id == user.id).all()
        assert identities == []
    finally:
        db.close()
