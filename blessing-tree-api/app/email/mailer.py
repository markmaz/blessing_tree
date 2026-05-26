from __future__ import annotations

from collections.abc import Sequence
from urllib.parse import urlencode

from flask_mail import Message

from app.config import FRONTEND_BASE_URL, ORGANIZATION_NAME
from app.email.layout import email_button, email_heading, email_paragraph, render_branded_email
from app.extensions import mail


def send_email_message(
    *,
    recipients: Sequence[str],
    subject: str,
    html: str,
    text_body: str | None = None,
) -> None:
    recipient_list = [value.strip() for value in recipients if value and value.strip()]
    if not recipient_list:
        raise ValueError("At least one recipient is required")

    message = Message(subject=subject, recipients=recipient_list, html=html)
    if text_body:
        message.body = text_body
    mail.send(message)


def send_admin_invite_email(*, email: str, display_name: str, invite_url: str) -> None:
    greeting_name = display_name.strip() or email.strip()
    subject = f"You're invited to {ORGANIZATION_NAME}"
    body_html = (
        email_heading("You've been invited")
        + email_paragraph(f"Hello {greeting_name},")
        + email_paragraph(
            f"You've been invited to join {ORGANIZATION_NAME}. "
            "Use the secure link below to finish creating your account."
        )
        + email_button(href=invite_url, label="Complete Your Invitation")
        + email_paragraph("If you did not expect this invitation, you can ignore this email.")
    )
    html = render_branded_email(
        title="You're invited",
        preheader=f"Complete your {ORGANIZATION_NAME} invitation.",
        body_html=body_html,
    )
    text = (
        f"Hello {greeting_name},\n\n"
        f"You've been invited to join {ORGANIZATION_NAME}.\n"
        f"Accept your invitation: {invite_url}\n\n"
        "If you did not expect this invitation, you can ignore this email."
    )
    send_email_message(recipients=[email], subject=subject, html=html, text_body=text)


def build_public_sponsor_verification_url(*, public_slug: str, token: str) -> str:
    base = str(FRONTEND_BASE_URL or "http://localhost:5173").rstrip("/")
    return f"{base}/public/campaigns/{public_slug}/sponsor/verify?{urlencode({'token': token})}"


def send_public_sponsor_verification_email(
    *,
    email: str,
    display_name: str,
    campaign_name: str,
    public_slug: str,
    verification_token: str,
) -> None:
    greeting_name = display_name.strip() or email.strip()
    verification_url = build_public_sponsor_verification_url(public_slug=public_slug, token=verification_token)
    subject = f"Verify your sponsor signup for {campaign_name}"
    body_html = (
        email_heading("Verify your sponsor signup")
        + email_paragraph(f"Hello {greeting_name},")
        + email_paragraph(f"Thanks for signing up to sponsor gifts for {campaign_name}.")
        + email_paragraph("Please verify your email address before reserving your selected gifts.")
        + email_button(href=verification_url, label="Verify My Sponsor Signup")
        + email_paragraph("This link expires in 24 hours. If you did not request this, you can ignore this email.")
    )
    html = render_branded_email(
        title="Verify your sponsor signup",
        preheader=f"Verify your email to continue with {campaign_name}.",
        body_html=body_html,
    )
    text = (
        f"Hello {greeting_name},\n\n"
        f"Thanks for signing up to sponsor gifts for {campaign_name}.\n"
        "Please verify your email address to reserve your selected gifts.\n\n"
        f"Verify your sponsor signup: {verification_url}\n\n"
        "This link expires in 24 hours. If you did not request this, you can ignore this email."
    )
    send_email_message(recipients=[email], subject=subject, html=html, text_body=text)
