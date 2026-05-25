from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


class _PublicSponsorVerificationEmailTaskProxy:
    def delay(
        self,
        email: str,
        display_name: str,
        campaign_name: str,
        public_slug: str,
        verification_token: str,
    ):
        from app.tasks.campaign_tasks import send_public_sponsor_verification_email_task

        return send_public_sponsor_verification_email_task.delay(
            email,
            display_name,
            campaign_name,
            public_slug,
            verification_token,
        )


send_public_sponsor_verification_email_task = _PublicSponsorVerificationEmailTaskProxy()


def send_public_sponsor_verification_email_with_fallback(
    *,
    email: str,
    display_name: str,
    campaign_name: str,
    public_slug: str,
    verification_token: str,
) -> bool:
    try:
        send_public_sponsor_verification_email_task.delay(
            email,
            display_name,
            campaign_name,
            public_slug,
            verification_token,
        )
        return True
    except Exception:
        logger.exception("Unable to enqueue public sponsor verification email; trying synchronous send")

    try:
        from app.email.mailer import send_public_sponsor_verification_email

        send_public_sponsor_verification_email(
            email=email,
            display_name=display_name,
            campaign_name=campaign_name,
            public_slug=public_slug,
            verification_token=verification_token,
        )
        return True
    except Exception:
        logger.exception("Unable to send public sponsor verification email synchronously")
        return False
