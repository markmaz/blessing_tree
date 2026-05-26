from __future__ import annotations

from html import escape

from app.config import DEFAULT_MAIL_SENDER, ORGANIZATION_NAME

LOGO_URL = "https://docker.blessing-tree.com/blessing-tree-logo.png"
SUPPORT_EMAIL = DEFAULT_MAIL_SENDER or "support@blessing-tree.com"


def render_branded_email(
    *,
    title: str,
    body_html: str,
    preheader: str | None = None,
) -> str:
    safe_title = escape(title)
    safe_preheader = escape(preheader or title)
    safe_org_name = escape(ORGANIZATION_NAME or "Blessing Tree")
    return f"""<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{safe_title}</title>
  </head>
  <body style="background-color:#0b0f19;margin:0;padding:30px;font-family:Arial,sans-serif;color:#ffffff;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{safe_preheader}</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background-color:#111827;border-radius:12px;border:1px solid #1f2937;overflow:hidden;">
            <tr>
              <td align="center" style="padding:28px 24px 10px;">
                <img src="{LOGO_URL}" alt="{safe_org_name} Logo" width="180" style="max-width:180px;height:auto;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 32px;font-size:15px;line-height:1.6;color:#e5e7eb;">
                {body_html}
                <p style="margin-top:30px;">Blessings,<br /><strong style="color:#ffffff;">The {safe_org_name} Team</strong></p>
              </td>
            </tr>
          </table>
          <p style="max-width:600px;margin:16px auto 0;font-size:12px;line-height:1.5;color:#9ca3af;text-align:center;">
            This message was sent by {safe_org_name}. If you need help, contact
            <a href="mailto:{escape(SUPPORT_EMAIL, quote=True)}" style="color:#f97316;text-decoration:none;">{escape(SUPPORT_EMAIL)}</a>.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def email_heading(text: str) -> str:
    return f'<h2 style="color:#f97316;margin:0 0 12px;font-size:24px;line-height:1.25;">{escape(text)}</h2>'


def email_paragraph(text: str) -> str:
    return f'<p style="margin:0 0 16px;">{_line_breaks(escape(text))}</p>'


def email_button(*, href: str, label: str) -> str:
    return (
        '<p style="text-align:center;margin:36px 0;">'
        f'<a href="{escape(href, quote=True)}" '
        'style="display:inline-block;background-color:#f97316;border:1px solid #ea580c;'
        'color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;'
        'font-weight:bold;font-size:15px;">'
        f"{escape(label)}</a></p>"
    )


def email_link(*, href: str, label: str) -> str:
    return f'<a href="{escape(href, quote=True)}" style="color:#f97316;text-decoration:none;">{escape(label)}</a>'


def _line_breaks(text: str) -> str:
    return text.replace("\n", "<br />")
