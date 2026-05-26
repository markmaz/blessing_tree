from __future__ import annotations

from app.email import mailer
from app.email.layout import COLOR_CARD, COLOR_PURPLE, COLOR_WARM_BACKGROUND, LOGO_URL, email_button, render_branded_email
from app.features.campaigns.template_renderer import CampaignTemplateRenderer


class _DummyMail:
    def __init__(self) -> None:
        self.sent = []

    def send(self, message) -> None:
        self.sent.append(message)


class _FakeMessage:
    def __init__(self, *, subject: str, recipients: list[str], html: str) -> None:
        self.subject = subject
        self.recipients = recipients
        self.html = html
        self.body = None


def test_render_branded_email_keeps_queryforge_layout_with_blessing_tree_colors() -> None:
    html = render_branded_email(title="Welcome", body_html="<p>Hello</p>", preheader="Preview")

    assert LOGO_URL in html
    assert f"background-color:{COLOR_WARM_BACKGROUND}" in html
    assert f"background-color:{COLOR_CARD}" in html
    assert f"background-color:{COLOR_PURPLE}" not in html.split("<body", 1)[1].split(">", 1)[0]
    assert "Preview" in html


def test_email_button_uses_blessing_tree_primary_cta() -> None:
    html = email_button(href="https://example.com/path?token=abc", label="Open")

    assert "https://example.com/path?token=abc" in html
    assert f"background-color:{COLOR_PURPLE}" in html
    assert ">Open</a>" in html


def test_admin_invite_email_uses_branded_layout(monkeypatch) -> None:
    dummy_mail = _DummyMail()
    monkeypatch.setattr(mailer, "mail", dummy_mail)
    monkeypatch.setattr(mailer, "Message", _FakeMessage)

    mailer.send_admin_invite_email(
        email="user@example.com",
        display_name="User Example",
        invite_url="https://docker.blessing-tree.com/auth/register?token=abc",
    )

    assert len(dummy_mail.sent) == 1
    message = dummy_mail.sent[0]
    assert message.recipients == ["user@example.com"]
    assert LOGO_URL in message.html
    assert "Complete Your Invitation" in message.html
    assert "https://docker.blessing-tree.com/auth/register?token=abc" in message.html
    assert "Accept your invitation:" in message.body


def test_public_sponsor_verification_email_uses_branded_layout(monkeypatch) -> None:
    dummy_mail = _DummyMail()
    monkeypatch.setattr(mailer, "mail", dummy_mail)
    monkeypatch.setattr(mailer, "Message", _FakeMessage)
    monkeypatch.setattr(mailer, "FRONTEND_BASE_URL", "https://docker.blessing-tree.com")

    mailer.send_public_sponsor_verification_email(
        email="sponsor@example.com",
        display_name="Sponsor Example",
        campaign_name="Christmas Giving",
        public_slug="christmas-giving",
        verification_token="tok",
    )

    message = dummy_mail.sent[0]
    assert LOGO_URL in message.html
    assert "Verify My Sponsor Signup" in message.html
    assert "/public/campaigns/christmas-giving/sponsor/verify?token=tok" in message.html
    assert "Verify your sponsor signup:" in message.body


def test_campaign_template_renderer_wraps_template_email_in_branded_layout() -> None:
    subject, html, text = CampaignTemplateRenderer().render(
        campaign_name="Christmas Giving",
        campaign_year=2026,
        subject_template="Reminder for {{campaign.name}}",
        body_template="Hello {{sponsor.name}}, gifts are due soon.",
        merge_fields={"sponsor.name": "Alex"},
    )

    assert subject == "Reminder for Christmas Giving"
    assert LOGO_URL in html
    assert "Hello Alex, gifts are due soon." in html
    assert text == "Hello Alex, gifts are due soon."
