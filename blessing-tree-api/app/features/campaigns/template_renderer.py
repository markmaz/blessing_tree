from __future__ import annotations

from html import escape
import json
import re
from typing import Any

from app.config import ORGANIZATION_NAME

_TEMPLATE_BLOCKS_PREFIX = "__bt_template_blocks_v1__::"
_MERGE_FIELD_PATTERN = re.compile(r"{{\s*([A-Za-z0-9_.-]+)\s*}}")


class CampaignTemplateRenderer:
    def render(
        self,
        *,
        campaign_name: str,
        campaign_year: int,
        subject_template: str,
        body_template: str,
        merge_fields: dict[str, str],
    ) -> tuple[str, str, str]:
        context = {
            "campaign.name": campaign_name,
            "campaign.year": str(campaign_year),
            "organization.name": ORGANIZATION_NAME,
            **merge_fields,
        }
        subject = _render_text(subject_template, context)
        html_body, text_body = _render_body(body_template, context)
        return subject, html_body, text_body


def _render_body(body_template: str, context: dict[str, str]) -> tuple[str, str]:
    blocks = _parse_template_blocks(body_template)
    if not blocks:
        rendered_text = _render_text(body_template, context)
        html = _wrap_email_html(f"<p>{_paragraph_html(rendered_text)}</p>")
        return html, rendered_text

    html_parts: list[str] = []
    text_parts: list[str] = []
    for block in blocks:
        block_type = str(block.get("type") or "")
        if block_type == "heading":
            content = _render_text(str(block.get("content") or ""), context)
            if not content:
                continue
            html_parts.append(f"<h2>{escape(content)}</h2>")
            text_parts.append(content)
            continue
        if block_type == "image":
            src = _render_text(str(block.get("src") or ""), context)
            alt_text = _render_text(str(block.get("altText") or ""), context)
            caption = _render_text(str(block.get("caption") or ""), context)
            if src:
                html_parts.append(
                    "".join(
                        [
                            '<figure style="margin:0 0 16px 0;">',
                            f'<img src="{escape(src, quote=True)}" alt="{escape(alt_text, quote=True)}" style="max-width:100%;border-radius:12px;" />',
                            f"<figcaption>{escape(caption)}</figcaption>" if caption else "",
                            "</figure>",
                        ]
                    )
                )
            if caption:
                text_parts.append(caption)
            continue

        content = _render_text(str(block.get("content") or ""), context)
        if not content:
            continue
        html_parts.append(f"<p>{_paragraph_html(content)}</p>")
        text_parts.append(content)

    html = _wrap_email_html("".join(html_parts))
    text = "\n\n".join(part for part in text_parts if part)
    return html, text


def _parse_template_blocks(body_template: str) -> list[dict[str, Any]]:
    trimmed = body_template.strip()
    if not trimmed.startswith(_TEMPLATE_BLOCKS_PREFIX):
        return []

    try:
        payload = json.loads(trimmed[len(_TEMPLATE_BLOCKS_PREFIX) :])
    except json.JSONDecodeError:
        return []

    if not isinstance(payload, dict) or payload.get("version") != 1:
        return []
    raw_blocks = payload.get("blocks")
    if not isinstance(raw_blocks, list):
        return []
    return [block for block in raw_blocks if isinstance(block, dict)]


def _render_text(template: str, context: dict[str, str]) -> str:
    def replace(match: re.Match[str]) -> str:
        field = match.group(1)
        return context.get(field, match.group(0))

    return _MERGE_FIELD_PATTERN.sub(replace, template).strip()


def _paragraph_html(text: str) -> str:
    escaped = escape(text)
    return escaped.replace("\n", "<br />")


def _wrap_email_html(inner_html: str) -> str:
    return (
        '<div style="font-family:Georgia, serif; color:#2b241e; line-height:1.6;'
        ' max-width:640px; margin:0 auto; padding:16px;">'
        f"{inner_html}</div>"
    )
