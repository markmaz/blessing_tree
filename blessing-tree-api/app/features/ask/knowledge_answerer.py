from __future__ import annotations

import json
from typing import TYPE_CHECKING

from sqlalchemy.orm import Session

from app.features.ask.schemas import KnowledgeArticle

if TYPE_CHECKING:
    from app.features.admin.llm_runtime_service import AdminLlmRuntimeService


class AskKnowledgeAnswerer:
    def __init__(self, runtime: AdminLlmRuntimeService | None = None) -> None:
        if runtime is None:
            from app.features.admin.llm_runtime_service import AdminLlmRuntimeService

            runtime = AdminLlmRuntimeService()
        self.runtime = runtime

    def answer(self, db: Session, *, prompt: str, article: KnowledgeArticle) -> str | None:
        system_prompt = (
            "You answer Blessing Tree app-help questions using only the supplied knowledge article. "
            "Do not invent screens, fields, policies, or data. If the article does not answer the question, "
            "return a short answer saying the guide does not have enough detail. Return JSON only."
        )
        user_payload = {
            "prompt": prompt,
            "source": {
                "title": article.title,
                "section": article.section,
                "content": article.content,
                "steps": list(article.steps),
            },
            "required_response_shape": {
                "answer": "plain-language answer for a nontechnical Blessing Tree user",
            },
        }
        try:
            payload = self.runtime.draft_json(
                db,
                system_prompt=system_prompt,
                user_prompt=json.dumps(user_payload, separators=(",", ":")),
            )
        except RuntimeError:
            return None

        answer = payload.get("answer") if isinstance(payload, dict) else None
        if not isinstance(answer, str):
            return None
        answer = answer.strip()
        return answer or None
