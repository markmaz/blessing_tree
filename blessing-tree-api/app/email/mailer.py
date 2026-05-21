from __future__ import annotations

from collections.abc import Sequence

from flask_mail import Message

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
