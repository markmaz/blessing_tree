from __future__ import annotations

import uuid
from datetime import UTC, date, datetime, timedelta

import pytest
from sqlalchemy import create_engine
from sqlalchemy.dialects.mysql import TINYINT
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session, sessionmaker

import app.models.models  # noqa: F401
from app.features.campaigns.automation_dispatch_service import (
    CampaignAutomationDispatchService,
)
from app.features.campaigns.automation_lifecycle_service import (
    CampaignAutomationLifecycleService,
)
from app.features.campaigns.automation_repository import CampaignAutomationRepository
from app.features.campaigns.studio_service import CampaignStudioService
from app.models.app_user import AppUser
from app.models.campaign import Campaign
from app.models.campaign_automation_execution import CampaignAutomationExecution
from app.models.campaign_communication_schedule import CampaignCommunicationSchedule
from app.models.campaign_member import CampaignMember
from app.models.campaign_member_access_role import CampaignMemberAccessRole
from app.models.campaign_milestone import CampaignMilestone
from app.models.communication_template import CommunicationTemplate
from app.models.group_contact import GroupContact
from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup


@compiles(TINYINT, "sqlite")
def _compile_tinyint_sqlite(_type, _compiler, **_kwargs) -> str:
    return "INTEGER"


@pytest.fixture
def db_session() -> Session:
    engine = create_engine("sqlite:///:memory:")
    from app.models.base import Base

    Base.metadata.create_all(engine)
    session_factory = sessionmaker(bind=engine, autocommit=False, autoflush=False)
    session = session_factory()
    try:
        yield session
    finally:
        session.close()


def test_repository_lists_due_schedules_for_absolute_and_milestone_dates(
    db_session: Session,
) -> None:
    campaign = _seed_campaign(db_session, status="ACTIVE")
    template = _seed_template(db_session, campaign_id=campaign.id)
    past_milestone = CampaignMilestone(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        milestone_key="registration_open",
        label="Registration Opens",
        occurs_on=date(2026, 10, 1),
        sort_order=1,
    )
    future_milestone = CampaignMilestone(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        milestone_key="pickup_start",
        label="Pickup Opens",
        occurs_on=date(2026, 12, 28),
        sort_order=2,
    )
    due_direct = CampaignCommunicationSchedule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        scheduled_for=datetime(2026, 10, 2, 9, 0, 0),
        status="SCHEDULED",
    )
    due_milestone = CampaignCommunicationSchedule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        milestone_key="registration_open",
        status="SCHEDULED",
    )
    future_schedule = CampaignCommunicationSchedule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        milestone_key="pickup_start",
        status="SCHEDULED",
    )
    db_session.add_all([past_milestone, future_milestone, due_direct, due_milestone, future_schedule])
    db_session.commit()

    repository = CampaignAutomationRepository()
    due_ids = repository.list_due_schedule_ids(
        db_session,
        now=datetime(2026, 10, 3, 12, 0, 0),
    )

    assert set(due_ids) == {str(due_direct.id), str(due_milestone.id)}


def test_dispatch_schedule_sends_email_and_records_success(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    campaign = _seed_campaign(db_session, status="ACTIVE")
    template = _seed_template(db_session, campaign_id=campaign.id, audience="VOLUNTEER")
    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        display_name="Casey Volunteer",
        email="casey@example.com",
        member_type="volunteer",
        app_access_status="none",
        is_active=True,
    )
    schedule = CampaignCommunicationSchedule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        scheduled_for=datetime(2026, 11, 2, 9, 0, 0),
        status="SCHEDULED",
    )
    db_session.add_all([member, schedule])
    db_session.commit()

    deliveries: list[dict[str, object]] = []

    def _fake_send_email_message(*, recipients, subject, html, text_body=None) -> None:
        deliveries.append(
            {
                "recipients": recipients,
                "subject": subject,
                "html": html,
                "text_body": text_body,
            }
        )

    monkeypatch.setattr(
        "app.features.campaigns.automation_dispatch_service.send_email_message",
        _fake_send_email_message,
    )

    result = CampaignAutomationDispatchService().dispatch_schedule(
        db_session,
        schedule_id=str(schedule.id),
    )

    db_session.refresh(schedule)
    execution = db_session.query(CampaignAutomationExecution).one()
    assert result["status"] == "SUCCEEDED"
    assert len(deliveries) == 1
    assert deliveries[0]["recipients"] == ["casey@example.com"]
    assert "Volunteer Welcome" in deliveries[0]["subject"]
    assert schedule.last_dispatched_at is not None
    assert schedule.last_delivery_status == "SENT"
    assert execution.status == "SUCCEEDED"
    assert execution.recipient_count == 1
    assert execution.delivered_count == 1
    assert execution.failed_count == 0


def test_dispatch_schedule_resolves_household_contacts(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    campaign = _seed_campaign(db_session, status="ACTIVE")
    template = _seed_template(
        db_session,
        campaign_id=campaign.id,
        audience="HOUSEHOLD_CONTACT",
        body_template="Hello {{contact.full_name}} from {{group.name}}",
    )
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type="HOUSEHOLD",
        group_name="Johnson Household",
        status="ACTIVE",
    )
    contact = GroupContact(
        id=uuid.uuid4(),
        recipient_group_id=group.id,
        contact_role="PARENT",
        first_name="Jamie",
        last_name="Johnson",
        email="jamie@example.com",
        preferred_contact="EMAIL",
        is_primary=True,
        can_pick_up=True,
        is_emergency_contact=False,
    )
    schedule = CampaignCommunicationSchedule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        scheduled_for=datetime(2026, 11, 2, 9, 0, 0),
        status="SCHEDULED",
    )
    db_session.add_all([group, contact, schedule])
    db_session.commit()

    deliveries: list[dict[str, object]] = []

    def _fake_send_email_message(*, recipients, subject, html, text_body=None) -> None:
        deliveries.append(
            {
                "recipients": recipients,
                "subject": subject,
                "html": html,
                "text_body": text_body,
            }
        )

    monkeypatch.setattr(
        "app.features.campaigns.automation_dispatch_service.send_email_message",
        _fake_send_email_message,
    )

    result = CampaignAutomationDispatchService().dispatch_schedule(
        db_session,
        schedule_id=str(schedule.id),
    )

    assert result["status"] == "SUCCEEDED"
    assert deliveries[0]["recipients"] == ["jamie@example.com"]
    assert "Jamie Johnson" in str(deliveries[0]["html"])
    assert "Johnson Household" in str(deliveries[0]["html"])


def test_dispatch_schedule_resolves_direct_adult_recipients(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    campaign = _seed_campaign(db_session, status="ACTIVE")
    template = _seed_template(
        db_session,
        campaign_id=campaign.id,
        audience="ADULT_RECIPIENT_DIRECT",
        body_template="Hello {{recipient.full_name}}",
    )
    group = RecipientGroup(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        group_type="ADULT_PROGRAM",
        group_name="Maple Grove",
        status="ACTIVE",
    )
    recipient = Recipient(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        recipient_group_id=group.id,
        recipient_kind="ADULT",
        program_type="ADULT_PROGRAM",
        privacy_level="FULL_NAME",
        display_label="Mary Smith",
        first_name="Mary",
        last_name="Smith",
        direct_email="mary@example.com",
        status="ACTIVE",
    )
    schedule = CampaignCommunicationSchedule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        scheduled_for=datetime(2026, 11, 2, 9, 0, 0),
        status="SCHEDULED",
    )
    db_session.add_all([group, recipient, schedule])
    db_session.commit()

    deliveries: list[dict[str, object]] = []

    def _fake_send_email_message(*, recipients, subject, html, text_body=None) -> None:
        deliveries.append(
            {
                "recipients": recipients,
                "subject": subject,
                "html": html,
                "text_body": text_body,
            }
        )

    monkeypatch.setattr(
        "app.features.campaigns.automation_dispatch_service.send_email_message",
        _fake_send_email_message,
    )

    result = CampaignAutomationDispatchService().dispatch_schedule(
        db_session,
        schedule_id=str(schedule.id),
    )

    assert result["status"] == "SUCCEEDED"
    assert deliveries[0]["recipients"] == ["mary@example.com"]
    assert "Mary Smith" in str(deliveries[0]["html"])


def test_activate_campaign_blocks_until_readiness_is_ready(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    campaign = _seed_campaign(
        db_session,
        name="Draft Campaign",
        status="DRAFT",
        start_date=date(2026, 11, 1),
    )
    monkeypatch.setattr(
        "app.features.campaigns.automation_readiness_service.campaign_worker_is_healthy",
        lambda: True,
    )

    result = CampaignAutomationLifecycleService().activate_campaign(
        db_session,
        campaign_id=str(campaign.id),
    )

    db_session.refresh(campaign)
    execution = db_session.query(CampaignAutomationExecution).one()
    assert result["status"] == "BLOCKED"
    assert campaign.status == "DRAFT"
    assert execution.status == "BLOCKED"
    assert "activation_not_ready" in (execution.details_json or "")


def test_readiness_reports_worker_health_and_recent_automation_issues(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    manager_user = AppUser(
        id=uuid.uuid4(),
        email="manager@example.com",
        display_name="Manager User",
        role="ADMIN",
        is_active=True,
    )
    campaign = _seed_campaign(db_session, status="ACTIVE")
    template = _seed_template(db_session, campaign_id=campaign.id, audience="MANAGER")
    member = CampaignMember(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        display_name="Manager User",
        email="manager@example.com",
        member_type="staff",
        app_user_id=manager_user.id,
        app_access_status="active",
        is_active=True,
    )
    manager_role = CampaignMemberAccessRole(
        id=uuid.uuid4(),
        campaign_member_id=member.id,
        role_key="CAMPAIGN_MANAGER",
        is_active=True,
    )
    schedule = CampaignCommunicationSchedule(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        template_id=template.id,
        scheduled_for=datetime(2026, 11, 2, 9, 0, 0),
        status="SCHEDULED",
    )
    failed_execution = CampaignAutomationExecution(
        id=uuid.uuid4(),
        campaign_id=campaign.id,
        schedule_id=schedule.id,
        execution_type="COMMUNICATION_DISPATCH",
        action_key="dispatch_due_communications",
        status="FAILED",
        recipient_count=1,
        delivered_count=0,
        failed_count=1,
        created_at=datetime.now(UTC).replace(tzinfo=None) - timedelta(hours=1),
        completed_at=datetime.now(UTC).replace(tzinfo=None),
    )
    db_session.add_all([manager_user, member, manager_role, schedule, failed_execution])
    db_session.commit()

    monkeypatch.setattr(
        "app.features.campaigns.automation_readiness_service.campaign_worker_is_healthy",
        lambda: False,
    )

    readiness = CampaignStudioService().get_readiness(db_session, str(campaign.id))
    codes = {item["code"] for item in readiness["items"]}

    assert "automation_worker_unavailable" in codes
    assert "automation_recent_failures" in codes


def _seed_campaign(
    db_session: Session,
    *,
    name: str = "Automation Campaign",
    status: str,
    start_date: date | None = None,
    end_date: date | None = None,
) -> Campaign:
    campaign = Campaign(
        id=uuid.uuid4(),
        name=name,
        description="Automation-ready campaign",
        year=2026,
        start_date=start_date or date(2026, 11, 1),
        end_date=end_date or date(2026, 12, 20),
        status=status,
    )
    db_session.add(campaign)
    db_session.flush()
    return campaign


def _seed_template(
    db_session: Session,
    *,
    campaign_id,
    audience: str = "GENERAL",
    body_template: str = "Hello {{volunteer.full_name}}",
) -> CommunicationTemplate:
    template = CommunicationTemplate(
        id=uuid.uuid4(),
        campaign_id=campaign_id,
        template_key=f"volunteer_welcome_{uuid.uuid4().hex[:6]}",
        name="Volunteer Welcome",
        audience=audience,
        channel="EMAIL",
        subject_template="Volunteer Welcome for {{campaign.name}}",
        body_template=body_template,
        is_active=True,
        created_by_user_id=None,
    )
    db_session.add(template)
    db_session.flush()
    return template
