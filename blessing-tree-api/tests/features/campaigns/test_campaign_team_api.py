from __future__ import annotations

import uuid

import pytest
from flask import Flask

from app.features.campaigns import api as campaign_api_module
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.campaign_member_constants import APP_ACCESS_STATUS_ACTIVE, APP_ACCESS_STATUS_NONE
from app.models.campaign_team import CampaignTeam
from app.models.campaign_team_member import CampaignTeamMember
from tests.features.campaigns.studio_test_support import (
    assign_role,
    auth_header,
    install_auth,
    seed_campaign,
    seed_user,
)

pytest_plugins = ("tests.features.campaigns.studio_test_support",)


def _seed_member(session, campaign_id: uuid.UUID, *, display_name: str, email: str | None = None) -> CampaignMember:
    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        display_name=display_name,
        email=email,
        app_access_status=APP_ACCESS_STATUS_NONE,
        is_active=True,
        member_type="volunteer",
    )
    session.add(member)
    session.flush()
    return member


def test_get_team_workspace_returns_members_teams_and_counts(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    member = _seed_member(
        session,
        campaign.id,
        display_name="Volunteer One",
        email="volunteer.one@example.com",
    )
    team = CampaignTeam(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        name="Sponsor Callers",
        is_active=True,
    )
    session.add(team)
    session.flush()
    team.memberships.append(
        CampaignTeamMember(
            id=uuid.uuid4(),
            team_id=team.id,
            campaign_member_id=member.id,
        )
    )
    session.add(
        CampaignMemberAccessRole(
            id=uuid.uuid4(),
            campaign_member_id=member.id,
            role_key="VOLUNTEER_VIEWER",
            is_active=True,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/team-workspace",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["counts"]["member_count"] == 1
    assert payload["counts"]["team_count"] == 1
    assert payload["members"][0]["display_name"] == "Volunteer One"
    assert payload["teams"][0]["name"] == "Sponsor Callers"
    assert payload["filters"]["role_keys"] == ["VOLUNTEER_VIEWER"]


def test_member_crud_endpoints_create_and_update_member(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    create_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/members",
        json={
            "display_name": "Warehouse Helper",
            "email": "warehouse@example.com",
            "member_type": "volunteer",
            "app_access_status": "none",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert create_response.status_code == 201
    member_id = create_response.get_json()["id"]

    update_response = client.patch(
        f"/api/v1/campaigns/{campaign_id}/members/{member_id}",
        json={"phone": "555-0101", "notes": "Available weekends."},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    get_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/members/{member_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert update_response.status_code == 200
    assert get_response.status_code == 200
    assert get_response.get_json()["phone"] == "555-0101"
    assert get_response.get_json()["notes"] == "Available weekends."


def test_access_role_endpoints_create_update_and_list_member_roles(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    member = _seed_member(session, campaign.id, display_name="Gift Volunteer")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    member_id = str(member.id)
    session.commit()
    session.close()

    client = app.test_client()
    create_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/members/{member_id}/access-roles",
        json={"role_key": "GIFT_CHECKIN"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert create_response.status_code == 201
    assignment_id = create_response.get_json()["id"]

    patch_response = client.patch(
        f"/api/v1/campaigns/{campaign_id}/members/{member_id}/access-roles/{assignment_id}",
        json={"role_key": "VOLUNTEER_VIEWER", "is_active": False},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    list_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/member-access-roles",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert patch_response.status_code == 200
    assert patch_response.get_json()["role_key"] == "VOLUNTEER_VIEWER"
    assert patch_response.get_json()["is_active"] is False
    assert list_response.status_code == 200
    assert list_response.get_json()[0]["role_key"] == "VOLUNTEER_VIEWER"


def test_team_endpoints_create_add_and_remove_member(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    member = _seed_member(session, campaign.id, display_name="Phone Caller")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    member_id = str(member.id)
    session.commit()
    session.close()

    client = app.test_client()
    team_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/teams",
        json={"name": "Phone Bank", "description": "Volunteer callers"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert team_response.status_code == 201
    team_id = team_response.get_json()["id"]

    add_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/teams/{team_id}/members",
        json={"member_id": member_id},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    list_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/teams",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert add_response.status_code == 201
    assert list_response.status_code == 200
    assert list_response.get_json()[0]["member_count"] == 1

    delete_response = client.delete(
        f"/api/v1/campaigns/{campaign_id}/teams/{team_id}/members/{member_id}",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    list_after_delete = client.get(
        f"/api/v1/campaigns/{campaign_id}/teams",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert delete_response.status_code == 204
    assert list_after_delete.get_json()[0]["member_count"] == 0


def test_member_app_access_endpoints_link_invite_and_remove(
    app: Flask,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    linked_user = seed_user(session, name="Linked User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    member = _seed_member(
        session,
        campaign.id,
        display_name="App Access Volunteer",
        email="access@example.com",
    )
    manager_id = str(manager.id)
    linked_user_id = str(linked_user.id)
    campaign_id = str(campaign.id)
    member_id = str(member.id)
    session.commit()
    session.close()

    client = app.test_client()
    link_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/members/{member_id}/link-app-user",
        json={"user_id": linked_user_id, "app_access_status": "active"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert link_response.status_code == 200
    assert link_response.get_json()["app_access_status"] == APP_ACCESS_STATUS_ACTIVE

    invite_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/members/{member_id}/invite-app-access",
        json={"app_access_status": "invited"},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert invite_response.status_code == 200
    assert invite_response.get_json()["app_access_status"] == "invited"

    delete_response = client.delete(
        f"/api/v1/campaigns/{campaign_id}/members/{member_id}/app-access",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert delete_response.status_code == 200
    assert delete_response.get_json()["app_user_id"] is None
    assert delete_response.get_json()["app_access_status"] == APP_ACCESS_STATUS_NONE
