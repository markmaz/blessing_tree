from __future__ import annotations

import re
from dataclasses import dataclass, field


_CATEGORY_SYNONYMS: dict[str, tuple[str, ...]] = {
    "clothing": ("clothes", "clothing", "shirt", "pants", "jacket", "coat", "shoes", "boots", "socks", "hat", "gloves"),
    "coat": ("coat", "coats", "jacket", "jackets", "winter coat", "warm coat"),
    "toy": ("toy", "toys", "lego", "legos", "doll", "dolls", "truck", "game", "games", "puzzle", "puzzles"),
    "book": ("book", "books", "reading"),
    "gift_card": ("gift card", "gift cards", "voucher", "vouchers"),
    "essential": ("essential", "essentials", "hygiene", "toiletry", "toiletries", "blanket", "blankets"),
    "electronics": ("electronic", "electronics", "headphones", "tablet", "speaker"),
    "sports": ("sport", "sports", "basketball", "football", "soccer", "baseball"),
}

_ITEM_TYPE_BY_CATEGORY: dict[str, str] = {
    "clothing": "CLOTHING",
    "coat": "CLOTHING",
    "gift_card": "GIFT_CARD",
    "essential": "ESSENTIAL",
}

_GENDER_TERMS: dict[str, tuple[str, ...]] = {
    "F": ("girl", "girls", "female"),
    "M": ("boy", "boys", "male"),
    "X": ("nonbinary", "non-binary", "gender neutral", "any gender"),
}

_SIZE_PATTERN = re.compile(
    r"\b(?:size\s+)?("
    r"(?:youth|kids?|child(?:ren)?'?s?|adult|men'?s?|women'?s?)?\s*"
    r"(?:xxs|xs|s|m|l|xl|xxl|small|medium|large|x-large|extra large|\d+[tc]?|\d+/\d+|one size)"
    r")\b",
    re.IGNORECASE,
)

_STOP_TERMS = {
    "for",
    "and",
    "or",
    "the",
    "a",
    "an",
    "age",
    "ages",
    "year",
    "years",
    "old",
    "under",
    "over",
    "between",
    "gift",
    "gifts",
    "need",
    "needs",
    "looking",
    "find",
    "show",
    "me",
}


@dataclass(frozen=True)
class GiftSearchFilters:
    query: str = ""
    age_min: int | None = None
    age_max: int | None = None
    gender: str | None = None
    categories: list[str] = field(default_factory=list)
    item_types: list[str] = field(default_factory=list)
    sizes: list[str] = field(default_factory=list)
    min_cost_cents: int | None = None
    max_cost_cents: int | None = None
    terms: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, object]:
        return {
            "query": self.query,
            "age_min": self.age_min,
            "age_max": self.age_max,
            "gender": self.gender,
            "categories": list(self.categories),
            "item_types": list(self.item_types),
            "sizes": list(self.sizes),
            "min_cost_cents": self.min_cost_cents,
            "max_cost_cents": self.max_cost_cents,
            "terms": list(self.terms),
            "warnings": list(self.warnings),
        }


def parse_gift_search_text(value: object) -> GiftSearchFilters:
    query = _normalize_query(value)
    if not query:
        return GiftSearchFilters()

    normalized = query.lower()
    age_min, age_max = _parse_age_range(normalized)
    min_cost_cents, max_cost_cents = _parse_cost_range(normalized)
    gender = _parse_gender(normalized)
    categories = _parse_categories(normalized)
    item_types = _item_types_for_categories(categories)
    sizes = _parse_sizes(normalized)
    terms = _parse_terms(normalized, categories, sizes)
    warnings = _build_warnings(query, age_min, age_max, gender, categories, sizes, terms)

    return GiftSearchFilters(
        query=query,
        age_min=age_min,
        age_max=age_max,
        gender=gender,
        categories=categories,
        item_types=item_types,
        sizes=sizes,
        min_cost_cents=min_cost_cents,
        max_cost_cents=max_cost_cents,
        terms=terms,
        warnings=warnings,
    )


def _normalize_query(value: object) -> str:
    return " ".join(str(value or "").strip().split())


def _parse_age_range(value: str) -> tuple[int | None, int | None]:
    between_match = re.search(r"\b(?:ages?|between)\s+(\d{1,2})\s*(?:-|to|and)\s*(\d{1,2})\b", value)
    if between_match:
        left = int(between_match.group(1))
        right = int(between_match.group(2))
        return min(left, right), max(left, right)

    hyphen_match = re.search(r"\b(\d{1,2})\s*(?:-|to)\s*(\d{1,2})\s*(?:year|yr|yo|y/o|years old|old)?\b", value)
    if hyphen_match:
        left = int(hyphen_match.group(1))
        right = int(hyphen_match.group(2))
        return min(left, right), max(left, right)

    exact_match = re.search(r"\b(\d{1,2})\s*(?:year|yr|yo|y/o|years old|old)\b", value)
    if exact_match:
        age = int(exact_match.group(1))
        return age, age

    age_word_match = re.search(r"\bage\s+(\d{1,2})\b", value)
    if age_word_match:
        age = int(age_word_match.group(1))
        return age, age

    under_match = re.search(r"\b(?:under|younger than|less than)\s+(\d{1,2})\b", value)
    if under_match:
        return None, max(int(under_match.group(1)) - 1, 0)

    over_match = re.search(r"\b(?:over|older than|at least)\s+(\d{1,2})\b", value)
    if over_match:
        minimum = int(over_match.group(1))
        if "at least" not in over_match.group(0):
            minimum += 1
        return minimum, None

    if re.search(r"\btoddler|toddlers\b", value):
        return 1, 3
    if re.search(r"\bteen|teens|teenager|teenagers\b", value):
        return 13, 18
    if re.search(r"\binfant|baby|babies\b", value):
        return 0, 1

    return None, None


def _parse_cost_range(value: str) -> tuple[int | None, int | None]:
    under_match = re.search(r"\b(?:under|below|less than|max(?:imum)?|up to)\s+\$?(\d{1,4})\b", value)
    if under_match:
        return None, int(under_match.group(1)) * 100

    over_match = re.search(r"\b(?:over|above|more than|min(?:imum)?|at least)\s+\$?(\d{1,4})\b", value)
    if over_match:
        return int(over_match.group(1)) * 100, None

    range_match = re.search(r"\$?(\d{1,4})\s*(?:-|to)\s*\$?(\d{1,4})", value)
    if range_match:
        left = int(range_match.group(1)) * 100
        right = int(range_match.group(2)) * 100
        return min(left, right), max(left, right)

    return None, None


def _parse_gender(value: str) -> str | None:
    for gender, terms in _GENDER_TERMS.items():
        if any(re.search(rf"\b{re.escape(term)}\b", value) for term in terms):
            return gender
    return None


def _parse_categories(value: str) -> list[str]:
    categories: list[str] = []
    for category, terms in _CATEGORY_SYNONYMS.items():
        if any(re.search(rf"\b{re.escape(term)}\b", value) for term in terms):
            categories.append(category)
    return categories


def _item_types_for_categories(categories: list[str]) -> list[str]:
    item_types = [_ITEM_TYPE_BY_CATEGORY[category] for category in categories if category in _ITEM_TYPE_BY_CATEGORY]
    return sorted(set(item_types))


def _parse_sizes(value: str) -> list[str]:
    sizes: list[str] = []
    for match in _SIZE_PATTERN.finditer(value):
        size = " ".join(match.group(1).split()).strip()
        if size and not size.isdigit():
            sizes.append(size)
    return sorted(set(sizes))


def _parse_terms(value: str, categories: list[str], sizes: list[str]) -> list[str]:
    consumed = set(categories)
    for category in categories:
        consumed.update(_CATEGORY_SYNONYMS.get(category, ()))
    for terms in _GENDER_TERMS.values():
        consumed.update(terms)
    consumed.update(sizes)

    words = re.findall(r"[a-z0-9][a-z0-9'-]*", value)
    terms: list[str] = []
    for word in words:
        if word in _STOP_TERMS or word in consumed or word.isdigit() or len(word) < 3:
            continue
        if word not in terms:
            terms.append(word)
    return terms[:8]


def _build_warnings(
    query: str,
    age_min: int | None,
    age_max: int | None,
    gender: str | None,
    categories: list[str],
    sizes: list[str],
    terms: list[str],
) -> list[str]:
    if not query:
        return []
    if any(value is not None for value in (age_min, age_max)) or gender or categories or sizes or terms:
        return []
    return ["No structured filters were detected; searching by text only."]
