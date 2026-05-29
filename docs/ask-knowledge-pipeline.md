# Ask Blessing Tree Knowledge Pipeline

## Direction

Ask Blessing Tree should answer app-help and field-help questions through a retrieval-grounded pipeline, not through one-off phrase matches. The deterministic catalog is still useful as a safe fallback, but it should not be the long-term intelligence layer.

## MVP Implemented Direction

1. Detect field-help prompts such as `What should I put in campaign purpose?`, `Explain drop off due`, or `What goes in people served?`.
2. Retrieve the matching field from the documented field reference catalog.
3. Return a grounded answer using the field's documented purpose and suggestion.
4. When the configured admin LLM is available, allow it to rewrite the retrieved context into a friendlier answer while staying grounded in the source article.
5. Fall back to the raw documented field reference when the LLM is disabled or unavailable.

## Query Planning

Ask now has a query-planning step before retrieval. The planner can use the configured admin LLM to classify the knowledge intent and extract a clean field or screen term. If the LLM is unavailable, deterministic planning still handles common prompts.

Planner output:

| Field | Purpose |
| --- | --- |
| `intent` | `field_help`, `workflow_help`, `navigation_help`, `report_question`, `general_help`, or `unknown`. |
| `field_name` | Clean field label when the user is asking about a form field. |
| `screen` | Screen or workspace name when present. |
| `retrieval_query` | Short query used for vector retrieval. |
| `confidence` | Planner confidence. |

This means prompts like `What should go here?` can be answered correctly once UI context is passed in as a field name, and prompts with user typos can still use retrieval rather than hard-coded phrase matching.

## Why This Is Better

- It works across the full documented field catalog instead of only fields that have custom help topics.
- It reduces false matches because generic words such as `what`, `should`, `put`, and `field` are ignored during field matching.
- It keeps answers grounded in Blessing Tree documentation.
- It keeps existing deterministic report execution for data questions, so the LLM does not write SQL.

## Qdrant Phase

Qdrant becomes valuable when the knowledge base grows beyond the current structured field catalog:

- Full user guide chunks
- Screen-level help
- Workflow docs
- Release notes
- Troubleshooting docs
- Admin-maintained help articles
- Field metadata from the UI

The recommended Qdrant metadata model:

| Metadata | Purpose |
| --- | --- |
| `type` | `field_reference`, `screen_help`, `workflow`, `report_help`, `admin_help` |
| `section` | User guide or app section |
| `screen` | Route or screen identifier |
| `field` | Field name when applicable |
| `capability` | Required app permission when applicable |
| `source` | User guide, seeded catalog, admin article, generated UI metadata |

The retrieval flow should be:

1. LLM/NER extracts intent and entities: `field_help`, `navigation_help`, `workflow_help`, `report_question`, plus field/screen names when present.
2. Query Qdrant with the prompt plus extracted entities.
3. Filter by campaign/app permissions when the answer points to a screen or action.
4. Ask the LLM to answer using only retrieved chunks.
5. Include source attribution and app actions.

## Optional Qdrant Runtime

The backend now has an optional Qdrant retriever. It is disabled by default and does not change normal Ask behavior unless explicitly enabled.

Environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BT_ASK_VECTOR_ENABLED` | `true` | Turns Qdrant retrieval on for Ask Blessing Tree. |
| `QDRANT_URL` | `http://localhost:6333` | Qdrant HTTP endpoint. |
| `QDRANT_API_KEY` | empty | Optional Qdrant API key. |
| `QDRANT_TIMEOUT_S` | `30` | Qdrant HTTP timeout. |
| `BT_ASK_KNOWLEDGE_COLLECTION` | `blessing_tree_ask_knowledge` | Collection used for Ask knowledge chunks. |
| `BT_ASK_EMBEDDING_MODEL` | `text-embedding-3-small` | OpenAI-compatible embedding model. |
| `BT_ASK_VECTOR_MIN_SCORE` | `0.62` | Minimum vector score accepted for an answer. |

Local Docker:

```bash
docker compose --profile ask-vector up qdrant
```

When enabled, the retriever lazily indexes seeded Ask knowledge documents into Qdrant and searches them before falling back to the older broad knowledge search. Structured exact field lookup still runs first because it is cheaper and more reliable for documented field names. If Qdrant or embeddings are unavailable, Ask falls back without failing the request.

## UI Context

The Ask endpoint accepts an optional `context` object:

```json
{
  "prompt": "What should I put here?",
  "context": {
    "screen": "Campaign Settings",
    "field_name": "Campaign Purpose",
    "field_label": "Campaign Purpose",
    "route": "/campaigns/{campaignId}/studio"
  }
}
```

When `field_name` or `field_label` is provided, the planner treats the request as field help and retrieves the documented field explanation directly. This allows the frontend to expose small, non-intrusive help icons beside fields without requiring users to type the field name.

## Guardrails

- Report/data questions continue to use deterministic report executors.
- LLM answers must be grounded in retrieved context.
- If retrieved confidence is low, Ask should clarify rather than guess.
- Sensitive recipient/sponsor data should never be indexed into general app-help vectors.
