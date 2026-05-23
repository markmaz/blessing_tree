from __future__ import annotations

from typing import Any

import requests

from app.config import (
    BT_ADDRESS_AUTOCOMPLETE_COUNTRY_CODE,
    GEOAPIFY_ADDRESS_AUTOCOMPLETE_URL,
    GEOAPIFY_API_KEY,
)


class CampaignRecipientAddressLookupService:
    def search(
        self,
        query: str,
        *,
        country_code: str | None = None,
        limit: int = 5,
    ) -> list[dict[str, Any]]:
        normalized_query = (query or "").strip()
        if len(normalized_query) < 3:
            return []

        bounded_limit = max(1, min(limit, 8))
        normalized_country = (country_code or BT_ADDRESS_AUTOCOMPLETE_COUNTRY_CODE or "us").strip().lower()

        if GEOAPIFY_API_KEY:
            return self._search_geoapify(
                normalized_query,
                country_code=normalized_country,
                limit=bounded_limit,
            )

        return self._search_photon(
            normalized_query,
            country_code=normalized_country,
            limit=bounded_limit,
        )

    def _search_geoapify(
        self,
        query: str,
        *,
        country_code: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        response = requests.get(
            GEOAPIFY_ADDRESS_AUTOCOMPLETE_URL,
            params={
                "text": query,
                "format": "json",
                "limit": limit,
                "filter": f"countrycode:{country_code}",
                "apiKey": GEOAPIFY_API_KEY,
            },
            timeout=8,
        )
        response.raise_for_status()
        payload = response.json()
        return _normalize_geoapify_results(payload.get("results", []))

    def _search_photon(
        self,
        query: str,
        *,
        country_code: str,
        limit: int,
    ) -> list[dict[str, Any]]:
        response = requests.get(
            "https://photon.komoot.io/api/",
            params={
                "q": query,
                "limit": limit,
                "lang": "en",
            },
            timeout=8,
        )
        response.raise_for_status()
        payload = response.json()
        return _normalize_photon_results(payload.get("features", []), country_code=country_code)


def _normalize_geoapify_results(results: list[dict[str, Any]]) -> list[dict[str, Any]]:
    suggestions: list[dict[str, Any]] = []
    seen: set[str] = set()
    for result in results:
        address_line1 = _address_line(
            result.get("housenumber"),
            result.get("street") or result.get("name"),
        ) or _formatted_line1(result.get("formatted"))
        city = result.get("city") or result.get("town") or result.get("village")
        state = result.get("state_code") or result.get("state")
        postal_code = result.get("postcode")
        label = result.get("formatted") or _compose_label(address_line1, city, state, postal_code)
        if not address_line1 or not label or label in seen:
            continue
        seen.add(label)
        suggestions.append(
            {
                "label": label,
                "address_line1": address_line1,
                "city": city,
                "state": state,
                "postal_code": postal_code,
            }
        )
    return suggestions


def _normalize_photon_results(
    features: list[dict[str, Any]],
    *,
    country_code: str,
) -> list[dict[str, Any]]:
    suggestions: list[dict[str, Any]] = []
    seen: set[str] = set()
    for feature in features:
        properties = feature.get("properties") or {}
        feature_country = (properties.get("countrycode") or "").strip().lower()
        if country_code and feature_country and feature_country != country_code:
            continue
        address_line1 = _address_line(
            properties.get("housenumber"),
            properties.get("street") or properties.get("name"),
        ) or _formatted_line1(properties.get("name"))
        city = (
            properties.get("city")
            or properties.get("district")
            or properties.get("county")
        )
        state = properties.get("state")
        postal_code = properties.get("postcode")
        label = _compose_label(address_line1, city, state, postal_code)
        if not address_line1 or not label or label in seen:
            continue
        seen.add(label)
        suggestions.append(
            {
                "label": label,
                "address_line1": address_line1,
                "city": city,
                "state": state,
                "postal_code": postal_code,
            }
        )
    return suggestions


def _address_line(house_number: str | None, street: str | None) -> str | None:
    parts = [part.strip() for part in (house_number, street) if isinstance(part, str) and part.strip()]
    if not parts:
        return None
    return " ".join(parts)


def _formatted_line1(formatted_address: str | None) -> str | None:
    if not formatted_address or not formatted_address.strip():
        return None
    return formatted_address.split(",")[0].strip() or None


def _compose_label(
    address_line1: str | None,
    city: str | None,
    state: str | None,
    postal_code: str | None,
) -> str | None:
    if not address_line1:
        return None
    parts = [address_line1]
    locality = ", ".join([value for value in (city, state) if value])
    if locality:
        parts.append(locality)
    if postal_code:
        parts.append(postal_code)
    return ", ".join(parts)
