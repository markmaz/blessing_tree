from __future__ import annotations

from dataclasses import dataclass

from app.features.ask.field_reference import FIELD_REFERENCES
from app.features.ask.help_catalog import HELP_TOPICS
from app.features.ask.knowledge_base import KNOWLEDGE_ARTICLES
from app.features.ask.navigation_catalog import NAVIGATION_TARGETS
from app.features.ask.schemas import KnowledgeArticle


@dataclass(frozen=True)
class AskKnowledgeDocument:
    key: str
    title: str
    section: str
    content: str
    document_type: str
    route_name: str | None = None
    required_capability: str | None = None

    def to_article(self) -> KnowledgeArticle:
        return KnowledgeArticle(
            key=self.key,
            title=self.title,
            section=self.section,
            content=self.content,
            phrases=(self.title,),
            route_name=self.route_name,
            required_capability=self.required_capability,
        )


def build_ask_knowledge_documents() -> tuple[AskKnowledgeDocument, ...]:
    documents: list[AskKnowledgeDocument] = []
    for article in KNOWLEDGE_ARTICLES:
        documents.append(
            AskKnowledgeDocument(
                key=article.key,
                title=article.title,
                section=article.section,
                content=_join_parts(article.content, *article.steps),
                document_type="guide_article",
                route_name=article.route_name,
                required_capability=article.required_capability,
            )
        )
    for ref in FIELD_REFERENCES:
        key = f"field_reference_{_slug(ref.field)}"
        documents.append(
            AskKnowledgeDocument(
                key=key,
                title=f"{ref.field} Field",
                section=f"User Guide > Detailed Field Reference > {ref.section}",
                content=f"{ref.field}: {ref.what_it_does} Suggestion: {ref.suggestion}",
                document_type="field_reference",
            )
        )
    for topic in HELP_TOPICS:
        documents.append(
            AskKnowledgeDocument(
                key=f"help_{topic.key}",
                title=topic.title,
                section="Ask Blessing Tree > Help Catalog",
                content=_join_parts(topic.answer, *topic.steps),
                document_type="help_topic",
                route_name=topic.actions[0].route_name if topic.actions else None,
                required_capability=topic.actions[0].required_capability if topic.actions else None,
            )
        )
    for target in NAVIGATION_TARGETS:
        documents.append(
            AskKnowledgeDocument(
                key=f"navigation_{target.key}",
                title=target.title,
                section="Ask Blessing Tree > Navigation Catalog",
                content=f"Open {target.title} when a user asks for: {', '.join(target.phrases)}.",
                document_type="navigation",
                route_name=target.route_name,
                required_capability=target.required_capability,
            )
        )
    return tuple(documents)


def _join_parts(*parts: str) -> str:
    return " ".join(part.strip() for part in parts if part and part.strip())


def _slug(value: str) -> str:
    return "_".join(part for part in value.lower().replace("/", " ").replace("-", " ").split() if part)
