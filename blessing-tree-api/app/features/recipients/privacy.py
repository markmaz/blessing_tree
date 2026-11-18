from __future__ import annotations

import re

from app.models.recipient import Recipient
from app.models.recipient_constants import (
    RECIPIENT_GROUP_TYPE_HOUSEHOLD,
    RECIPIENT_PRIVACY_LEVEL_ANONYMOUS,
    RECIPIENT_PRIVACY_LEVEL_FULL_NAME,
    RECIPIENT_PRIVACY_LEVEL_INITIALS,
)


def external_recipient_label(recipient: Recipient | None) -> str:
    """Return the recipient label allowed on public, emailed, or printed output."""
    if recipient is None:
        return "Recipient"

    privacy_level = str(recipient.privacy_level or RECIPIENT_PRIVACY_LEVEL_ANONYMOUS).upper()
    if privacy_level == RECIPIENT_PRIVACY_LEVEL_ANONYMOUS:
        return str(recipient.program_recipient_id or "").strip() or _anonymous_label(recipient)
    if privacy_level == RECIPIENT_PRIVACY_LEVEL_INITIALS:
        return _initials_label(recipient)
    if privacy_level == RECIPIENT_PRIVACY_LEVEL_FULL_NAME:
        return _full_name_label(recipient)
    return _anonymous_label(recipient)


def external_recipient_first_name(recipient: Recipient | None) -> str:
    if recipient is None:
        return "Recipient"
    privacy_level = str(recipient.privacy_level or RECIPIENT_PRIVACY_LEVEL_ANONYMOUS).upper()
    if privacy_level == RECIPIENT_PRIVACY_LEVEL_ANONYMOUS:
        return "Recipient"
    if privacy_level == RECIPIENT_PRIVACY_LEVEL_INITIALS:
        first_name = str(recipient.first_name or "").strip()
        return f"{first_name[0].upper()}." if first_name else external_recipient_label(recipient)
    return _first_token(external_recipient_label(recipient))


def external_recipient_group_label(recipient: Recipient | None) -> str:
    if recipient is None or recipient.recipient_group is None:
        return ""
    if str(recipient.privacy_level or "").upper() == RECIPIENT_PRIVACY_LEVEL_FULL_NAME:
        return str(recipient.recipient_group.group_name or "").strip()
    program_group_id = str(recipient.recipient_group.program_group_id or "").strip()
    if program_group_id:
        return program_group_id
    if recipient.recipient_group.group_type == RECIPIENT_GROUP_TYPE_HOUSEHOLD:
        return "Household"
    return "Organization"


def _anonymous_label(recipient: Recipient) -> str:
    age = recipient.age
    subject = "Child" if recipient.recipient_kind == "CHILD" else "Recipient"
    if age is None:
        return subject
    unit = "months" if recipient.age_unit == "MONTHS" else "years"
    return f"{subject} age {age} {unit}"


def _initials_label(recipient: Recipient) -> str:
    name_parts = [
        str(value or "").strip()
        for value in (recipient.first_name, recipient.last_name)
        if str(value or "").strip()
    ]
    if not name_parts:
        name_parts = re.findall(r"[A-Za-z]+", str(recipient.display_label or ""))
    initials = " ".join(f"{part[0].upper()}." for part in name_parts if part)
    return initials or str(recipient.program_recipient_id or "").strip() or _anonymous_label(recipient)


def _full_name_label(recipient: Recipient) -> str:
    public_label = str(recipient.public_label or "").strip()
    if public_label:
        return public_label
    display_label = str(recipient.display_label or "").strip()
    if display_label:
        return display_label
    full_name = " ".join(
        part for part in [str(recipient.first_name or "").strip(), str(recipient.last_name or "").strip()] if part
    )
    return full_name or str(recipient.program_recipient_id or "").strip() or "Recipient"


def _first_token(value: str) -> str:
    return value.split(" ", 1)[0] if value else "Recipient"
