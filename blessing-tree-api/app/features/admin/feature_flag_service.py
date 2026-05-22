from __future__ import annotations

from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.admin.constants import FEATURE_FLAG_CATALOG
from app.features.admin.validation import validate_feature_key
from app.models.app_feature_flag import AppFeatureFlag


class FeatureFlagService:
    def ensure_defaults(self, db: Session) -> list[AppFeatureFlag]:
        existing = {
            flag.feature_key: flag for flag in db.query(AppFeatureFlag).order_by(AppFeatureFlag.feature_key.asc()).all()
        }
        changed = False
        for item in FEATURE_FLAG_CATALOG:
            feature_key = str(item["feature_key"])
            if feature_key in existing:
                existing_flag = existing[feature_key]
                next_label = str(item["label"])
                next_description = str(item["description"])
                if (
                    existing_flag.label != next_label
                    or existing_flag.description != next_description
                ):
                    existing_flag.label = next_label
                    existing_flag.description = next_description
                    changed = True
                continue
            db.add(
                AppFeatureFlag(
                    feature_key=feature_key,
                    label=str(item["label"]),
                    description=str(item["description"]),
                    is_enabled=bool(item["default_enabled"]),
                )
            )
            changed = True
        if changed:
            db.commit()
        return db.query(AppFeatureFlag).order_by(AppFeatureFlag.label.asc()).all()

    def list_flags(self, db: Session) -> list[AppFeatureFlag]:
        return self.ensure_defaults(db)

    def update_flag(self, db: Session, feature_key: str, *, is_enabled: bool) -> AppFeatureFlag:
        key = validate_feature_key(feature_key)
        self.ensure_defaults(db)
        flag = db.query(AppFeatureFlag).filter(AppFeatureFlag.feature_key == key).one_or_none()
        if flag is None:
            raise ServiceError("Feature flag not found", status_code=404, details={"feature_key": key})
        flag.is_enabled = bool(is_enabled)
        db.commit()
        db.refresh(flag)
        return flag
