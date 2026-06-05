from __future__ import annotations

import uuid

from app.celery import BT_TASK_NAMESPACE, celery
from app.db import SessionLocal
from app.factory import create_app
from app.features.gifts.semantic_search_service import GiftSemanticSearchService


@celery.task(name=f"{BT_TASK_NAMESPACE}.gifts.reindex_search")
def reindex_gift_search_task(target_type: str, target_id: str) -> dict[str, object]:
    app = create_app()
    with app.app_context():
        service = GiftSemanticSearchService()
        target_uuid = uuid.UUID(str(target_id))
        with SessionLocal() as db:
            if target_type == "wishlist_item":
                return service.rebuild_wishlist_item_index(db, wishlist_item_id=target_uuid)
            if target_type == "recipient":
                return service.rebuild_recipient_index(db, recipient_id=target_uuid)
            if target_type == "delete_wishlist_item":
                return service.delete_wishlist_item_index(wishlist_item_id=target_uuid)
        return {
            "status": "ignored",
            "target_type": target_type,
            "target_id": str(target_id),
            "message": "Unsupported gift semantic index target.",
        }
