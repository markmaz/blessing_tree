from __future__ import annotations

import asyncio
import email
from datetime import UTC, datetime
from email.message import Message
from pathlib import Path

from aiosmtpd.controller import Controller


OUTPUT_DIR = Path(__file__).resolve().parents[1] / "tmp" / "dev-mail"


class MailSinkHandler:
    async def handle_DATA(self, server, session, envelope) -> str:
        OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
        timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%S%fZ")
        recipient_slug = _slugify(envelope.rcpt_tos[0] if envelope.rcpt_tos else "message")
        path = OUTPUT_DIR / f"{timestamp}-{recipient_slug}.eml"
        path.write_bytes(envelope.original_content)

        message = email.message_from_bytes(envelope.original_content)
        subject = _subject_of(message)
        print(f"[dev-smtp] wrote {path.name} -> to={','.join(envelope.rcpt_tos)} subject={subject}")
        return "250 Message accepted for delivery"


def _slugify(value: str) -> str:
    slug = "".join(character.lower() if character.isalnum() else "-" for character in value)
    slug = "-".join(part for part in slug.split("-") if part)
    return slug or "message"


def _subject_of(message: Message) -> str:
    subject = message.get("Subject")
    return str(subject).strip() if subject else "(no subject)"


async def _main() -> None:
    controller = Controller(MailSinkHandler(), hostname="127.0.0.1", port=1025)
    controller.start()
    print(f"[dev-smtp] listening on 127.0.0.1:1025 and writing mail to {OUTPUT_DIR}")
    try:
        while True:
            await asyncio.sleep(3600)
    finally:
        controller.stop()


if __name__ == "__main__":
    asyncio.run(_main())
