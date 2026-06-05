from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import requests
from requests import RequestException
from sqlalchemy.orm import Session, joinedload

from app.models.recipient import Recipient
from app.models.recipient_group import RecipientGroup
from app.models.wishlist import Wishlist
from app.models.wishlist_item import WishlistItem

if TYPE_CHECKING:
    from app.features.admin.llm_runtime_service import AdminLlmRuntimeService


@dataclass(frozen=True)
class GiftSemanticSearchConfig:
    enabled: bool
    qdrant_url: str
    qdrant_api_key: str | None
    collection: str
    timeout_s: float
    embedding_model: str
    min_score: float

    @classmethod
    def from_env(cls) -> "GiftSemanticSearchConfig":
        return cls(
            enabled=_env_bool("BT_GIFT_VECTOR_ENABLED", default=True),
            qdrant_url=(os.getenv("QDRANT_URL") or "http://localhost:6333").rstrip("/"),
            qdrant_api_key=(os.getenv("QDRANT_API_KEY") or "").strip() or None,
            collection=(os.getenv("BT_GIFT_VECTOR_COLLECTION") or "bt_gift_search_v1").strip(),
            timeout_s=float(os.getenv("QDRANT_TIMEOUT_S") or "30"),
            embedding_model=(os.getenv("BT_GIFT_EMBEDDING_MODEL") or os.getenv("BT_ASK_EMBEDDING_MODEL") or "text-embedding-3-small").strip(),
            min_score=float(os.getenv("BT_GIFT_VECTOR_MIN_SCORE") or "0.42"),
        )


class GiftSemanticSearchService:
    def __init__(
        self,
        *,
        runtime: AdminLlmRuntimeService | None = None,
        config: GiftSemanticSearchConfig | None = None,
    ) -> None:
        if runtime is None:
            from app.features.admin.llm_runtime_service import AdminLlmRuntimeService

            runtime = AdminLlmRuntimeService()
        self.runtime = runtime
        self.config = config or GiftSemanticSearchConfig.from_env()
        self._indexed_campaigns: set[uuid.UUID] = set()

    def candidate_scores(
        self,
        db: Session,
        *,
        campaign_id: uuid.UUID,
        query: str,
        limit: int,
    ) -> dict[uuid.UUID, float]:
        if not self.config.enabled or not query.strip():
            return {}
        try:
            self._ensure_campaign_index(db, campaign_id=campaign_id)
            embeddings = self.runtime.embed_texts(db, texts=[query], model=self.config.embedding_model)
            if not embeddings:
                return {}
            return self._search_qdrant(campaign_id=campaign_id, embedding=embeddings[0], limit=limit)
        except (RuntimeError, RequestException, ValueError):
            return {}

    def rebuild_all_campaign_indexes(self, db: Session) -> dict[str, object]:
        campaign_ids = [
            row[0]
            for row in db.query(Wishlist.campaign_id)
            .join(WishlistItem, WishlistItem.wishlist_id == Wishlist.id)
            .distinct()
            .all()
        ]
        indexed_items = 0
        indexed_campaigns = 0
        for campaign_id in campaign_ids:
            result = self.rebuild_campaign_index(db, campaign_id=campaign_id)
            indexed_items += int(result["indexed_items"])
            indexed_campaigns += 1
        return {
            "campaigns": indexed_campaigns,
            "indexed_items": indexed_items,
            "collection": self.config.collection,
        }

    def rebuild_campaign_index(self, db: Session, *, campaign_id: uuid.UUID) -> dict[str, object]:
        if not self.config.enabled:
            return {
                "campaign_id": str(campaign_id),
                "indexed_items": 0,
                "collection": self.config.collection,
                "message": "Gift semantic search is disabled.",
            }
        indexed_items = self._index_campaign(db, campaign_id=campaign_id)
        self._indexed_campaigns.add(campaign_id)
        return {
            "campaign_id": str(campaign_id),
            "indexed_items": indexed_items,
            "collection": self.config.collection,
            "message": "Gift semantic search index generated.",
        }

    def rebuild_wishlist_item_index(self, db: Session, *, wishlist_item_id: uuid.UUID) -> dict[str, object]:
        if not self.config.enabled:
            return {
                "wishlist_item_id": str(wishlist_item_id),
                "indexed_items": 0,
                "collection": self.config.collection,
                "message": "Gift semantic search is disabled.",
            }
        item = self._load_item(db, wishlist_item_id=wishlist_item_id)
        if item is None:
            self.delete_wishlist_item_index(wishlist_item_id=wishlist_item_id)
            return {
                "wishlist_item_id": str(wishlist_item_id),
                "indexed_items": 0,
                "collection": self.config.collection,
                "message": "Gift semantic search point deleted.",
            }
        indexed_items = self._index_items(db, [item])
        self._indexed_campaigns.discard(item.wishlist.campaign_id)
        return {
            "wishlist_item_id": str(wishlist_item_id),
            "indexed_items": indexed_items,
            "collection": self.config.collection,
            "message": "Gift semantic search item indexed.",
        }

    def rebuild_recipient_index(self, db: Session, *, recipient_id: uuid.UUID) -> dict[str, object]:
        if not self.config.enabled:
            return {
                "recipient_id": str(recipient_id),
                "indexed_items": 0,
                "collection": self.config.collection,
                "message": "Gift semantic search is disabled.",
            }
        items = (
            self._base_item_query(db)
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(Wishlist.recipient_id == recipient_id)
            .all()
        )
        indexed_items = self._index_items(db, items)
        for item in items:
            self._indexed_campaigns.discard(item.wishlist.campaign_id)
        return {
            "recipient_id": str(recipient_id),
            "indexed_items": indexed_items,
            "collection": self.config.collection,
            "message": "Gift semantic search recipient gifts indexed.",
        }

    def delete_wishlist_item_index(self, *, wishlist_item_id: uuid.UUID) -> dict[str, object]:
        if not self.config.enabled:
            return {
                "wishlist_item_id": str(wishlist_item_id),
                "deleted_items": 0,
                "collection": self.config.collection,
                "message": "Gift semantic search is disabled.",
            }
        self._delete_points([_point_id_for_wishlist_item(wishlist_item_id)])
        return {
            "wishlist_item_id": str(wishlist_item_id),
            "deleted_items": 1,
            "collection": self.config.collection,
            "message": "Gift semantic search point deleted.",
        }

    def _ensure_campaign_index(self, db: Session, *, campaign_id: uuid.UUID) -> None:
        if campaign_id in self._indexed_campaigns:
            return
        self._index_campaign(db, campaign_id=campaign_id)
        self._indexed_campaigns.add(campaign_id)

    def _index_campaign(self, db: Session, *, campaign_id: uuid.UUID) -> int:
        items = (
            self._base_item_query(db)
            .join(Wishlist, Wishlist.id == WishlistItem.wishlist_id)
            .filter(Wishlist.campaign_id == campaign_id)
            .all()
        )
        return self._index_items(db, items)

    def _index_items(self, db: Session, items: list[WishlistItem]) -> int:
        documents = [_document_for_item(item) for item in items]
        documents = [document for document in documents if document["text"]]
        if not documents:
            return 0

        texts = [str(document["text"]) for document in documents]
        embeddings = self.runtime.embed_texts(db, texts=texts, model=self.config.embedding_model)
        if not embeddings:
            return 0
        self._ensure_collection(vector_size=len(embeddings[0]))
        self._upsert_documents(documents, embeddings)
        return len(documents)

    @staticmethod
    def _base_item_query(db: Session):
        return db.query(WishlistItem).options(
            joinedload(WishlistItem.wishlist).joinedload(Wishlist.recipient).joinedload(Recipient.recipient_group),
        )

    def _load_item(self, db: Session, *, wishlist_item_id: uuid.UUID) -> WishlistItem | None:
        return self._base_item_query(db).filter(WishlistItem.id == wishlist_item_id).one_or_none()

    def _ensure_collection(self, *, vector_size: int) -> None:
        response = requests.get(
            f"{self.config.qdrant_url}/collections/{self.config.collection}",
            headers=self._headers(),
            timeout=self.config.timeout_s,
        )
        if response.status_code == 200:
            return
        if response.status_code != 404:
            response.raise_for_status()
        create_response = requests.put(
            f"{self.config.qdrant_url}/collections/{self.config.collection}",
            headers=self._headers(),
            json={"vectors": {"size": vector_size, "distance": "Cosine"}},
            timeout=self.config.timeout_s,
        )
        create_response.raise_for_status()

    def _upsert_documents(self, documents: list[dict[str, Any]], embeddings: list[list[float]]) -> None:
        points = []
        for document, embedding in zip(documents, embeddings, strict=True):
            points.append(
                {
                    "id": str(_point_id_for_wishlist_item(uuid.UUID(str(document["wishlist_item_id"])))),
                    "vector": embedding,
                    "payload": document["payload"],
                }
            )
        response = requests.put(
            f"{self.config.qdrant_url}/collections/{self.config.collection}/points",
            headers=self._headers(),
            json={"points": points},
            timeout=self.config.timeout_s,
        )
        response.raise_for_status()

    def _delete_points(self, point_ids: list[uuid.UUID]) -> None:
        if not point_ids:
            return
        response = requests.post(
            f"{self.config.qdrant_url}/collections/{self.config.collection}/points/delete",
            headers=self._headers(),
            json={"points": [str(point_id) for point_id in point_ids]},
            timeout=self.config.timeout_s,
        )
        if response.status_code == 404:
            return
        response.raise_for_status()

    def _search_qdrant(
        self,
        *,
        campaign_id: uuid.UUID,
        embedding: list[float],
        limit: int,
    ) -> dict[uuid.UUID, float]:
        response = requests.post(
            f"{self.config.qdrant_url}/collections/{self.config.collection}/points/search",
            headers=self._headers(),
            json={
                "vector": embedding,
                "limit": max(1, min(limit, 250)),
                "with_payload": True,
                "filter": {"must": [{"key": "campaign_id", "match": {"value": str(campaign_id)}}]},
            },
            timeout=self.config.timeout_s,
        )
        response.raise_for_status()
        payload = response.json()
        result = payload.get("result") if isinstance(payload, dict) else None
        if not isinstance(result, list):
            return {}

        scores: dict[uuid.UUID, float] = {}
        for item in result:
            if not isinstance(item, dict):
                continue
            score = float(item.get("score") or 0)
            if score < self.config.min_score:
                continue
            point_payload = item.get("payload")
            if not isinstance(point_payload, dict):
                continue
            wishlist_item_id = point_payload.get("wishlist_item_id")
            if not isinstance(wishlist_item_id, str):
                continue
            try:
                scores[uuid.UUID(wishlist_item_id)] = score
            except ValueError:
                continue
        return scores

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config.qdrant_api_key:
            headers["api-key"] = self.config.qdrant_api_key
        return headers


def _document_for_item(item: WishlistItem) -> dict[str, Any]:
    wishlist = item.wishlist
    recipient = wishlist.recipient if wishlist is not None else None
    group = recipient.recipient_group if recipient is not None else None
    age_text = _age_text(recipient)
    gender_text = _gender_text(recipient.gender if recipient is not None else None)
    text_parts = [
        item.description,
        item.category,
        item.item_type,
        item.size,
        item.priority,
        "substitutions allowed" if item.allow_substitute else "no substitutions",
        age_text,
        gender_text,
        recipient.recipient_kind if recipient is not None else None,
        recipient.program_type if recipient is not None else None,
        group.program_abbreviation if group is not None else None,
    ]
    text = "\n".join(part for part in text_parts if isinstance(part, str) and part.strip())
    return {
        "wishlist_item_id": str(item.id),
        "text": text,
        "payload": {
            "kind": "wishlist_item",
            "campaign_id": str(wishlist.campaign_id) if wishlist is not None else None,
            "wishlist_item_id": str(item.id),
            "recipient_id": str(recipient.id) if recipient is not None else None,
            "gift_status": item.status,
            "recipient_kind": recipient.recipient_kind if recipient is not None else None,
            "program_type": recipient.program_type if recipient is not None else None,
            "gender": recipient.gender if recipient is not None else None,
            "age": recipient.age if recipient is not None else None,
            "item_type": item.item_type,
            "category": item.category,
        },
    }


def _age_text(recipient: Recipient | None) -> str | None:
    if recipient is None or recipient.age is None:
        return None
    unit = "months old" if recipient.age_unit == "MONTHS" else "years old"
    return f"{recipient.age} {unit}"


def _gender_text(value: str | None) -> str | None:
    if value == "F":
        return "girl female"
    if value == "M":
        return "boy male"
    if value == "X":
        return "nonbinary gender neutral"
    return None


def _point_id_for_wishlist_item(wishlist_item_id: uuid.UUID) -> uuid.UUID:
    return uuid.uuid5(uuid.NAMESPACE_URL, f"blessing-tree-gift:{wishlist_item_id}")


def _env_bool(name: str, *, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}
