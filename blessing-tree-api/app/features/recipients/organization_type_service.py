from __future__ import annotations

import re
import uuid

from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.exceptions.service_error import ServiceError
from app.features.recipients.validation import require_short_text
from app.models.organization_type import OrganizationType
from app.models.recipient_constants import RECIPIENT_KIND_ADULT
from app.models.recipient_group import RecipientGroup

_CODE_PATTERN = re.compile(r"[^A-Z0-9]+")
ORGANIZATION_RECIPIENT_CATEGORIES = {"CHILD", "ADULT", "FAMILY"}

DEFAULT_ORGANIZATION_TYPES = [
    ("NURSING_HOME", "Nursing Home", "ADULT", 10),
    ("MH_CLIENTS", "MH Clients", "ADULT", 20),
    ("FOSTER_CARE", "Foster Care", "FAMILY", 30),
    ("FAMILY_SERVICES", "Family Services", "FAMILY", 40),
    ("CHILDRENS_HOME", "Children's Home", "CHILD", 50),
    ("OTHER", "Other", "ADULT", 100),
]


class OrganizationTypeService:
    def list_types(self, db: Session, *, include_inactive: bool = False) -> list[OrganizationType]:
        self.ensure_seeded(db)
        query = db.query(OrganizationType)
        if not include_inactive:
            query = query.filter(OrganizationType.is_active.is_(True))
        return query.order_by(OrganizationType.sort_order.asc(), OrganizationType.label.asc()).all()

    def get_type(self, db: Session, code: object, *, active_required: bool = False) -> OrganizationType:
        normalized_code = validate_organization_type_code(code)
        self.ensure_seeded(db)
        organization_type = (
            db.query(OrganizationType)
            .filter(OrganizationType.code == normalized_code)
            .one_or_none()
        )
        if organization_type is None:
            raise ServiceError("Organization type not found", status_code=404, details={"code": normalized_code})
        if active_required and not organization_type.is_active:
            raise ServiceError("Organization type is inactive", status_code=400, details={"code": normalized_code})
        return organization_type

    def create_type(self, db: Session, payload: dict[str, object]) -> OrganizationType:
        label = require_short_text(payload.get("label"), "label", max_length=120)
        code = validate_organization_type_code(payload.get("code") or _build_code(label))
        organization_type = OrganizationType(
            id=uuid.uuid4(),
            code=code,
            label=label,
            recipient_category=validate_organization_recipient_category(
                payload.get("recipient_category") or RECIPIENT_KIND_ADULT
            ),
            is_active=bool(payload.get("is_active", True)),
            sort_order=validate_sort_order(payload.get("sort_order")),
        )
        db.add(organization_type)
        self._commit_with_duplicate_handling(db)
        return self.get_type(db, code)

    def update_type(self, db: Session, code: str, payload: dict[str, object]) -> OrganizationType:
        organization_type = self.get_type(db, code)
        if "label" in payload:
            organization_type.label = require_short_text(payload.get("label"), "label", max_length=120)
        if "recipient_category" in payload:
            organization_type.recipient_category = validate_organization_recipient_category(payload.get("recipient_category"))
        if "is_active" in payload:
            organization_type.is_active = bool(payload.get("is_active"))
        if "sort_order" in payload:
            organization_type.sort_order = validate_sort_order(payload.get("sort_order"))
        db.commit()
        return self.get_type(db, organization_type.code)

    def delete_type(self, db: Session, code: str) -> None:
        organization_type = self.get_type(db, code)
        usage_count = (
            db.query(func.count(RecipientGroup.id))
            .filter(RecipientGroup.organization_type == organization_type.code)
            .scalar()
            or 0
        )
        if usage_count:
            organization_type.is_active = False
            db.commit()
            return
        db.delete(organization_type)
        db.commit()

    def validate_group_organization_type(self, db: Session, value: object, *, required: bool = False) -> str | None:
        if value in (None, ""):
            if required:
                raise ServiceError(
                    "organization_type is required",
                    status_code=400,
                    details={"field": "organization_type"},
                )
            return None
        organization_type = self.get_type(db, value, active_required=True)
        return organization_type.code

    def get_recipient_category(self, db: Session, code: str | None) -> str:
        if not code:
            return RECIPIENT_KIND_ADULT
        try:
            return self.get_type(db, code).recipient_category
        except ServiceError:
            return "CHILD" if code in {"ORPHANAGE", "CHILDRENS_HOME"} else RECIPIENT_KIND_ADULT

    def ensure_seeded(self, db: Session) -> None:
        existing_count = db.query(func.count(OrganizationType.id)).scalar() or 0
        if existing_count:
            return
        for code, label, recipient_category, sort_order in DEFAULT_ORGANIZATION_TYPES:
            db.add(
                OrganizationType(
                    id=uuid.uuid4(),
                    code=code,
                    label=label,
                    recipient_category=recipient_category,
                    is_active=True,
                    sort_order=sort_order,
                )
            )
        db.commit()

    @staticmethod
    def _commit_with_duplicate_handling(db: Session) -> None:
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise ServiceError(
                "Organization type code already exists",
                status_code=409,
                details={"field": "code"},
            ) from exc


def validate_organization_type_code(value: object) -> str:
    normalized = str(value or "").strip().upper()
    if not normalized:
        raise ServiceError("code is required", status_code=400, details={"field": "code"})
    normalized = _CODE_PATTERN.sub("_", normalized).strip("_")
    if not normalized or len(normalized) > 64:
        raise ServiceError("code must be 64 characters or fewer", status_code=400, details={"field": "code"})
    return normalized


def validate_organization_recipient_category(value: object) -> str:
    normalized = str(value or "").strip().upper()
    if normalized not in ORGANIZATION_RECIPIENT_CATEGORIES:
        raise ServiceError(
            "recipient_category must be CHILD, ADULT, or FAMILY",
            status_code=400,
            details={"field": "recipient_category"},
        )
    return normalized


def validate_sort_order(value: object) -> int:
    if value in (None, ""):
        return 100
    try:
        return int(value)
    except (TypeError, ValueError) as exc:
        raise ServiceError("sort_order must be a number", status_code=400, details={"field": "sort_order"}) from exc


def _build_code(label: str) -> str:
    return validate_organization_type_code(label)
