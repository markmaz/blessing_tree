from __future__ import annotations

import re

from app.features.ask.entity_extractor import extract_entities, normalize_prompt
from app.features.ask.help_catalog import HELP_TOPICS
from app.features.ask.navigation_catalog import NAVIGATION_TARGETS
from app.features.ask.report_catalog import REPORT_METRICS
from app.features.ask.schemas import Classification

STOP_WORDS = {
    "a",
    "an",
    "and",
    "are",
    "do",
    "for",
    "how",
    "i",
    "is",
    "of",
    "out",
    "the",
    "to",
    "we",
}


def classify_prompt(prompt: str) -> Classification:
    text = normalize_prompt(prompt)
    entities = extract_entities(text)
    scored: list[tuple[str, str, float]] = []

    for item in HELP_TOPICS:
        scored.append(("app_help", item.key, _score(text, item.phrases)))
    for item in NAVIGATION_TARGETS:
        scored.append(("navigation_result", item.key, _score(text, item.phrases)))
    for item in REPORT_METRICS:
        scored.append(("report_result", item.metric_key, _report_score(text, item)))

    best_kind, best_key, best_score = max(scored, key=lambda item: item[2], default=("clarification", None, 0.0))
    if entities.intent in {"count", "list"}:
        report_kind, report_key, report_score = max(
            (item for item in scored if item[0] == "report_result"),
            key=lambda item: item[2],
            default=("report_result", None, 0.0),
        )
        if report_score >= max(0.55, best_score - 0.1):
            best_kind, best_key, best_score = report_kind, report_key, report_score
    if best_score <= 0:
        return Classification(
            kind="clarification",
            key=None,
            confidence=0.0,
            entities=entities,
            alternates=_default_suggestions(),
        )

    confidence = min(0.95, best_score)
    if confidence < 0.55:
        return Classification(
            kind="clarification",
            key=None,
            confidence=confidence,
            entities=entities,
            alternates=_default_suggestions(),
        )

    if entities.intent == "navigate" and best_kind == "app_help":
        nav_match = max(
            (("navigation_result", item.key, _score(text, item.phrases)) for item in NAVIGATION_TARGETS),
            key=lambda item: item[2],
            default=("navigation_result", None, 0.0),
        )
        if nav_match[2] >= confidence * 0.75:
            best_kind, best_key, confidence = nav_match

    return Classification(
        kind=best_kind,  # type: ignore[arg-type]
        key=best_key,
        confidence=confidence,
        entities=entities,
        alternates=_alternates(text, best_key),
    )


def _score(text: str, phrases: tuple[str, ...]) -> float:
    best = 0.0
    words = _meaningful_words(text)
    for phrase in phrases:
        normalized = normalize_prompt(phrase)
        if not normalized:
            continue
        if normalized in text:
            best = max(best, 0.95 if normalized == text else 0.86)
            continue
        phrase_words = _meaningful_words(normalized)
        if not phrase_words:
            continue
        overlap = len(words & phrase_words) / len(phrase_words)
        if len(phrase_words) <= 2 and overlap < 1:
            continue
        if overlap >= 0.75:
            best = max(best, 0.72)
        elif overlap >= 0.5:
            best = max(best, 0.58)
    return best


def _report_score(text: str, item) -> float:
    score = _score(text, item.phrases)
    subject_words = {
        "sponsors": ("sponsor", "sponsors"),
        "recipients": ("recipient", "recipients", "child", "children", "people"),
        "wishlist_items": ("gift", "gifts", "wishlist"),
        "donations": ("donation", "donations", "inventory", "donated"),
        "dashboard": ("dashboard", "recent", "left", "off", "continue"),
    }.get(item.subject, ())
    if score > 0 and any(re.search(rf"\b{re.escape(word)}\b", text) for word in subject_words):
        boost = 0.12 if item.subject == "sponsors" else 0.06
        return min(0.98, score + boost)
    return score


def _alternates(text: str, selected_key: str | None) -> list[str]:
    candidates: list[tuple[str, float]] = []
    for item in HELP_TOPICS:
        if item.key != selected_key:
            candidates.append((item.title, _score(text, item.phrases)))
    for item in NAVIGATION_TARGETS:
        if item.key != selected_key:
            candidates.append((item.title, _score(text, item.phrases)))
    for item in REPORT_METRICS:
        if item.metric_key != selected_key:
            candidates.append((item.title, _score(text, item.phrases)))
    return [title for title, score in sorted(candidates, key=lambda item: item[1], reverse=True)[:3] if score > 0.4]


def _default_suggestions() -> list[str]:
    return [
        "How do I add a sponsor?",
        "Where is the Gift Status report?",
        "Show recipients still needing sponsors.",
        "Show committed gifts not received.",
    ]


def _meaningful_words(value: str) -> set[str]:
    return {
        word.rstrip("s")
        for word in re.findall(r"[a-z0-9]+", value)
        if word and word not in STOP_WORDS
    }
