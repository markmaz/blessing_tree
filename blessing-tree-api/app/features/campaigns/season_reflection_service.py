from __future__ import annotations

import random
import re
from typing import Any

from sqlalchemy.orm import Session

from app.features.admin.llm_runtime_service import AdminLlmRuntimeService, LlmRuntimeUnavailableError
from app.features.campaigns.season_reflection_catalog import PRAYER_CATALOG, VERSE_CATALOG
from app.features.campaigns.service import CampaignService


class CampaignSeasonReflectionService:
    def __init__(
        self,
        *,
        campaigns: CampaignService | None = None,
        runtime: AdminLlmRuntimeService | None = None,
    ) -> None:
        self.campaigns = campaigns or CampaignService()
        self.runtime = runtime or AdminLlmRuntimeService()
        self._random = random.SystemRandom()

    def get_reflection(
        self,
        db: Session,
        campaign_id: str,
        *,
        exclude_pair_ids: set[str] | None = None,
    ) -> dict[str, Any]:
        campaign = self.campaigns.get_campaign(db, campaign_id)
        theme = (campaign.season_theme or "").strip()
        fallback_reason: str | None = None
        verse_id: str | None = None
        prayer_id: str | None = None
        excluded_pairs = exclude_pair_ids or set()

        try:
            selection = self.runtime.draft_json(
                db,
                system_prompt=self._system_prompt(),
                user_prompt=self._user_prompt(campaign.name, campaign.year, campaign.description, theme),
            )
            if isinstance(selection, dict):
                verse_id = _clean_id(selection.get("verse_id"))
                prayer_id = _clean_id(selection.get("prayer_id"))
        except LlmRuntimeUnavailableError as exc:
            fallback_reason = str(exc)

        verse = _find_by_id(VERSE_CATALOG, verse_id) if verse_id else None
        prayer = _find_by_id(PRAYER_CATALOG, prayer_id) if prayer_id else None

        pair = _resolve_pair(
            theme,
            excluded_pair_ids=excluded_pairs,
            randomizer=self._random,
            preferred_verse=verse,
            preferred_prayer=prayer,
        )
        source = "llm" if verse is not None and prayer is not None and _pair_id(verse, prayer) == pair["pair_id"] else "fallback"
        if source == "fallback" and fallback_reason is None and (verse_id or prayer_id):
            fallback_reason = "Configured LLM did not return an approved reflection pair."

        return {
            "campaign_id": str(campaign.id),
            "season_theme": theme or None,
            "source": source,
            "fallback_reason": fallback_reason,
            "pair_id": pair["pair_id"],
            "verse": pair["verse"],
            "prayer": pair["prayer"],
        }

    @staticmethod
    def _system_prompt() -> str:
        return (
            "You are selecting a Catholic-leaning seasonal reflection for Blessing Tree. "
            "Return JSON only with exact catalog ids from the provided lists. "
            'Schema: {"verse_id": string, "prayer_id": string}. '
            "Do not invent or rewrite scripture or prayers. "
            "Choose only from the ids that appear in context."
        )

    @staticmethod
    def _user_prompt(campaign_name: str, year: int, description: str | None, season_theme: str) -> str:
        verse_catalog = [
            {"id": entry["id"], "reference": entry["reference"], "tags": list(entry["tags"])}
            for entry in VERSE_CATALOG
        ]
        prayer_catalog = [
            {"id": entry["id"], "title": entry["title"], "tags": list(entry["tags"])}
            for entry in PRAYER_CATALOG
        ]
        return (
            "Context:\n"
            f"campaign_name={campaign_name}\n"
            f"campaign_year={year}\n"
            f"campaign_description={description or ''}\n"
            f"season_theme={season_theme}\n"
            f"verse_catalog={verse_catalog}\n"
            f"prayer_catalog={prayer_catalog}\n\n"
            "Pick the most relevant verse and prayer ids for this theme. "
            "If the theme is blank or vague, choose a generally hopeful Catholic pairing."
        )


def _clean_id(value: object) -> str | None:
    text = str(value or "").strip().lower()
    return text or None


def _find_by_id(catalog: tuple[dict[str, Any], ...], entry_id: str | None) -> dict[str, Any] | None:
    if not entry_id:
        return None
    for entry in catalog:
        if entry["id"] == entry_id:
            return dict(entry)
    return None


def _pick_catalog_entry(
    catalog: tuple[dict[str, Any], ...],
    theme: str,
    randomizer: random.SystemRandom,
) -> dict[str, Any]:
    tokens = _tokenize(theme)
    if not tokens:
        return dict(randomizer.choice(catalog))

    scored_entries: list[tuple[int, dict[str, Any]]] = []
    for entry in catalog:
        tag_tokens = {tag.lower() for tag in entry["tags"]}
        score = sum(1 for token in tokens if token in tag_tokens)
        scored_entries.append((score, entry))

    max_score = max((score for score, _entry in scored_entries), default=0)
    if max_score <= 0:
        return dict(randomizer.choice(catalog))

    best_entries = [entry for score, entry in scored_entries if score == max_score]
    return dict(randomizer.choice(best_entries))


def _resolve_pair(
    theme: str,
    *,
    excluded_pair_ids: set[str],
    randomizer: random.SystemRandom,
    preferred_verse: dict[str, Any] | None,
    preferred_prayer: dict[str, Any] | None,
) -> dict[str, Any]:
    if preferred_verse is not None and preferred_prayer is not None:
        preferred_pair_id = _pair_id(preferred_verse, preferred_prayer)
        if preferred_pair_id not in excluded_pair_ids:
            return {
                "pair_id": preferred_pair_id,
                "verse": dict(preferred_verse),
                "prayer": dict(preferred_prayer),
            }

    ranked_verses = _rank_catalog_entries(VERSE_CATALOG, theme)
    ranked_prayers = _rank_catalog_entries(PRAYER_CATALOG, theme)

    candidate_pairs: list[tuple[int, dict[str, Any], dict[str, Any]]] = []
    for verse_score, verse in ranked_verses:
        for prayer_score, prayer in ranked_prayers:
            pair_id = _pair_id(verse, prayer)
            if pair_id in excluded_pair_ids:
                continue
            candidate_pairs.append((verse_score + prayer_score, verse, prayer))

    if not candidate_pairs:
        all_pairs = [
            (verse_score + prayer_score, verse, prayer)
            for verse_score, verse in ranked_verses
            for prayer_score, prayer in ranked_prayers
        ]
        candidate_pairs = all_pairs

    max_score = max(score for score, _verse, _prayer in candidate_pairs)
    best_pairs = [(verse, prayer) for score, verse, prayer in candidate_pairs if score == max_score]
    verse, prayer = randomizer.choice(best_pairs)
    return {
        "pair_id": _pair_id(verse, prayer),
        "verse": dict(verse),
        "prayer": dict(prayer),
    }


def _rank_catalog_entries(
    catalog: tuple[dict[str, Any], ...],
    theme: str,
) -> list[tuple[int, dict[str, Any]]]:
    tokens = _tokenize(theme)
    ranked: list[tuple[int, dict[str, Any]]] = []
    for entry in catalog:
        tag_tokens = {tag.lower() for tag in entry["tags"]}
        score = sum(1 for token in tokens if token in tag_tokens)
        ranked.append((score, entry))
    return ranked


def _pair_id(verse: dict[str, Any], prayer: dict[str, Any]) -> str:
    return f"{verse['id']}::{prayer['id']}"


def _tokenize(value: str) -> set[str]:
    return {
        token
        for token in re.split(r"[^a-z0-9]+", value.lower())
        if token
    }
