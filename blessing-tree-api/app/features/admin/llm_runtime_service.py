from __future__ import annotations

import json
import re
from typing import TYPE_CHECKING, Any

import requests
from requests import RequestException, Response
from sqlalchemy.orm import Session

from app.models.admin_llm_configuration import AdminLlmConfiguration
from app.utils.secret_encryption import decrypt_secret

if TYPE_CHECKING:
    from app.features.admin.llm_service import AdminLlmService


class LlmRuntimeUnavailableError(RuntimeError):
    pass


class AdminLlmRuntimeService:
    def __init__(self, llm_service: AdminLlmService | None = None) -> None:
        if llm_service is None:
            from app.features.admin.llm_service import AdminLlmService

            llm_service = AdminLlmService()
        self._llm_service = llm_service

    def draft_json(
        self,
        db: Session,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> dict[str, Any] | None:
        config = self._llm_service.get_configuration(db)
        if config is None or not config.is_enabled:
            return None
        return self._request_json(config, system_prompt=system_prompt, user_prompt=user_prompt)

    def _request_json(
        self,
        config: AdminLlmConfiguration,
        *,
        system_prompt: str,
        user_prompt: str,
    ) -> dict[str, Any]:
        headers = {"Content-Type": "application/json"}
        api_key = decrypt_secret(config.api_key_encrypted)
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload: dict[str, Any] = {
            "model": config.model,
            "temperature": 0.2,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            "response_format": {"type": "json_object"},
        }
        endpoint = f"{config.base_url.rstrip('/')}/chat/completions"

        try:
            response = self._post_chat_completion(endpoint, headers=headers, payload=payload)
        except RequestException as exc:
            raise LlmRuntimeUnavailableError(
                f"Configured LLM request failed: {exc}"
            ) from exc

        content = _extract_response_content(response)
        parsed = _parse_json_object(content)
        if not isinstance(parsed, dict):
            raise LlmRuntimeUnavailableError("Configured LLM returned a non-object JSON payload.")
        return parsed

    @staticmethod
    def _post_chat_completion(
        endpoint: str,
        *,
        headers: dict[str, str],
        payload: dict[str, Any],
    ) -> Response:
        response = requests.post(endpoint, headers=headers, json=payload, timeout=45)
        if response.status_code >= 400 and payload.get("response_format") is not None:
            fallback_payload = dict(payload)
            fallback_payload.pop("response_format", None)
            retry = requests.post(endpoint, headers=headers, json=fallback_payload, timeout=45)
            retry.raise_for_status()
            return retry

        response.raise_for_status()
        return response


def _extract_response_content(response: Response) -> str:
    payload = response.json()
    choices = payload.get("choices")
    if not isinstance(choices, list) or not choices:
        raise LlmRuntimeUnavailableError("Configured LLM response did not include any choices.")

    message = choices[0].get("message") if isinstance(choices[0], dict) else None
    if not isinstance(message, dict):
        raise LlmRuntimeUnavailableError("Configured LLM response did not include a message payload.")

    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text_parts: list[str] = []
        for item in content:
            if not isinstance(item, dict):
                continue
            if item.get("type") == "text" and isinstance(item.get("text"), str):
                text_parts.append(item["text"])
        if text_parts:
            return "\n".join(text_parts)

    raise LlmRuntimeUnavailableError("Configured LLM response did not include textual content.")


def _parse_json_object(content: str) -> Any:
    stripped = content.strip()
    if stripped.startswith("```"):
        fenced = re.sub(r"^```(?:json)?\s*", "", stripped)
        stripped = re.sub(r"\s*```$", "", fenced)

    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", stripped, flags=re.DOTALL)
        if not match:
            raise LlmRuntimeUnavailableError("Configured LLM did not return valid JSON.")
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise LlmRuntimeUnavailableError("Configured LLM returned malformed JSON.") from exc
