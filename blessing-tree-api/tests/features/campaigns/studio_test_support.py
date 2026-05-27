from __future__ import annotations

import uuid
from collections.abc import Generator
from datetime import date

import pytest
from flask import Flask, jsonify
from flask_restx import Api
from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.exceptions.service_error import ServiceError
from app.features.admin.api import admin_ns
from app.features.campaigns import campaign_ns
from app.features.public import public_ns


@compiles(TINYINT, "sqlite")
def _compile_tinyint_sqlite(_type, _compiler, **_kwargs) -> str:
    return "INTEGER"


class _SessionManager:
    def __init__(self, factory):
        self._factory = factory

    def __call__(self):
        return self._factory()


@pytest.fixture
def app(monkeypatch: pytest.MonkeyPatch) -> Generator[Flask, None, None]:
    engine = create_engine("sqlite:///:memory:")
    from app.models.base import Base

    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    seed_session = session_factory()
    _seed_default_milestone_definitions(seed_session)
    seed_session.commit()
    seed_session.close()
    session_manager = _SessionManager(session_factory)

    monkeypatch.setattr("app.features.campaigns.api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.ask.api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.campaigns.recipient_api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.campaigns.sponsor_api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.campaigns.studio_api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.campaigns.team_api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.gifts.api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.gifts.public_api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.public.sponsor_public_api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.public.sponsor_public_api._enforce_rate_limit", lambda **_kwargs: None)
    monkeypatch.setattr("app.features.admin.api.SessionLocal", session_manager)
    monkeypatch.setattr("app.features.rbac.decorators.SessionLocal", session_manager)

    app = Flask(__name__)
    api = Api(app)
    api.add_namespace(campaign_ns, path="/api/v1/campaigns")
    api.add_namespace(public_ns, path="/api/v1/public")
    api.add_namespace(admin_ns, path="/api/v1/admin")

    @api.errorhandler(ServiceError)
    def handle_api_service_error(error: ServiceError):
        return error.to_dict(), error.status_code

    @app.errorhandler(ServiceError)
    def handle_service_error(error: ServiceError):
        return jsonify(error.to_dict()), error.status_code

    yield app


def auth_header(user_id: str, role: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {user_id}:{role}"}


def install_auth(monkeypatch: pytest.MonkeyPatch) -> None:
    def _verify(token: str):
        user_id, role = token.split(":", 1)
        return {"sub": user_id, "role": role, "name": f"user-{user_id}"}

    monkeypatch.setattr("app.decorators.security._auth_service.verify_token", _verify)


def seed_user(db: Session, *, role: str = "VOLUNTEER", name: str = "Test User"):
    from app.models.app_user import AppUser

    user = AppUser(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4()}@example.com",
        display_name=name,
        role=role,
        is_active=True,
    )
    db.add(user)
    db.flush()
    return user


def seed_campaign(db: Session, *, year: int = 2026, name: str = "Studio Campaign"):
    from app.models.campaign import Campaign

    campaign = Campaign(
        id=uuid.uuid4(),
        name=name,
        description="Studio-ready campaign",
        year=year,
        start_date=date(year, 11, 1),
        end_date=date(year, 12, 31),
        status="ACTIVE",
    )
    db.add(campaign)
    db.flush()
    return campaign


def assign_role(db: Session, user, campaign, role_key: str):
    from app.features.rbac.models.campaign_user_role import CampaignUserRole

    assignment = CampaignUserRole(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        user_id=user.id,
        role_key=role_key,
        is_active=True,
    )
    db.add(assignment)
    db.flush()
    return assignment


def _seed_default_milestone_definitions(db: Session) -> None:
    from app.features.campaigns.studio_constants import MILESTONE_DEFINITIONS
    from app.models.campaign_milestone_definition import CampaignMilestoneDefinition

    for sort_order, (milestone_key, label) in enumerate(MILESTONE_DEFINITIONS.items(), start=1):
        db.add(
            CampaignMilestoneDefinition(
                id=uuid.uuid4(),
                milestone_key=milestone_key,
                label=label,
                feature_area="GENERAL",
                default_sort_order=sort_order,
                is_active=True,
                is_system=True,
            )
        )
