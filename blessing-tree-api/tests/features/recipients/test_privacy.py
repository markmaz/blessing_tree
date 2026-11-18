from types import SimpleNamespace

from app.features.recipients.privacy import (
    external_recipient_first_name,
    external_recipient_group_label,
    external_recipient_label,
)


def test_anonymous_external_labels_never_use_stored_names() -> None:
    recipient = _recipient(
        privacy_level="ANONYMOUS",
        display_label="Ava Johnson",
        public_label="Ava Public",
        first_name="Ava",
        last_name="Johnson",
        program_recipient_id="BT-001-01",
    )

    assert external_recipient_label(recipient) == "BT-001-01"
    assert external_recipient_first_name(recipient) == "Recipient"
    assert external_recipient_group_label(recipient) == "BT-001"


def test_anonymous_external_label_falls_back_to_age_without_an_id() -> None:
    recipient = _recipient(
        privacy_level="ANONYMOUS",
        program_recipient_id=None,
        age=8,
        age_unit="YEARS",
    )

    assert external_recipient_label(recipient) == "Child age 8 years"


def test_initials_and_full_name_levels_emit_only_the_allowed_detail() -> None:
    initials_recipient = _recipient(privacy_level="INITIALS")
    full_name_recipient = _recipient(privacy_level="FULL_NAME")

    assert external_recipient_label(initials_recipient) == "A. J."
    assert external_recipient_first_name(initials_recipient) == "A."
    assert external_recipient_group_label(initials_recipient) == "BT-001"
    assert external_recipient_label(full_name_recipient) == "Ava Public"
    assert external_recipient_first_name(full_name_recipient) == "Ava"
    assert external_recipient_group_label(full_name_recipient) == "Johnson Family"


def _recipient(**overrides):
    values = {
        "privacy_level": "FULL_NAME",
        "display_label": "Ava Johnson",
        "public_label": "Ava Public",
        "first_name": "Ava",
        "last_name": "Johnson",
        "program_recipient_id": "BT-001-01",
        "recipient_kind": "CHILD",
        "age": 8,
        "age_unit": "YEARS",
        "recipient_group": SimpleNamespace(
            group_name="Johnson Family",
            program_group_id="BT-001",
            group_type="HOUSEHOLD",
        ),
    }
    values.update(overrides)
    return SimpleNamespace(**values)
