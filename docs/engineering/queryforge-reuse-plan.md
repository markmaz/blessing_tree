# QueryForge Reuse Plan For Blessing Tree

Last updated: 2026-05-24

## Status

- Proposed architecture addendum.
- Informs gift search, natural-language reporting, Qdrant usage, and future
  feedback learning.
- Does not require Blessing Tree to port QueryForge wholesale.

Related design:

- `docs/engineering/gift-workflow-design.md`
- `docs/engineering/gift-workflow-implementation-plan.md`

## Purpose

Blessing Tree is moving toward natural-language workflows:

- staff and sponsors should be able to search gifts with plain language
- staff should be able to ask operational questions like "how many children
  still need sponsors?"
- staff should be able to find unmatched donated inventory and open wishlist
  needs without knowing internal data names

QueryForge already solved adjacent problems: semantic search, planner
contracts, vector-backed candidate retrieval, governed learning, and UI
patterns for cancellable natural-language requests. This plan identifies what
to reuse, what to adapt, and what to avoid.

## QueryForge Sources Reviewed

Backend architecture and code:

- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/docs/architecture/planner-pipeline.md`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/docs/architecture/semantic-layer.md`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/docs/concepts/planner.md`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/docs/reference/planner-response-objects.md`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/app/infra/qdrant_client.py`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/app/infra/embedding_model.py`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/app/services/embedding/embedding_index_service.py`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/app/services/embedding/embedding_search_service.py`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/app/services/planner_domain/service.py`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/app/services/planner_domain/prompt_signal_service.py`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-api/app/services/planner_domain/schema_v2.py`

Policy and learning specs:

- `/Users/mmaslak/Local Documents/projects/query_forge/specs/queryforge_planner_retrieval_policy_spec.md`
- `/Users/mmaslak/Local Documents/projects/query_forge/specs/queryforge_feedback_learning_spec.md`
- `/Users/mmaslak/Local Documents/projects/query_forge/specs/queryforge_shared_ai_pipeline_architecture_spec.md`

Frontend code:

- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-ui/src/shared/services/semantic/planner.ts`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-ui/src/features/query-forge/ui/ai/usePlannerConversation.ts`
- `/Users/mmaslak/Local Documents/projects/query_forge/query-forge-ui/src/features/feedback-learning/api/feedbackLearningApi.ts`

## Recommendation

Use QueryForge as an architecture reference, not a dependency.

Blessing Tree should adopt:

- MySQL as the source of truth and Qdrant as a derived search index
- deterministic parsers before LLM planning
- typed request and response contracts
- structured plan objects for natural-language reporting
- vector retrieval plus SQL authorization and eligibility checks
- trace/debug payloads that explain how a natural-language request was handled
- governed feedback learning later, after usage patterns exist

Blessing Tree should not start by porting:

- QueryForge's full planner-domain orchestration
- arbitrary SQL or SQL-JSON compilation
- generic domain selection across unknown schemas
- the full semantic admin catalog
- the full feedback-learning admin surface

The first implementation should stay product-specific and operationally safe.

## Reuse Map

### Reuse Now

#### Qdrant Wrapper Pattern

QueryForge's `QdrantClientWrapper` has the right boundaries:

- ensure a collection exists
- validate vector size and distance
- create payload indexes
- upsert derived documents
- run vector search with hard payload filters
- retrieve payloads by point id

Blessing Tree should create a smaller local equivalent when Qdrant is added.
It should live behind a feature flag/config switch so local development can
continue with SQL-only search until Qdrant is running.

Recommended Blessing Tree package:

```text
blessing-tree-api/app/features/search/
  __init__.py
  embeddings.py
  qdrant_client.py
  semantic_index_service.py
  semantic_search_service.py
```

#### Derived Index Pattern

QueryForge treats MySQL as durable truth and Qdrant as a rebuildable index.
Blessing Tree should do the same.

Qdrant must not be the only place a gift's availability, public eligibility,
or authorization state is enforced. Vector search can find candidates, but the
final result set must be loaded and filtered through SQL.

#### Hybrid Scoring

QueryForge does not trust vector similarity alone. It applies lexical,
semantic, and scope boosts after candidate retrieval.

Blessing Tree should use the same idea for gifts:

- vector similarity for fuzzy intent
- lexical boosts for explicit category, item, color, and size matches
- age-range overlap boosts
- gender match boosts when specified
- campaign/status/public-eligibility hard filters
- penalty for fulfilled, reserved, hidden, or staff-only items

#### Strict Plan Contracts

QueryForge's planner schema uses strict typed objects and rejects unexpected
shape. Blessing Tree should use strict Pydantic contracts for natural-language
report planning and TypeScript schemas on the frontend.

This matters because reporting questions can look harmless while producing
dangerous or misleading queries. The contract should constrain what the app can
execute.

#### Trace And Debug Payloads

QueryForge includes trace ids, validation status, candidate lists, timings, and
explanations. Blessing Tree should include a smaller debug block for staff
natural-language features:

```json
{
  "parsed_filters": {},
  "candidate_count": 12,
  "execution_mode": "sql",
  "vector_enabled": false,
  "warnings": []
}
```

This should be available to staff/admin users, not public sponsors.

### Adapt Later

#### Semantic Concepts And Aliases

QueryForge's semantic concepts, aliases, value aliases, and concept-column maps
are powerful, but they are too broad for the first Blessing Tree slice.

Blessing Tree should begin with a curated operational vocabulary:

- `child`
- `recipient`
- `sponsor`
- `wishlist item`
- `gift`
- `coat`
- `toy`
- `gift card`
- `needs sponsor`
- `committed`
- `received`
- `wrapped`
- `tagged`
- `distributed`
- `unmatched donated inventory`

If staff usage expands, this can become an admin-managed semantic catalog.

#### Retrieval Policies

QueryForge's policy layer moves prompt behavior out of code. That is useful,
but Blessing Tree should not expose this as an admin surface at first.

Use code-owned policy dictionaries initially:

- gift search synonyms
- report metric aliases
- status phrase aliases
- blocker/readiness phrase aliases

Promote these into database-backed rules only when there is actual operational
need.

#### Feedback Learning

QueryForge's feedback pipeline has the right safety model:

- user feedback creates evidence
- an evaluator proposes structured changes
- a governor decides auto-apply versus review
- overrides are applied instead of directly mutating base metadata
- promotion is audited

Blessing Tree should adopt this later for:

- gift search synonym suggestions
- report question aliases
- common staff query corrections
- donor/gift category mapping corrections

The first version should only capture prompt, parsed result, selected result,
and optional thumbs up/down. It should not auto-mutate search behavior.

#### Conversation Context

QueryForge persists a scoped planner conversation in local storage and handles
expired sessions gracefully. Blessing Tree can reuse this pattern for NL
reporting once follow-up questions are supported.

Gift search should remain stateless in the first release.

## Do Not Reuse Initially

### Full Planner-Domain Service

QueryForge's planner service is built for arbitrary analytical domains and
multiple schema candidates. Blessing Tree has a known operational domain.
Porting the full service would add complexity before the app needs it.

### Arbitrary SQL Compilation

Blessing Tree should not let natural language compile arbitrary SQL.

Reporting should resolve to a fixed report catalog with parameterized executor
functions. This prevents accidental exposure of private recipient, sponsor, or
donor data.

### Full Semantic Admin

The full QueryForge semantic admin surface is not appropriate for this app yet.
Blessing Tree admins need operational settings, not a generic semantic modeling
tool.

## Proposed Blessing Tree Architecture

### Gift Search

Start SQL-first with deterministic parsing.

```text
app/features/gifts/
  api.py
  public_api.py
  search_parser.py
  search_service.py
  search_serializers.py
  search_validation.py
```

The parser returns structured filters:

```json
{
  "age_min": 8,
  "age_max": 12,
  "gender": "FEMALE",
  "categories": ["coat"],
  "sizes": ["youth medium"],
  "terms": ["warm", "winter"],
  "warnings": []
}
```

The search service applies:

- campaign scope
- staff/public visibility
- wishlist status
- reservation/commitment availability
- age/gender/category/size filters
- SQL text search over item names and notes

When Qdrant is enabled, the vector search service should only supply candidate
ids and relevance scores. SQL still owns final filtering and serialization.

### Qdrant Collections

Recommended initial collections:

#### `bt_gift_search_v1`

One point per searchable gift or donated inventory line.

Payload:

```json
{
  "kind": "wishlist_item",
  "campaign_id": 1,
  "wishlist_item_id": 123,
  "recipient_id": 55,
  "visibility": "PUBLIC",
  "gift_status": "OPEN",
  "recipient_kind": "CHILD",
  "program_type": "christmas",
  "gender": "FEMALE",
  "age_min": 8,
  "age_max": 8,
  "item_type": "coat",
  "category": "clothing",
  "public_eligible": true
}
```

Document text should include:

- requested item title
- category and synonyms
- recipient age band, not sensitive identity
- size and color
- priority
- public-safe notes

#### `bt_report_catalog_v1`

One point per allowed report metric or report intent.

Examples:

- children still needing sponsors
- open wishlist items by age band
- committed gifts not received
- gifts due this week
- unmatched donated coats
- sponsors with overdue commitments
- readiness blockers by campaign

Payload:

```json
{
  "kind": "report_metric",
  "metric_key": "children_needing_sponsors",
  "subject": "recipients",
  "allowed_roles": ["ADMIN", "STAFF"],
  "supports_group_by": ["age_band", "gender", "school", "sponsor_status"]
}
```

### Natural-Language Reporting

Use a constrained plan, not arbitrary SQL.

Recommended package:

```text
app/features/nl_reporting/
  api.py
  catalog.py
  parser.py
  planner.py
  schemas.py
  executors.py
  serializers.py
```

Plan shape:

```json
{
  "intent": "count",
  "subject": "recipients",
  "metric": "children_needing_sponsors",
  "filters": {
    "campaign_id": 1,
    "age_min": 6,
    "age_max": 12
  },
  "group_by": ["age_band"],
  "confidence": 0.91,
  "warnings": []
}
```

Allowed intents:

- `count`
- `list`
- `trend`
- `compare`

Allowed subjects:

- `recipients`
- `wishlist_items`
- `sponsors`
- `sponsorships`
- `donations`
- `fulfillment`
- `readiness`

Allowed metrics:

- `children_needing_sponsors`
- `open_wishlist_items`
- `reserved_gifts`
- `committed_gifts`
- `received_gifts`
- `wrapped_gifts`
- `ready_for_distribution_gifts`
- `distributed_gifts`
- `overdue_sponsor_commitments`
- `unmatched_donated_inventory`
- `readiness_blockers`

Executors should be explicit functions keyed by metric. They should use
SQLAlchemy query builders or carefully parameterized SQL.

### Frontend Pattern

Adapt QueryForge's request handling pattern:

- normalized service wrapper around the API
- abortable requests
- typed response normalization
- display parsed filters as chips
- show warnings when the app guessed
- provide retry/error messaging
- keep gift search stateless
- persist NL reporting conversation only when follow-up questions are built

Recommended frontend layout:

```text
blessing-tree-ui/src/features/gifts/
  api/giftSearchApi.ts
  model/giftSearchTypes.ts
  model/giftSearchPresentation.ts
  ui/GiftSearchPage.tsx
  ui/GiftSearchToolbar.tsx
  ui/GiftSearchResults.tsx

blessing-tree-ui/src/features/reports/
  api/nlReportingApi.ts
  model/nlReportingTypes.ts
  ui/NlReportQueryPanel.tsx
```

## Security And Privacy Rules

Natural-language features must follow these rules:

1. Public sponsor search never exposes recipient names, exact addresses,
   contact data, school data, internal notes, or household details.
2. Staff search can include operational context but should still avoid secrets
   in vector document text.
3. Qdrant payloads must only contain fields safe for derived search indexes.
4. Final result authorization must always happen in SQL.
5. NL reporting cannot execute arbitrary SQL.
6. Report plans must be role-checked before execution.
7. Prompt text and feedback logs may contain sensitive user-entered text and
   must be treated as protected operational data.

## Implementation Phases

### Phase A: SQL-First NL Gift Search

Build the deterministic parser and shared search contract from the gift
workflow plan. Do not require Qdrant yet.

Exit criteria:

- staff and public endpoints support structured filters and natural-language
  parsing
- public privacy checks are covered by tests
- parsed filters are visible as chips in the UI

### Phase B: Optional Qdrant Search Index

Add Qdrant behind config.

Tasks:

- add `QDRANT_URL`, `QDRANT_API_KEY`, and `SEMANTIC_SEARCH_ENABLED`
- add embedding service wrapper
- add `bt_gift_search_v1`
- add rebuild command/task
- add search fallback to SQL when Qdrant is unavailable or disabled

Exit criteria:

- vector search improves fuzzy gift discovery
- SQL-only mode still works
- Qdrant index can be rebuilt from MySQL

### Phase C: NL Reporting Catalog

Add fixed report metric catalog and plan schema.

Tasks:

- define metric registry
- define parser/planner contract
- implement deterministic aliases first
- optionally use Qdrant to select likely metrics
- execute only approved metric executors

Exit criteria:

- staff can ask a bounded set of operational questions
- the response explains which metric and filters were used
- unsupported questions fail with useful suggestions

### Phase D: Feedback Capture

Capture feedback without auto-learning.

Tasks:

- store prompt, parsed plan, selected result/action, user feedback, and notes
- expose admin review list
- use manual review to update code-owned aliases initially

Exit criteria:

- staff can flag bad search/report interpretation
- admins can inspect common failure patterns

### Phase E: Governed Learning

Adapt QueryForge's feedback-governor pattern if feedback volume justifies it.

Tasks:

- add candidate proposal tables
- add governor decisions
- add override layer
- add audit trail
- only auto-apply low-risk repeated alias changes

Exit criteria:

- common low-risk aliases can be learned safely
- high-risk changes require admin review

## Concrete Next Step

Begin Phase A from the gift workflow plan:

1. Create `app/features/gifts/search_parser.py`.
2. Create staff and public gift search contracts.
3. Add deterministic parser tests for age, gender, category, size, and cost.
4. Build the shared frontend search API wrapper and filter-chip UI.

Qdrant should be prepared as a Phase B architecture decision, not a blocker for
the first functional gift search screen.
