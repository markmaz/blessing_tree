from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Literal

AskKind = Literal["app_help", "navigation_result", "report_result", "knowledge_result", "clarification", "error"]
AskIntent = Literal["count", "list", "navigate", "help"]


@dataclass(frozen=True)
class AskAction:
    label: str
    type: str = "route"
    route_name: str | None = None
    route: str | None = None
    prompt: str | None = None
    required_capability: str | None = None


@dataclass(frozen=True)
class HelpTopic:
    key: str
    title: str
    phrases: tuple[str, ...]
    answer: str
    steps: tuple[str, ...] = ()
    actions: tuple[AskAction, ...] = ()
    related_prompts: tuple[str, ...] = ()


@dataclass(frozen=True)
class NavigationTarget:
    key: str
    title: str
    phrases: tuple[str, ...]
    route_name: str
    required_capability: str | None = None


@dataclass(frozen=True)
class ReportMetric:
    metric_key: str
    title: str
    subject: str
    phrases: tuple[str, ...]
    intents: tuple[str, ...]
    required_capability: str
    executor: str


@dataclass(frozen=True)
class KnowledgeArticle:
    key: str
    title: str
    section: str
    content: str
    phrases: tuple[str, ...]
    steps: tuple[str, ...] = ()
    route_name: str | None = None
    required_capability: str | None = None


@dataclass
class ExtractedEntities:
    intent: str | None = None
    filters: dict[str, Any] = field(default_factory=dict)
    filter_chips: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


@dataclass
class Classification:
    kind: AskKind
    key: str | None
    confidence: float
    entities: ExtractedEntities = field(default_factory=ExtractedEntities)
    alternates: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    source: str = "deterministic"
