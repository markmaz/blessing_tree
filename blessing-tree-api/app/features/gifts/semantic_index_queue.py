from __future__ import annotations

import logging
import uuid

logger = logging.getLogger(__name__)


def enqueue_wishlist_item_reindex(wishlist_item_id: uuid.UUID) -> None:
    _enqueue("wishlist_item", str(wishlist_item_id))


def enqueue_recipient_gift_reindex(recipient_id: uuid.UUID) -> None:
    _enqueue("recipient", str(recipient_id))


def enqueue_wishlist_item_delete(wishlist_item_id: uuid.UUID) -> None:
    _enqueue("delete_wishlist_item", str(wishlist_item_id))


def _enqueue(target_type: str, target_id: str) -> None:
    try:
        from app.tasks.gift_tasks import reindex_gift_search_task

        reindex_gift_search_task.delay(target_type=target_type, target_id=target_id)
    except Exception as exc:
        logger.warning("Unable to enqueue gift semantic index task for %s %s: %s", target_type, target_id, exc)
