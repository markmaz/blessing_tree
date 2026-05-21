from __future__ import annotations

import importlib


def test_mail_config_can_disable_tls(monkeypatch) -> None:
    monkeypatch.setenv("SMTP_SERVER", "127.0.0.1")
    monkeypatch.setenv("SMTP_PORT", "1025")
    monkeypatch.setenv("SMTP_USE_TLS", "false")
    monkeypatch.setenv("SMTP_USE_SSL", "false")
    monkeypatch.setenv("DEFAULT_MAIL_SENDER", "no-reply@blessingtree.local")

    import app.config as app_config
    import app.config.mail_config as mail_config_module

    importlib.reload(app_config)
    reloaded_mail_config = importlib.reload(mail_config_module)

    assert reloaded_mail_config.MailConfig.MAIL_SERVER == "127.0.0.1"
    assert reloaded_mail_config.MailConfig.MAIL_PORT == 1025
    assert reloaded_mail_config.MailConfig.MAIL_USE_TLS is False
    assert reloaded_mail_config.MailConfig.MAIL_USE_SSL is False
