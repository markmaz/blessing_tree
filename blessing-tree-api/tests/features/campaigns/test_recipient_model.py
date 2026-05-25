from __future__ import annotations

import uuid
from datetime import date, datetime

from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.models.base import Base
from app.models.campaign import Campaign
from app.models.group_contact import GroupContact
from app.models.recipient import Recipient
from app.models.recipient_constants import (
    GROUP_CONTACT_ROLE_PARENT,
    GROUP_CONTACT_ROLE_SOCIAL_WORKER,
    PREFERRED_CONTACT_EMAIL,
    PREFERRED_CONTACT_PHONE,
    RECIPIENT_GROUP_STATUS_ACTIVE,
    RECIPIENT_GROUP_TYPE_ORGANIZATION,
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_KIND_ADULT,
    RECIPIENT_KIND_CHILD,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
    RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT,
    RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
    RECIPIENT_STATUS_ACTIVE,
    WISHLIST_INTAKE_METHOD_PHONE,
    WISHLIST_ITEM_TYPE_CLOTHING,
    WISHLIST_STATUS_READY,
)
from app.models.recipient_group import RecipientGroup
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem


@compiles(TINYINT, "sqlite")
def _compile_tinyint_sqlite(_type, _compiler, **_kwargs) -> str:
    return "INTEGER"


def _build_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(
        engine,
        tables=[
            Campaign.__table__,
            RecipientGroup.__table__,
            GroupContact.__table__,
            Recipient.__table__,
            Wishlist.__table__,
            WishlistItem.__table__,
        ],
    )
    return sessionmaker(bind=engine, autocommit=False, autoflush=False)()


def _create_campaign() -> Campaign:
    return Campaign(
        id=uuid.uuid4(),
        name="Blessing Tree 2026",
        year=2026,
        start_date=date(2026, 11, 1),
        end_date=date(2026, 12, 31),
        status="ACTIVE",
    )


def test_household_child_recipient_flow_supports_group_contact_and_wishlist_metadata() -> None:
    db = _build_session()
    campaign = _create_campaign()
    db.add(campaign)
    db.flush()

    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type=RECIPIENT_GROUP_TYPE_HOUSEHOLD,
        group_name="Johnson Household",
        intake_source="Church Form",
        external_reference="FAM-1001",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    contact = GroupContact(
        id=uuid.uuid4(),
        recipient_group_id=group.id,
        contact_role=GROUP_CONTACT_ROLE_PARENT,
        relationship_label="Mother",
        first_name="Sarah",
        last_name="Johnson",
        email="sarah@example.com",
        preferred_contact=PREFERRED_CONTACT_EMAIL,
        is_primary=True,
        can_pick_up=True,
        is_emergency_contact=True,
    )
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=group.id,
        recipient_kind=RECIPIENT_KIND_CHILD,
        program_type=RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY,
        privacy_level=RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
        display_label="Ava Johnson",
        first_name="Ava",
        last_name="Johnson",
        birth_year=2018,
        age=8,
        status=RECIPIENT_STATUS_ACTIVE,
    )
    wishlist = Wishlist(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_id=recipient.id,
        wishlist_status=WISHLIST_STATUS_READY,
        intake_method=WISHLIST_INTAKE_METHOD_PHONE,
        submitted_at=datetime(2026, 10, 10, 12, 0, 0),
        intake_completed_by_contact_id=contact.id,
    )
    item = WishlistItem(
        id=uuid.uuid4(),
        wishlist_id=wishlist.id,
        category="Clothing",
        item_type=WISHLIST_ITEM_TYPE_CLOTHING,
        description="Winter coat",
        size="8",
        qty_requested=1,
        priority="HIGH",
        allow_substitute=False,
        do_not_substitute_reason="Child has sensory preferences.",
        recipient_note="Prefers blue.",
        status="OPEN",
        qty_fulfilled=0,
        label_code="recipient-model-1",
        label_version=1,
    )

    db.add_all([group, contact, recipient, wishlist, item])
    db.commit()
    db.refresh(group)
    db.refresh(contact)
    db.refresh(recipient)
    db.refresh(wishlist)
    db.refresh(item)

    assert group.status == RECIPIENT_GROUP_STATUS_ACTIVE
    assert group.external_reference == "FAM-1001"
    assert bool(contact.can_pick_up) is True
    assert bool(contact.is_emergency_contact) is True
    assert recipient.recipient_kind == RECIPIENT_KIND_CHILD
    assert recipient.program_type == RECIPIENT_PROGRAM_TYPE_CHILD_FAMILY
    assert wishlist.intake_completed_by_contact is not None
    assert wishlist.intake_completed_by_contact.email == "sarah@example.com"
    assert item.item_type == WISHLIST_ITEM_TYPE_CLOTHING
    assert item.do_not_substitute_reason == "Child has sensory preferences."
    assert item.recipient_note == "Prefers blue."
    db.close()


def test_organization_recipient_flow_supports_direct_contact_fields() -> None:
    db = _build_session()
    campaign = _create_campaign()
    db.add(campaign)
    db.flush()

    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type=RECIPIENT_GROUP_TYPE_ORGANIZATION,
        organization_type="SENIOR_PROGRAM",
        group_name="Maple Grove - West Wing",
        program_abbreviation="MGWW",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
    )
    contact = GroupContact(
        id=uuid.uuid4(),
        recipient_group_id=group.id,
        contact_role=GROUP_CONTACT_ROLE_SOCIAL_WORKER,
        first_name="Janet",
        last_name="Miles",
        phone="555-9000",
        preferred_contact=PREFERRED_CONTACT_PHONE,
        is_primary=True,
    )
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=group.id,
        recipient_kind=RECIPIENT_KIND_ADULT,
        program_type=RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT,
        privacy_level=RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
        display_label="Mary Smith",
        program_recipient_number=1,
        program_recipient_id="MGWW-001",
        first_name="Mary",
        last_name="Smith",
        age=84,
        address_line1="400 Elm St",
        city="Dallas",
        state="TX",
        postal_code="75001",
        direct_phone="555-1111",
        direct_email="mary.smith@example.com",
        facility_room="214B",
        mobility_notes="Uses a walker.",
        status=RECIPIENT_STATUS_ACTIVE,
    )

    db.add_all([group, contact, recipient])
    db.commit()
    db.refresh(recipient)
    db.refresh(group)

    assert group.group_type == RECIPIENT_GROUP_TYPE_ORGANIZATION
    assert group.program_abbreviation == "MGWW"
    assert recipient.recipient_kind == RECIPIENT_KIND_ADULT
    assert recipient.program_type == RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT
    assert recipient.program_recipient_number == 1
    assert recipient.program_recipient_id == "MGWW-001"
    assert recipient.address_line1 == "400 Elm St"
    assert recipient.city == "Dallas"
    assert recipient.state == "TX"
    assert recipient.postal_code == "75001"
    assert recipient.direct_email == "mary.smith@example.com"
    assert recipient.direct_phone == "555-1111"
    assert recipient.facility_room == "214B"
    assert recipient.mobility_notes == "Uses a walker."
    db.close()


def test_second_organization_context_can_store_group_and_direct_contact_details() -> None:
    db = _build_session()
    campaign = _create_campaign()
    db.add(campaign)
    db.flush()

    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type=RECIPIENT_GROUP_TYPE_ORGANIZATION,
        organization_type="SENIOR_PROGRAM",
        group_name="Senior At Home",
        program_abbreviation="SAH",
        status=RECIPIENT_GROUP_STATUS_ACTIVE,
        address_line1="100 Program Way",
        city="Austin",
        state="TX",
        postal_code="78701",
    )
    contact = GroupContact(
        id=uuid.uuid4(),
        recipient_group_id=group.id,
        contact_role=GROUP_CONTACT_ROLE_SOCIAL_WORKER,
        first_name="Jordan",
        last_name="Carey",
        email="jordan@example.com",
        preferred_contact=PREFERRED_CONTACT_EMAIL,
        is_primary=True,
    )
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=group.id,
        recipient_kind=RECIPIENT_KIND_ADULT,
        program_type=RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT,
        privacy_level=RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
        display_label="James Carter",
        program_recipient_number=1,
        program_recipient_id="SAH-001",
        first_name="James",
        last_name="Carter",
        age=79,
        address_line1="42 Oak Drive",
        city="Round Rock",
        state="TX",
        postal_code="78664",
        direct_phone="555-2222",
        direct_email="james.carter@example.com",
        status=RECIPIENT_STATUS_ACTIVE,
    )

    db.add_all([group, contact, recipient])
    db.commit()
    db.refresh(group)
    db.refresh(recipient)

    assert group.group_type == RECIPIENT_GROUP_TYPE_ORGANIZATION
    assert group.program_abbreviation == "SAH"
    assert group.address_line1 == "100 Program Way"
    assert recipient.program_type == RECIPIENT_PROGRAM_TYPE_ORGANIZATION_ADULT
    assert recipient.program_recipient_number == 1
    assert recipient.program_recipient_id == "SAH-001"
    assert recipient.address_line1 == "42 Oak Drive"
    assert recipient.city == "Round Rock"
    assert recipient.state == "TX"
    assert recipient.postal_code == "78664"
    assert recipient.direct_email == "james.carter@example.com"
    assert recipient.direct_phone == "555-2222"
    db.close()
