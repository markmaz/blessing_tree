from __future__ import annotations

import uuid
from collections.abc import Mapping
from decimal import Decimal, InvalidOperation

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService, _optional_text
from app.features.campaigns.studio_validation import parse_bool, require_short_text, validate_template_key
from app.models.campaign import Campaign
from app.models.campaign_gift_tag_template import CampaignGiftTagTemplate

ALLOWED_TAG_SIZES = {(Decimal("3.00"), Decimal("2.00")), (Decimal("2.00"), Decimal("2.00"))}
MIN_QR_SIZE_BY_TAG_SIZE = {
    (Decimal("3.00"), Decimal("2.00")): Decimal("0.90"),
    (Decimal("2.00"), Decimal("2.00")): Decimal("0.75"),
}
DEFAULT_TEMPLATE_KEY = "default_gift_tag"


class CampaignGiftTagTemplateService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def get_template(self, db: Session, campaign_id: str, *, ensure_default: bool = True) -> CampaignGiftTagTemplate:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        template = (
            db.query(CampaignGiftTagTemplate)
            .filter(CampaignGiftTagTemplate.campaign_id == campaign.id, CampaignGiftTagTemplate.is_active == 1)
            .order_by(CampaignGiftTagTemplate.created_at.asc())
            .first()
        )
        if template is None and ensure_default:
            template = self._create_default_template(db, campaign)
            db.commit()
            db.refresh(template)
        if template is None:
            raise ServiceError("Gift tag template not found", status_code=404)
        return template

    def update_template(
        self,
        db: Session,
        campaign_id: str,
        user_id: str | None,
        payload: Mapping[str, object],
    ) -> CampaignGiftTagTemplate:
        template = self.get_template(db, campaign_id, ensure_default=True)
        if "template_key" in payload:
            template.template_key = validate_template_key(payload.get("template_key"))
        if "name" in payload:
            template.name = require_short_text(payload.get("name"), "name")
        if "tag_width_in" in payload or "tag_height_in" in payload:
            width = _parse_decimal(payload.get("tag_width_in", template.tag_width_in), "tag_width_in")
            height = _parse_decimal(payload.get("tag_height_in", template.tag_height_in), "tag_height_in")
            _validate_tag_size(width, height)
            template.tag_width_in = width
            template.tag_height_in = height
            template.orientation = "LANDSCAPE" if width >= height else "PORTRAIT"
        if "orientation" in payload:
            orientation = str(payload.get("orientation") or "").strip().upper()
            if orientation not in {"PORTRAIT", "LANDSCAPE"}:
                raise ServiceError("orientation is invalid", status_code=400, details={"field": "orientation"})
            template.orientation = orientation
        if "layout_json" in payload:
            layout = _validate_layout(payload.get("layout_json"), template.tag_width_in, template.tag_height_in)
            template.layout_json = layout
        if "gift_tag_message" in payload:
            template.gift_tag_message = _optional_text(payload.get("gift_tag_message"))
        if "include_cut_lines_default" in payload:
            template.include_cut_lines_default = parse_bool(payload.get("include_cut_lines_default"), "include_cut_lines_default")
        if "is_active" in payload:
            template.is_active = parse_bool(payload.get("is_active"), "is_active")
        if user_id and template.created_by_user_id is None:
            template.created_by_user_id = uuid.UUID(str(user_id))
        _validate_layout(template.layout_json, template.tag_width_in, template.tag_height_in)
        db.commit()
        db.refresh(template)
        return template

    @staticmethod
    def _create_default_template(db: Session, campaign: Campaign) -> CampaignGiftTagTemplate:
        template = CampaignGiftTagTemplate(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            template_key=DEFAULT_TEMPLATE_KEY,
            name="Default Gift Tag",
            tag_width_in=Decimal("3.00"),
            tag_height_in=Decimal("2.00"),
            orientation="LANDSCAPE",
            layout_json=build_default_gift_tag_layout(campaign),
            gift_tag_message=None,
            include_cut_lines_default=True,
            is_active=True,
        )
        db.add(template)
        db.flush()
        return template


def build_default_gift_tag_layout(campaign: Campaign | None = None) -> dict[str, object]:
    campaign_purpose = (campaign.season_theme if campaign is not None else None) or "{{campaign_purpose}}"
    return {
        "editor": "konva",
        "design": {
            "editor": "konva",
            "version": 1,
            "unit": "in",
            "width": 3,
            "height": 2,
            "elements": [
                {
                    "id": "logo",
                    "type": "image",
                    "src": "/blessing-tree-logo.png",
                    "x": 0.12,
                    "y": 0.12,
                    "width": 0.46,
                    "height": 0.46,
                    "altText": "Blessing Tree logo",
                },
                {
                    "id": "recipient-name",
                    "type": "text",
                    "text": "{{recipient_display_name}}",
                    "x": 0.66,
                    "y": 0.16,
                    "width": 1.28,
                    "height": 0.28,
                    "fontSize": 16,
                    "fontFamily": "Arial",
                    "fontWeight": "bold",
                    "fill": "#2d1544",
                },
                {
                    "id": "family-group",
                    "type": "text",
                    "text": "{{family_or_group_name}}",
                    "x": 0.12,
                    "y": 0.72,
                    "width": 1.78,
                    "height": 0.24,
                    "fontSize": 10,
                    "fontFamily": "Arial",
                    "fill": "#34271e",
                },
                {
                    "id": "age-gender",
                    "type": "text",
                    "text": "{{age_display}} {{gender}}",
                    "x": 0.12,
                    "y": 1.02,
                    "width": 1.78,
                    "height": 0.22,
                    "fontSize": 10,
                    "fontFamily": "Arial",
                    "fill": "#6f5c45",
                },
                {
                    "id": "campaign-purpose",
                    "type": "text",
                    "text": campaign_purpose,
                    "x": 0.12,
                    "y": 1.48,
                    "width": 1.58,
                    "height": 0.22,
                    "fontSize": 8,
                    "fontFamily": "Arial",
                    "fill": "#6f5c45",
                },
                {
                    "id": "qr",
                    "type": "qr",
                    "x": 2.02,
                    "y": 0.78,
                    "width": 0.9,
                    "height": 0.9,
                    "locked": False,
                    "required": True,
                },
                {
                    "id": "qr-caption",
                    "type": "text",
                    "text": "Scan for workflow",
                    "x": 1.96,
                    "y": 1.7,
                    "width": 1.0,
                    "height": 0.14,
                    "fontSize": 6,
                    "fontFamily": "Arial",
                    "align": "center",
                    "fill": "#6f5c45",
                },
            ],
        },
    }


def _parse_decimal(value: object, field_name: str) -> Decimal:
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        raise ServiceError(f"{field_name} must be numeric", status_code=400, details={"field": field_name})


def _validate_tag_size(width: Decimal, height: Decimal) -> None:
    if (width, height) not in ALLOWED_TAG_SIZES:
        raise ServiceError(
            "Tag size is invalid",
            status_code=400,
            details={"allowed_sizes": [{"width": str(width), "height": str(height)} for width, height in sorted(ALLOWED_TAG_SIZES)]},
        )


def _validate_layout(value: object, tag_width: Decimal, tag_height: Decimal) -> dict[str, object]:
    if not isinstance(value, Mapping):
        raise ServiceError("layout_json must be an object", status_code=400, details={"field": "layout_json"})
    design = value.get("design")
    if not isinstance(design, Mapping):
        raise ServiceError("layout_json.design must be an object", status_code=400, details={"field": "layout_json"})
    elements = design.get("elements")
    if not isinstance(elements, list):
        raise ServiceError("layout_json.design.elements must be a list", status_code=400, details={"field": "layout_json"})
    qr_elements = [element for element in elements if isinstance(element, Mapping) and element.get("type") == "qr"]
    if not qr_elements:
        raise ServiceError("Gift tag template must include a QR element", status_code=400, details={"field": "layout_json"})
    min_qr_size = MIN_QR_SIZE_BY_TAG_SIZE.get((tag_width, tag_height), Decimal("0.75"))
    for qr_element in qr_elements:
        width = _parse_decimal(qr_element.get("width"), "qr.width")
        height = _parse_decimal(qr_element.get("height"), "qr.height")
        if width < min_qr_size or height < min_qr_size:
            raise ServiceError(
                "QR element is too small",
                status_code=400,
                details={"minimum_size_in": str(min_qr_size), "field": "layout_json"},
            )
    return dict(value)
