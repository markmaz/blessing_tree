from __future__ import annotations

from app.models.recipient import Recipient


def recipient_age_label(recipient: Recipient | None) -> str:
    if recipient is None or recipient.age is None:
        return ""
    unit = "month" if recipient.age_unit == "MONTHS" else "year"
    return f"{recipient.age} {unit}{'' if recipient.age == 1 else 's'}"


def format_sponsor_gift_list(rows: list[dict[str, str]]) -> str:
    grouped: dict[str, list[dict[str, str]]] = {}
    for row in rows:
        key = row.get("recipient_key") or row.get("recipient_id") or row["recipient_label"]
        grouped.setdefault(key, []).append(row)

    sections: list[str] = []
    for gifts in grouped.values():
        recipient = gifts[0]
        demographics = []
        if recipient.get("age"):
            demographics.append(f"Age: {recipient['age']}")
        if recipient.get("gender"):
            demographics.append(f"Gender: {recipient['gender']}")
        heading = recipient["recipient_label"]
        if demographics:
            heading += f" ({'; '.join(demographics)})"
        lines = [heading]
        for gift in gifts:
            details = gift["description"]
            if gift.get("size"):
                details += f"; Size: {gift['size']}"
            status = gift["status"].replace("_", " ").title()
            lines.append(f"  • {details} ({status}, Qty {gift['quantity']})")
        sections.append("\n".join(lines))
    return "\n\n".join(sections)
