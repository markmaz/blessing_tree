from __future__ import annotations

import os
import uuid
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any

import requests
from requests import RequestException
from sqlalchemy.orm import Session

from app.features.ask.knowledge_documents import AskKnowledgeDocument, build_ask_knowledge_documents
from app.features.ask.schemas import KnowledgeArticle

if TYPE_CHECKING:
    from app.features.admin.llm_runtime_service import AdminLlmRuntimeService


@dataclass(frozen=True)
class AskVectorConfig:
    enabled: bool
    qdrant_url: str
    qdrant_api_key: str | None
    collection: str
    timeout_s: float
    embedding_model: str
    min_score: float

    @classmethod
    def from_env(cls) -> "AskVectorConfig":
        return cls(
            enabled=_env_bool("BT_ASK_VECTOR_ENABLED", default=False),
            qdrant_url=(os.getenv("QDRANT_URL") or "http://localhost:6333").rstrip("/"),
            qdrant_api_key=(os.getenv("QDRANT_API_KEY") or "").strip() or None,
            collection=(os.getenv("BT_ASK_KNOWLEDGE_COLLECTION") or "blessing_tree_ask_knowledge").strip(),
            timeout_s=float(os.getenv("QDRANT_TIMEOUT_S") or "30"),
            embedding_model=(os.getenv("BT_ASK_EMBEDDING_MODEL") or "text-embedding-3-small").strip(),
            min_score=float(os.getenv("BT_ASK_VECTOR_MIN_SCORE") or "0.62"),
        )


class AskVectorKnowledgeRetriever:
    def __init__(
        self,
        *,
        runtime: AdminLlmRuntimeService | None = None,
        config: AskVectorConfig | None = None,
    ) -> None:
        if runtime is None:
            from app.features.admin.llm_runtime_service import AdminLlmRuntimeService

            runtime = AdminLlmRuntimeService()
        self.runtime = runtime
        self.config = config or AskVectorConfig.from_env()
        self._indexed = False

    def search(self, db: Session, *, prompt: str, retrieval_query: str | None = None) -> tuple[KnowledgeArticle, float] | None:
        if not self.config.enabled:
            return None
        documents = build_ask_knowledge_documents()
        if not documents:
            return None
        try:
            self._ensure_index(db, documents)
            embeddings = self.runtime.embed_texts(db, texts=[retrieval_query or prompt], model=self.config.embedding_model)
            if not embeddings:
                return None
            match = self._search_qdrant(embeddings[0])
        except (RuntimeError, RequestException, ValueError):
            return None
        if match is None or match[1] < self.config.min_score:
            return None
        return match

    def _ensure_index(self, db: Session, documents: tuple[AskKnowledgeDocument, ...]) -> None:
        if self._indexed:
            return
        texts = [f"{doc.title}\n{doc.section}\n{doc.content}" for doc in documents]
        embeddings = self.runtime.embed_texts(db, texts=texts, model=self.config.embedding_model)
        if not embeddings:
            return
        self._ensure_collection(vector_size=len(embeddings[0]))
        self._upsert_documents(documents, embeddings)
        self._indexed = True

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

    def _upsert_documents(
        self,
        documents: tuple[AskKnowledgeDocument, ...],
        embeddings: list[list[float]],
    ) -> None:
        points = []
        for doc, embedding in zip(documents, embeddings, strict=True):
            points.append(
                {
                    "id": str(uuid.uuid5(uuid.NAMESPACE_URL, f"blessing-tree-ask:{doc.key}")),
                    "vector": embedding,
                    "payload": {
                        "key": doc.key,
                        "title": doc.title,
                        "section": doc.section,
                        "content": doc.content,
                        "document_type": doc.document_type,
                        "route_name": doc.route_name,
                        "required_capability": doc.required_capability,
                    },
                }
            )
        response = requests.put(
            f"{self.config.qdrant_url}/collections/{self.config.collection}/points",
            headers=self._headers(),
            json={"points": points},
            timeout=self.config.timeout_s,
        )
        response.raise_for_status()

    def _search_qdrant(self, embedding: list[float]) -> tuple[KnowledgeArticle, float] | None:
        response = requests.post(
            f"{self.config.qdrant_url}/collections/{self.config.collection}/points/search",
            headers=self._headers(),
            json={"vector": embedding, "limit": 1, "with_payload": True},
            timeout=self.config.timeout_s,
        )
        response.raise_for_status()
        payload = response.json()
        result = payload.get("result") if isinstance(payload, dict) else None
        if not isinstance(result, list) or not result:
            return None
        item = result[0]
        if not isinstance(item, dict):
            return None
        point_payload = item.get("payload")
        if not isinstance(point_payload, dict):
            return None
        score = float(item.get("score") or 0)
        article = _article_from_payload(point_payload)
        if article is None:
            return None
        return article, score

    def _headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config.qdrant_api_key:
            headers["api-key"] = self.config.qdrant_api_key
        return headers


def _article_from_payload(payload: dict[str, Any]) -> KnowledgeArticle | None:
    key = payload.get("key")
    title = payload.get("title")
    section = payload.get("section")
    content = payload.get("content")
    if not all(isinstance(value, str) and value.strip() for value in (key, title, section, content)):
        return None
    route_name = payload.get("route_name")
    required_capability = payload.get("required_capability")
    return KnowledgeArticle(
        key=key,
        title=title,
        section=section,
        content=content,
        phrases=(title,),
        route_name=route_name if isinstance(route_name, str) and route_name else None,
        required_capability=required_capability if isinstance(required_capability, str) and required_capability else None,
    )


def _env_bool(name: str, *, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}
