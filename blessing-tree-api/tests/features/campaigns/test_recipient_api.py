from __future__ import annotations

import uuid

import pytest

from app.features.campaigns import api as campaign_api_module
from app.features.campaigns import recipient_api as recipient_api_module
from app.models.group_contact import GroupContact
from app.models.recipient import Recipient
from app.models.recipient_constants import (
    GROUP_CONTACT_ROLE_PARENT,
    PREFERRED_CONTACT_EMAIL,
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_KIND_ADULT,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
    RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_STATUS_ACTIVE,
    WISHLIST_ITEM_TYPE_GIFT,
    WISHLIST_STATUS_READY,
)
from app.models.recipient_group import RecipientGroup
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem
from tests.features.campaigns.studio_test_support import (
    assign_role,
    auth_header,
    install_auth,
    seed_campaign,
    seed_user,
)

pytest_plugins = ("tests.features.campaigns.studio_test_support",)


def _seed_household_group(session, campaign_id):
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name="Johnson Household",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    session.add(group)
    session.flush()
    return group


def _seed_adult_program_group(session, campaign_id):
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        group_type=RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
        group_name="Senior At Home",
        program_abbreviation="SAH",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    session.add(group)
    session.flush()
    return group


def test_people_workspace_returns_groups_recipients_and_counts(app, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")

    household = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name="Johnson Household",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    facility = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type=RECIPIENT_GROUP_TYPE_ADULT_PROGRAM,
        group_name="Maple Grove",
        program_abbreviation="MG",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    session.add_all([household, facility])
    session.flush()
    contact = GroupContact(
        id=uuid.uuid4(),
        recipient_group_id=household.id,
        contact_role=GROUP_CONTACT_ROLE_PARENT,
        first_name="Sarah",
        preferred_contact=PREFERRED_CONTACT_EMAIL,
        email="sarah@example.com",
        is_primary=True,
        can_pick_up=True,
    )
    child = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=household.id,
        recipient_kind=RECIPIENT_KIND_CHILD,
        program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
        privacy_level=RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
        display_label="Ava Johnson",
        status=RECIPIENT_STATUS_ACTIVE,
    )
    adult = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=facility.id,
        recipient_kind=RECIPIENT_KIND_ADULT,
        program_type=RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM,
        privacy_level=RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
        display_label="Mary Smith",
        program_recipient_number=1,
        program_recipient_id="MG-001",
        direct_email="mary@example.com",
        status=RECIPIENT_STATUS_ACTIVE,
    )
    session.add_all([contact, child, adult])
    session.flush()
    wishlist = Wishlist(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_id=child.id,
        wishlist_status=WISHLIST_STATUS_READY,
    )
    session.add(wishlist)
    session.flush()
    session.add(
        WishlistItem(
            id=uuid.uuid4(),
            wishlist_id=wishlist.id,
            item_type=WISHLIST_ITEM_TYPE_GIFT,
            description="Toy train",
            qty_requested=1,
            priority="MEDIUM",
            allow_substitute=True,
            status="OPEN",
            qty_fulfilled=0,
            label_code="people-workspace-item-1",
            label_version=1,
        )
    )
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/people-workspace",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["counts"]["group_count"] == 2
    assert payload["counts"]["household_count"] == 1
    assert payload["counts"]["adult_program_count"] == 1
    assert payload["counts"]["recipient_count"] == 2
    assert payload["counts"]["wishlist_count"] == 1
    assert payload["counts"]["open_item_count"] == 1
    assert payload["counts"]["sponsored_item_count"] == 0
    assert payload["counts"]["fulfilled_item_count"] == 0
    assert payload["counts"]["ready_for_pickup_item_count"] == 0
    assert payload["counts"]["picked_up_item_count"] == 0
    assert payload["counts"]["groups_with_pickup_contacts_count"] == 1
    assert payload["counts"]["groups_missing_primary_contact_count"] == 1
    assert payload["counts"]["adults_with_direct_contact_count"] == 1
    assert payload["groups"][1]["program_abbreviation"] == "MG"
    assert payload["recipients"][1]["program_recipient_id"] == "MG-001"
    assert payload["groups"][0]["contacts"][0]["email"] == "sarah@example.com"
    assert payload["groups"][0]["authorized_pickup_contacts"][0]["email"] == "sarah@example.com"
    assert payload["groups"][0]["workflow_summary"]["open_item_count"] == 1
    assert payload["recipients"][0]["wishlist"]["items"][0]["gift_workflow"]["label_code"] == "people-workspace-item-1"
    assert payload["recipients"][0]["wishlist"]["items"][0]["gift_workflow"]["sponsorship_status"] == "UNSPONSORED"
    assert payload["recipients"][0]["workflow_summary"]["open_item_count"] == 1
    assert sorted(payload["filters"]["program_types"]) == [
        "ADULT_PROGRAM",
        RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    ]


def test_group_recipient_and_wishlist_crud_flow(app, monkeypatch: pytest.MonkeyPatch) -> None:
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

    create_group_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/recipient-groups",
        json={
            "group_type": "HOUSEHOLD",
            "group_name": "Baker Household",
            "intake_source": "Call Center",
            "status": "ACTIVE",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert create_group_response.status_code == 201
    group_id = create_group_response.get_json()["id"]

    create_contact_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/recipient-groups/{group_id}/contacts",
        json={
            "contact_role": "PARENT",
            "first_name": "Taylor",
            "email": "taylor@example.com",
            "preferred_contact": "EMAIL",
            "is_primary": True,
            "can_pick_up": True,
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert create_contact_response.status_code == 201
    contact_id = create_contact_response.get_json()["id"]

    create_recipient_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/recipients",
        json={
            "recipient_group_id": group_id,
            "recipient_kind": "CHILD",
            "program_type": "CHILD_FAMILY",
            "privacy_level": "FULL_NAME",
            "display_label": "Eli Baker",
            "first_name": "Eli",
            "age": 7,
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert create_recipient_response.status_code == 201
    recipient_id = create_recipient_response.get_json()["id"]

    upsert_wishlist_response = client.put(
        f"/api/v1/campaigns/{campaign_id}/recipients/{recipient_id}/wishlist",
        json={
            "wishlist_status": "READY",
            "intake_method": "PHONE",
            "intake_completed_by_contact_id": contact_id,
            "notes": "Collected during intake call.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert upsert_wishlist_response.status_code == 200
    assert upsert_wishlist_response.get_json()["wishlist_status"] == "READY"

    create_item_response = client.post(
        f"/api/v1/campaigns/{campaign_id}/recipients/{recipient_id}/wishlist/items",
        json={
            "item_type": "GIFT",
            "description": "Soccer ball",
            "qty_requested": 1,
            "priority": "HIGH",
            "allow_substitute": False,
            "recipient_note": "Prefers blue and black.",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    assert create_item_response.status_code == 201
    item_id = create_item_response.get_json()["id"]

    update_item_response = client.patch(
        f"/api/v1/campaigns/{campaign_id}/recipients/{recipient_id}/wishlist/items/{item_id}",
        json={"size": "Youth", "do_not_substitute_reason": "Requested specifically for team use."},
        headers=auth_header(manager_id, "VOLUNTEER"),
    )
    wishlist_response = client.get(
        f"/api/v1/campaigns/{campaign_id}/recipients/{recipient_id}/wishlist",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert update_item_response.status_code == 200
    assert wishlist_response.status_code == 200
    payload = wishlist_response.get_json()
    assert payload["intake_completed_by_contact"]["email"] == "taylor@example.com"
    assert payload["items"][0]["description"] == "Soccer ball"
    assert payload["items"][0]["size"] == "Youth"
    assert payload["items"][0]["gift_workflow"]["remaining_qty"] == 1


def test_recipient_address_search_returns_suggestions(app, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    session.commit()
    session.close()

    monkeypatch.setattr(
        recipient_api_module._address_lookup_service,
        "search",
        lambda query, country_code=None, limit=5: [
            {
                "label": "123 Main St, Austin, TX, 78701",
                "address_line1": "123 Main St",
                "city": "Austin",
                "state": "TX",
                "postal_code": "78701",
            }
        ],
    )

    client = app.test_client()
    response = client.get(
        f"/api/v1/campaigns/{campaign_id}/recipient-address-search?q=123+Main",
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["suggestions"][0]["address_line1"] == "123 Main St"
    assert payload["suggestions"][0]["city"] == "Austin"


def test_recipient_program_alignment_rejects_invalid_group_program_combination(app, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    household = _seed_household_group(session, campaign.id)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    group_id = str(household.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/recipients",
        json={
            "recipient_group_id": group_id,
            "recipient_kind": "ADULT",
            "program_type": "ADULT_PROGRAM",
            "privacy_level": "FULL_NAME",
            "display_label": "Invalid Household Adult",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 400
    assert "Household groups" in response.get_json()["error"]


def test_adult_program_recipient_accepts_direct_contact_fields(app, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    adult_program = _seed_adult_program_group(session, campaign.id)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    group_id = str(adult_program.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/recipients",
        json={
            "recipient_group_id": group_id,
            "recipient_kind": "ADULT",
            "program_type": "ADULT_PROGRAM",
            "privacy_level": "FULL_NAME",
            "display_label": "Mary Carter",
            "first_name": "Mary",
            "last_name": "Carter",
            "address_line1": "12 River Road",
            "city": "Austin",
            "state": "TX",
            "postal_code": "78702",
            "direct_email": "mary.carter@example.com",
            "direct_phone": "555-4444",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 201
    payload = response.get_json()
    assert payload["program_type"] == RECIPIENT_PROGRAM_TYPE_ADULT_PROGRAM
    assert payload["program_recipient_number"] == 1
    assert payload["program_recipient_id"] == "SAH-001"
    assert payload["address_line1"] == "12 River Road"
    assert payload["city"] == "Austin"
    assert payload["state"] == "TX"
    assert payload["postal_code"] == "78702"
    assert payload["direct_email"] == "mary.carter@example.com"
    assert payload["direct_phone"] == "555-4444"


def test_adult_program_group_requires_program_abbreviation(app, monkeypatch: pytest.MonkeyPatch) -> None:
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
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/recipient-groups",
        json={
            "group_type": "ADULT_PROGRAM",
            "group_name": "Senior At Home",
            "status": "ACTIVE",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 400
    assert response.get_json()["error"] == "program_abbreviation is required"


def test_household_child_rejects_direct_contact_fields(app, monkeypatch: pytest.MonkeyPatch) -> None:
    install_auth(monkeypatch)
    session = campaign_api_module.SessionLocal()
    manager = seed_user(session, name="Manager User")
    campaign = seed_campaign(session)
    assign_role(session, manager, campaign, "CAMPAIGN_MANAGER")
    household = _seed_household_group(session, campaign.id)
    manager_id = str(manager.id)
    campaign_id = str(campaign.id)
    group_id = str(household.id)
    session.commit()
    session.close()

    client = app.test_client()
    response = client.post(
        f"/api/v1/campaigns/{campaign_id}/recipients",
        json={
            "recipient_group_id": group_id,
            "recipient_kind": "CHILD",
            "program_type": "CHILD_FAMILY",
            "privacy_level": "FULL_NAME",
            "display_label": "Ava Jones",
            "address_line1": "12 River Road",
            "direct_email": "ava@example.com",
        },
        headers=auth_header(manager_id, "VOLUNTEER"),
    )

    assert response.status_code == 400
    assert "direct contact" in response.get_json()["error"].lower()
