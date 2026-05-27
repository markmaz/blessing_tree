from __future__ import annotations

import uuid
from collections.abc import Mapping

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.campaigns.service import CampaignService, _optional_text
from app.features.campaigns.studio_validation import parse_bool, require_short_text, validate_template_key
from app.models.campaign_flyer import CampaignFlyer

FLYER_TYPES = {"SPONSOR_RECRUITMENT", "CUSTOM"}
QR_TARGET_TYPES = {"PUBLIC_SPONSOR_SIGNUP", "CUSTOM_URL", "NONE"}
THEME_MODES = {"CAMPAIGN_PURPOSE", "BLESSING_TREE", "CUSTOM", "NONE"}


class CampaignFlyerService:
    def __init__(self, campaign_service: CampaignService | None = None) -> None:
        self.campaigns = campaign_service or CampaignService()

    def list_flyers(self, db: Session, campaign_id: str, *, ensure_default: bool = True) -> list[CampaignFlyer]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        flyers = (
            db.query(CampaignFlyer)
            .filter(CampaignFlyer.campaign_id == campaign.id)
            .order_by(CampaignFlyer.name.asc())
            .all()
        )
        if not flyers and ensure_default:
            flyers = [self._create_default_flyer(db, campaign)]
            db.commit()
            for flyer in flyers:
                db.refresh(flyer)
        return flyers

    def create_flyer(self, db: Session, user_id: str, campaign_id: str, payload: Mapping[str, object]) -> CampaignFlyer:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        flyer_key = validate_template_key(payload.get("flyer_key") or payload.get("name") or "sponsor_recruitment")
        self._require_unique_key(db, campaign_id, flyer_key)
        flyer = CampaignFlyer(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            flyer_key=flyer_key,
            name=require_short_text(payload.get("name"), "name"),
            flyer_type=_validate_choice(payload.get("flyer_type"), "flyer_type", FLYER_TYPES, default="SPONSOR_RECRUITMENT"),
            headline=require_short_text(payload.get("headline"), "headline"),
            subheadline=_optional_text(payload.get("subheadline")),
            body_text=require_short_text(payload.get("body_text"), "body_text", max_length=20000),
            call_to_action=require_short_text(payload.get("call_to_action"), "call_to_action"),
            contact_info=_optional_text(payload.get("contact_info")),
            qr_target_type=_validate_choice(payload.get("qr_target_type"), "qr_target_type", QR_TARGET_TYPES, default="PUBLIC_SPONSOR_SIGNUP"),
            qr_custom_url=_validate_optional_url(payload.get("qr_custom_url")),
            theme_mode=_validate_choice(payload.get("theme_mode"), "theme_mode", THEME_MODES, default="CAMPAIGN_PURPOSE"),
            image_prompt=_optional_text(payload.get("image_prompt")),
            layout_json=_validate_layout(payload.get("layout_json")),
            is_active=parse_bool(payload.get("is_active"), "is_active", default=True),
            created_by_user_id=uuid.UUID(str(user_id)),
        )
        db.add(flyer)
        db.commit()
        db.refresh(flyer)
        return flyer

    def update_flyer(self, db: Session, campaign_id: str, flyer_id: str, payload: Mapping[str, object]) -> CampaignFlyer:
        flyer = self._get_flyer(db, campaign_id, flyer_id)
        if "flyer_key" in payload:
            next_key = validate_template_key(payload.get("flyer_key"))
            self._require_unique_key(db, campaign_id, next_key, exclude_flyer_id=str(flyer.id))
            flyer.flyer_key = next_key
        if "name" in payload:
            flyer.name = require_short_text(payload.get("name"), "name")
        if "flyer_type" in payload:
            flyer.flyer_type = _validate_choice(payload.get("flyer_type"), "flyer_type", FLYER_TYPES)
        if "headline" in payload:
            flyer.headline = require_short_text(payload.get("headline"), "headline")
        if "subheadline" in payload:
            flyer.subheadline = _optional_text(payload.get("subheadline"))
        if "body_text" in payload:
            flyer.body_text = require_short_text(payload.get("body_text"), "body_text", max_length=20000)
        if "call_to_action" in payload:
            flyer.call_to_action = require_short_text(payload.get("call_to_action"), "call_to_action")
        if "contact_info" in payload:
            flyer.contact_info = _optional_text(payload.get("contact_info"))
        if "qr_target_type" in payload:
            flyer.qr_target_type = _validate_choice(payload.get("qr_target_type"), "qr_target_type", QR_TARGET_TYPES)
        if "qr_custom_url" in payload:
            flyer.qr_custom_url = _validate_optional_url(payload.get("qr_custom_url"))
        if "theme_mode" in payload:
            flyer.theme_mode = _validate_choice(payload.get("theme_mode"), "theme_mode", THEME_MODES)
        if "image_prompt" in payload:
            flyer.image_prompt = _optional_text(payload.get("image_prompt"))
        if "layout_json" in payload:
            flyer.layout_json = _validate_layout(payload.get("layout_json"))
        if "is_active" in payload:
            flyer.is_active = parse_bool(payload.get("is_active"), "is_active")
        db.commit()
        db.refresh(flyer)
        return flyer

    def delete_flyer(self, db: Session, campaign_id: str, flyer_id: str) -> None:
        flyer = self._get_flyer(db, campaign_id, flyer_id)
        db.delete(flyer)
        db.commit()

    def _get_flyer(self, db: Session, campaign_id: str, flyer_id: str) -> CampaignFlyer:
        try:
            flyer_uuid = uuid.UUID(str(flyer_id))
        except (TypeError, ValueError, AttributeError):
            raise ServiceError("Valid flyer_id is required", status_code=400, details={"field": "flyer_id"})
        flyer = (
            db.query(CampaignFlyer)
            .filter(CampaignFlyer.campaign_id == campaign_id, CampaignFlyer.id == flyer_uuid)
            .one_or_none()
        )
        if flyer is None:
            raise ServiceError("Flyer not found", status_code=404, details={"flyer_id": flyer_id})
        return flyer

    def _require_unique_key(
        self,
        db: Session,
        campaign_id: str,
        flyer_key: str,
        *,
        exclude_flyer_id: str | None = None,
    ) -> None:
        query = db.query(CampaignFlyer.id).filter(CampaignFlyer.campaign_id == campaign_id, CampaignFlyer.flyer_key == flyer_key)
        if exclude_flyer_id:
            query = query.filter(CampaignFlyer.id != uuid.UUID(exclude_flyer_id))
        if query.first() is not None:
            raise ServiceError("Flyer key already exists", status_code=409, details={"flyer_key": flyer_key})

    @staticmethod
    def _create_default_flyer(db: Session, campaign) -> CampaignFlyer:
        body = (
            "Help make this campaign possible by sponsoring gifts from a recipient wishlist.\n\n"
            "Choose gifts online, verify your email, and bring the gifts back by the campaign deadline."
        )
        flyer = CampaignFlyer(
            id=uuid.uuid4(),
            campaign_id=campaign.id,
            flyer_key="sponsor_recruitment",
            name="Sponsor Recruitment Flyer",
            flyer_type="SPONSOR_RECRUITMENT",
            headline=f"Sponsor a Gift for {campaign.name}",
            subheadline=campaign.season_theme or "Blessing Tree Sponsor Invitation",
            body_text=body,
            call_to_action="Scan to choose gifts",
            contact_info=None,
            qr_target_type="PUBLIC_SPONSOR_SIGNUP",
            theme_mode="CAMPAIGN_PURPOSE",
            image_prompt=campaign.season_theme,
            layout_json={"size": "letter", "accent": "gold"},
            is_active=True,
        )
        db.add(flyer)
        db.flush()
        return flyer


def _validate_choice(value: object, field_name: str, allowed: set[str], *, default: str | None = None) -> str:
    normalized = str(value or default or "").strip().upper()
    if normalized not in allowed:
        raise ServiceError(f"{field_name} is invalid", status_code=400, details={"field": field_name, "allowed_values": sorted(allowed)})
    return normalized


def _validate_optional_url(value: object) -> str | None:
    text = _optional_text(value)
    if text is None:
        return None
    if len(text) > 1024 or not (text.startswith("http://") or text.startswith("https://")):
        raise ServiceError("qr_custom_url must be a valid URL", status_code=400, details={"field": "qr_custom_url"})
    return text


def _validate_layout(value: object) -> dict[str, object] | None:
    if value in (None, ""):
        return None
    if not isinstance(value, Mapping):
        raise ServiceError("layout_json must be an object", status_code=400, details={"field": "layout_json"})
    return dict(value)
