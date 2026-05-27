from __future__ import annotations

from app.celery import BT_TASK_NAMESPACE, celery


@celery.task(name=f"{BT_TASK_NAMESPACE}.admin.send_invite_email")
def send_admin_invite_email_task(email: str, display_name: str, invite_url: str) -> None:
    from app.factory import create_app

    app = create_app()
    with app.app_context():
        from app.email.mailer import send_admin_invite_email

        send_admin_invite_email(email=email, display_name=display_name, invite_url=invite_url)


@celery.task(name=f"{BT_TASK_NAMESPACE}.auth.send_password_reset_email")
def send_password_reset_email_task(email: str, display_name: str, reset_url: str) -> None:
    from app.factory import create_app

    app = create_app()
    with app.app_context():
        from app.email.mailer import send_password_reset_email

        send_password_reset_email(email=email, display_name=display_name, reset_url=reset_url)
