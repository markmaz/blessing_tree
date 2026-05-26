from __future__ import annotations

from html import escape

from app.config import DEFAULT_MAIL_SENDER, ORGANIZATION_NAME

LOGO_URL = "https://docker.blessing-tree.com/blessing-tree-logo.png"
SUPPORT_EMAIL = DEFAULT_MAIL_SENDER or "support@blessing-tree.com"
COLOR_PURPLE = "#2d1544"
COLOR_PURPLE_DARK = "#231034"
COLOR_GOLD = "#d4af37"
COLOR_WARM_BACKGROUND = "#f6f3ec"
COLOR_CARD = "#fffdf8"
COLOR_CARD_BORDER = "#e6e0d6"
COLOR_TEXT_DARK = "#2f2a25"
COLOR_TEXT_MUTED = "#6f665d"


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
  <body style="background-color:{COLOR_WARM_BACKGROUND};margin:0;padding:30px;font-family:Arial,sans-serif;color:{COLOR_TEXT_DARK};">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">{safe_preheader}</div>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="width:100%;max-width:600px;background-color:{COLOR_CARD};border-radius:12px;border:1px solid {COLOR_CARD_BORDER};overflow:hidden;box-shadow:0 18px 40px rgba(45,21,68,0.12);">
            <tr>
              <td style="height:6px;background-color:{COLOR_GOLD};font-size:0;line-height:0;">&nbsp;</td>
            </tr>
            <tr>
              <td align="center" style="padding:28px 24px 10px;background-color:#ffffff;">
                <img src="{LOGO_URL}" alt="{safe_org_name} Logo" width="180" style="max-width:180px;height:auto;display:block;" />
              </td>
            </tr>
            <tr>
              <td style="padding:22px 32px 32px;font-size:15px;line-height:1.6;color:{COLOR_TEXT_DARK};">
                {body_html}
                <p style="margin-top:30px;color:{COLOR_TEXT_MUTED};">Blessings,<br /><strong style="color:{COLOR_TEXT_DARK};">The {safe_org_name} Team</strong></p>
              </td>
            </tr>
          </table>
          <p style="max-width:600px;margin:16px auto 0;font-size:12px;line-height:1.5;color:{COLOR_TEXT_MUTED};text-align:center;">
            This message was sent by {safe_org_name}. If you need help, contact
            <a href="mailto:{escape(SUPPORT_EMAIL, quote=True)}" style="color:{COLOR_PURPLE};text-decoration:none;">{escape(SUPPORT_EMAIL)}</a>.
          </p>
        </td>
      </tr>
    </table>
  </body>
</html>"""


def email_heading(text: str) -> str:
    return (
        f'<h2 style="color:{COLOR_PURPLE};margin:0 0 12px;'
        f'font-family:Georgia,serif;font-size:24px;line-height:1.25;">{escape(text)}</h2>'
    )


def email_paragraph(text: str) -> str:
    return f'<p style="margin:0 0 16px;color:{COLOR_TEXT_MUTED};">{_line_breaks(escape(text))}</p>'


def email_button(*, href: str, label: str) -> str:
    return (
        '<p style="text-align:center;margin:36px 0;">'
        f'<a href="{escape(href, quote=True)}" '
        f'style="display:inline-block;background-color:{COLOR_PURPLE};border:1px solid {COLOR_PURPLE_DARK};'
        'color:#ffffff;text-decoration:none;padding:14px 28px;border-radius:10px;'
        'font-weight:bold;font-size:15px;">'
        f"{escape(label)}</a></p>"
    )


def email_link(*, href: str, label: str) -> str:
    return f'<a href="{escape(href, quote=True)}" style="color:{COLOR_PURPLE};text-decoration:none;">{escape(label)}</a>'


def _line_breaks(text: str) -> str:
    return text.replace("\n", "<br />")
