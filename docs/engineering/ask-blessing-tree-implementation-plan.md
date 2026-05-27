# Ask Blessing Tree Implementation Plan

Last updated: 2026-05-26

## Status

- Proposed.
- Builds on `docs/engineering/queryforge-reuse-plan.md`.
- Completes the remaining natural-language reporting foundation.

## Objective

Create a simple, campaign-scoped assistant page where staff can ask:

- how to use the app
- where to find a screen or workflow
- operational questions about campaign data

The first implementation should be safe, predictable, and useful for
non-technical staff. It should not expose arbitrary SQL generation or a generic
chatbot that can drift away from Blessing Tree workflows.

## Product Direction

Add a protected navigation item named **Ask Blessing Tree**.

Recommended route:

```text
/campaigns/:campaignId/ask
```

Recommended nav placement:

- top-level campaign workspace item, near Dashboard or Reports
- visible to users with `campaign.view`
- report execution limited by `campaign.reports.view`

The page should have one primary input:

```text
Ask about this campaign or how to use Blessing Tree...
```

Example prompts:

- How do I add a sponsor?
- Where is the Gift Status report?
- How many recipients still need sponsors?
- Show gifts committed but not received.
- Which sponsors need follow-up?
- Show recipients with no sponsored gifts.

## User Experience

### Page Layout

The first screen should be a practical work surface, not a marketing-style AI
page.

Recommended layout:

- header with selected campaign context
- single prompt composer
- suggested prompt buttons
- result panel
- recent questions for the current browser session

### Result Types

The assistant should return one of four result types.

#### `app_help`

Used for questions like:

- How do I add a sponsor?
- Where do I print gift tags?
- How do I change a gift to distributed?

Response shape:

- short answer
- ordered steps when needed
- direct navigation actions
- optional related help topics

Example:

```text
To add a sponsor, open Sponsor Intake and choose Add Sponsor.
```

Actions:

- Open Sponsor Intake
- Open Sponsor Directory

#### `report_result`

Used for campaign data questions like:

- How many recipients still need sponsors?
- Show committed gifts not received.
- Which sponsors have no commitments?

Response shape:

- summary sentence
- metric card or count
- optional table rows
- filter chips
- "How this was calculated" disclosure
- export action later

#### `navigation_result`

Used when the best answer is to open a screen.

Examples:

- Where is the Gift Status report?
- Take me to gift operations.

Response shape:

- short explanation
- primary open-screen action
- alternate matching screens if relevant

#### `clarification`

Used when the request is too broad or ambiguous.

Response shape:

- plain-language reason
- 2 to 4 suggested follow-up prompts
- no technical error language

## Architecture

Use a constrained resolver pipeline.

```text
prompt
  -> normalize text
  -> classify intent
  -> resolve app help, navigation, or report plan
  -> authorize requested action
  -> execute fixed handler
  -> serialize structured response
```

Do not generate raw SQL from natural language.

Use deterministic matching for routing and authorization, but allow the
configured admin LLM to assist with NER when it is enabled. The LLM may extract
structured entities and suggest a catalog key. It must not execute queries,
write SQL, choose unauthorized data, or bypass catalog validation.

The first implementation should still work without an LLM. If the configured
LLM is missing, disabled, unavailable, or returns invalid JSON, the service
falls back to deterministic parsing.

## Backend Package

Add:

```text
blessing-tree-api/app/features/ask/
  __init__.py
  api.py
  classifier.py
  entity_extractor.py
  help_catalog.py
  llm_entity_extractor.py
  navigation_catalog.py
  report_catalog.py
  report_executors.py
  schemas.py
  serializers.py
  service.py
```

The LLM path should reuse the existing admin LLM configuration and runtime
service from `app/features/admin/llm_runtime_service.py`.

### API

Add one protected endpoint:

```text
POST /api/v1/campaigns/<campaign_id>/ask
```

Required capability:

```text
campaign.view
```

The service must apply additional capability checks after classification:

- `app_help`: `campaign.view`
- `navigation_result`: capability required by target route
- `report_result`: `campaign.reports.view`

Request:

```json
{
  "prompt": "show gifts committed but not received",
  "conversation_id": null,
  "include_debug": false
}
```

Response:

```json
{
  "kind": "report_result",
  "answer": "There are 14 committed gifts that have not been received.",
  "confidence": 0.91,
  "actions": [
    {
      "label": "Open Gift Status",
      "route": "/campaigns/123/gifts/reports"
    }
  ],
  "report": {
    "metric_key": "committed_gifts_not_received",
    "summary": {
      "label": "Committed gifts not received",
      "value": 14
    },
    "columns": [
      { "key": "recipient_name", "label": "Recipient" },
      { "key": "gift", "label": "Gift" },
      { "key": "sponsor_name", "label": "Sponsor" },
      { "key": "status", "label": "Status" }
    ],
    "rows": []
  },
  "interpreted_as": {
    "intent": "list",
    "subject": "wishlist_items",
    "filters": {
      "status": "COMMITTED"
    }
  },
  "warnings": []
}
```

### Response Schema

Use a discriminated response object:

```text
AskResponse
  kind: app_help | navigation_result | report_result | clarification | error
  answer: string
  confidence: number
  actions: AskAction[]
  interpreted_as: AskInterpretation | null
  warnings: string[]
```

Report-specific payload:

```text
AskReportResult
  metric_key: string
  summary: AskReportSummary
  columns: AskReportColumn[]
  rows: list[dict]
  totals: dict | null
```

Action payload:

```text
AskAction
  type: route | prompt | external
  label: string
  route: string | null
  prompt: string | null
  required_capability: string | null
```

## Intent Classification

Start deterministic.

Recommended classifier order:

1. exact help phrase match
2. route/navigation phrase match
3. report metric alias match
4. keyword scoring across all catalogs
5. clarification with suggested prompts

The classifier should return:

```text
classification.kind
classification.key
classification.confidence
classification.alternates
classification.warnings
```

Confidence behavior:

- `>= 0.80`: execute
- `0.55` to `0.79`: execute if the result is low-risk help/navigation, but
  include "I interpreted this as..."
- `< 0.55`: ask for clarification

For report queries, avoid running a report below `0.80` unless there is only
one clear candidate.

## Entity Extraction And NER

LLM-assisted NER is useful here because staff will ask questions in natural,
messy language:

- "show girls 8 to 12 who still need sponsors"
- "which coats have not been picked up yet"
- "who did we commit gifts to but never received"
- "where do I print the tag for a kid's present"

Use a two-layer extraction model.

### Deterministic Extractor

The deterministic extractor should always run first.

It extracts obvious structured entities:

- intent words: `count`, `list`, `show`, `where`, `how`
- age ranges
- gender phrases
- gift status phrases
- gift category words
- date phrases
- route/help keywords
- known report metric aliases

### LLM NER Extractor

When enabled, the LLM receives:

- the user prompt
- selected campaign context with non-sensitive campaign name/year only
- allowed result kinds
- allowed help keys
- allowed navigation keys
- allowed report metric keys
- allowed filters and enum values

The LLM must return strict JSON only.

Expected shape:

```json
{
  "kind": "report_result",
  "catalog_key": "recipients_needing_sponsors",
  "intent": "list",
  "entities": {
    "age_min": 8,
    "age_max": 12,
    "gender": "FEMALE"
  },
  "confidence": 0.86,
  "reason": "The prompt asks for girls ages 8 to 12 who still need sponsors."
}
```

Allowed LLM fields:

- `kind`
- `catalog_key`
- `intent`
- `entities`
- `confidence`
- `reason`

Rejected LLM output:

- SQL
- table names
- column names not in the allowed filter schema
- route paths not in the navigation catalog
- report keys not in the report catalog
- free-form tool/action instructions
- contact data or sensitive values inferred from the prompt

### NER Merge Rules

The service merges deterministic and LLM extraction conservatively:

1. deterministic exact matches win over LLM suggestions
2. LLM can fill missing entities
3. LLM can suggest a catalog key only if it exists in the catalog
4. LLM confidence below `0.70` becomes a clarification unless deterministic
   matching is strong enough
5. conflicting entities produce a warning or clarification
6. report execution still requires capability checks and catalog validation

Example conflict:

```text
Prompt: show boys ages 8 to 10 girls
```

The response should ask for clarification instead of guessing.

## Help Catalog

The help catalog should be code-owned for the first phase.

Entry shape:

```python
{
    "key": "add_sponsor",
    "title": "Add a sponsor",
    "phrases": [
        "add sponsor",
        "new sponsor",
        "enter sponsor",
        "create sponsor"
    ],
    "answer": "Open Sponsor Intake, then choose Add Sponsor.",
    "steps": [
        "Open Sponsors.",
        "Choose Sponsor Intake.",
        "Choose Add Sponsor."
    ],
    "actions": [
        {
            "label": "Open Sponsor Intake",
            "route_name": "campaign_sponsors_intake",
            "required_capability": "campaign.sponsors.manage"
        }
    ]
}
```

Initial help topics:

- add sponsor
- edit sponsor
- call sponsor or record interaction
- open sponsor reports
- add recipient
- edit wishlist
- find people still needing gifts
- search gifts
- commit gift to sponsor
- receive gift
- wrap gift
- mark gift ready
- mark gift distributed
- print gift tag
- scan gift tag
- open gift status report
- create campaign
- edit campaign purpose/theme
- update gift policy
- send test email
- invite app user
- manage campaign access

## Navigation Catalog

Navigation entries should resolve to route builders, not hardcoded full URLs.

Entry shape:

```python
{
    "key": "gift_status",
    "title": "Gift Status",
    "phrases": [
        "gift status",
        "gift report",
        "status report",
        "visual gift report"
    ],
    "route_name": "campaign_gifts_reports",
    "required_capability": "campaign.reports.view"
}
```

Initial navigation targets:

- dashboard
- campaign studio
- people intake
- people directory
- people reports
- sponsor intake
- sponsor directory
- sponsor reports
- gift search
- gift operations
- gift pool
- gift status
- sponsor flyer
- account profile
- account settings
- user management
- campaign operations
- LLM settings

## Report Catalog

The report catalog maps natural-language requests to fixed executors.

Entry shape:

```python
{
    "metric_key": "recipients_needing_sponsors",
    "title": "Recipients Needing Sponsors",
    "subject": "recipients",
    "intents": ["count", "list"],
    "phrases": [
        "recipients still need sponsors",
        "children still need sponsors",
        "people without sponsors",
        "not sponsored"
    ],
    "allowed_filters": ["age_min", "age_max", "gender", "group_id"],
    "required_capability": "campaign.reports.view",
    "executor": "execute_recipients_needing_sponsors"
}
```

### MVP Metrics

Implement these first:

1. `recipients_needing_sponsors`
   - count and list recipients whose sponsorship coverage policy is not met

2. `recipients_needing_gifts`
   - count and list recipients whose gift coverage policy is not met

3. `open_wishlist_items`
   - count and list wishlist items available for sponsorship

4. `committed_gifts_not_received`
   - count and list committed wishlist items not yet received

5. `received_gifts_not_wrapped`
   - count and list gifts in received state not yet wrapped

6. `ready_gifts_not_distributed`
   - count and list ready gifts not distributed

7. `sponsors_needing_follow_up`
   - count and list sponsors based on existing sponsor follow-up logic

8. `sponsors_without_commitments`
   - count and list active sponsors with no committed wishlist items

9. `unmatched_donated_inventory`
   - count and list donation lines with remaining unmatched quantity

10. `readiness_blockers`
    - count and list current readiness blockers

### Supported Filters

MVP filters should be limited to fields already common in the app:

- age range
- gender
- recipient group
- sponsor status
- gift status
- gift category
- due date range
- priority

Date phrases should support:

- today
- tomorrow
- this week
- next week
- overdue

## Report Executors

Each report metric gets one explicit executor function.

Rules:

- executor functions must accept `db`, `campaign_id`, `filters`, and `limit`
- executor functions must enforce campaign scope
- no raw user SQL
- no unbounded result sets
- default row limit: 100
- include total count separately when rows are limited

Executor return shape:

```python
{
    "summary": {
        "label": "Recipients needing sponsors",
        "value": 22
    },
    "columns": [
        {"key": "recipient_name", "label": "Recipient"},
        {"key": "age", "label": "Age"},
        {"key": "gender", "label": "Gender"},
        {"key": "group_name", "label": "Group"}
    ],
    "rows": [],
    "totals": {
        "row_count": 22,
        "limited": False
    }
}
```

## Natural-Language Parsing

Use a small parser for filters and intent.

Intent phrases:

- `how many`, `count`, `number of` -> `count`
- `show`, `list`, `who`, `which` -> `list`
- `break down by`, `group by` -> future `group`

Filter examples:

- `girls age 8 to 12`
- `boys under 10`
- `coats`
- `overdue`
- `ready but not distributed`
- `committed but not received`

The parser should return both raw and normalized values:

```json
{
  "intent": "list",
  "filters": {
    "gender": "FEMALE",
    "age_min": 8,
    "age_max": 12
  },
  "filter_chips": [
    "Girls",
    "Age 8-12"
  ]
}
```

## LLM Use

LLM use should be included as an optional NER/planning assist in the MVP if the
admin LLM is already configured and enabled. It should not be required for
local development, tests, or production availability.

The LLM may only produce a constrained extraction plan:

```text
kind
metric_key
catalog_key
intent
filters
```

The backend must validate the LLM plan against the report catalog before
execution.

Rejected plans should fall back to deterministic parsing or return
clarification/suggestions.

## Optional Qdrant Use

Do not require Qdrant for the first implementation.

Qdrant can be added later for:

- fuzzy help topic matching
- fuzzy report metric matching
- semantic matching of app terminology

Even with Qdrant, final report execution must use SQL and RBAC checks.

## Frontend Structure

Add:

```text
blessing-tree-ui/src/features/ask/
  api/askApi.ts
  model/askTypes.ts
  model/askPresentation.ts
  ui/AskComposer.tsx
  ui/AskResultPanel.tsx
  ui/AskReportResult.tsx
  ui/AskHelpResult.tsx
  ui/AskSuggestedPrompts.tsx
  ui/ask.css
```

Add page:

```text
blessing-tree-ui/src/pages/AskBlessingTreePage.tsx
```

Add route constants:

```ts
CAMPAIGN_ASK: '/campaigns/:campaignId/ask'
buildCampaignAskPath(campaignId: string): string
```

### Frontend Behavior

- use selected campaign context
- abort in-flight request when a new prompt is submitted
- show loading state in result panel
- preserve recent prompts in component state or session storage
- render route actions as buttons
- hide or disable actions when missing capabilities
- show report filter chips and warnings
- show a concise "interpreted as" line for report results

### Visual Direction

This should feel like an operational command center, not a novelty chatbot.

Recommended UI:

- compact prompt surface
- suggested prompt chips
- result cards with clear counts and tables
- direct action buttons
- restrained Blessing Tree branding
- no chat bubble-heavy layout in the first version

## Permissions

Backend permission rules:

| Result type | Required capability |
| --- | --- |
| `app_help` | `campaign.view` |
| `navigation_result` | target route capability |
| `report_result` | `campaign.reports.view` |

Report executors may require stronger capabilities later if they expose
sensitive operational details.

Examples:

- sponsor contact reports may require `campaign.sponsors.view`
- recipient reports may require `campaign.recipients.view`
- gift operations reports may require `campaign.reports.view` plus gift
  workflow capabilities if status actions are added

Frontend gating:

- show Ask Blessing Tree to users with `campaign.view`
- allow help queries for all campaign users
- show report suggested prompts only when `campaign.reports.view` is present
- hide navigation actions the user cannot open

## Audit And Privacy

MVP should not store prompt history in the database unless needed.

If prompt logging is added:

- store campaign id
- store user id
- store prompt
- store resolved kind and key
- store confidence
- store created timestamp
- do not store report result rows

Prompt logs may contain sensitive operational text and must be treated as
protected app data.

## Tests

### Backend Tests

Add tests for:

- help prompt resolves to `app_help`
- navigation prompt resolves to `navigation_result`
- report prompt resolves to expected metric
- ambiguous prompt returns `clarification`
- report query requires `campaign.reports.view`
- route actions are filtered by capability
- report executors enforce campaign id
- report executors respect row limits
- age/gender/status/date parser cases

### Frontend Tests

Add tests for:

- page renders with suggested prompts
- submitting a help prompt renders answer and action
- submitting a report prompt renders summary and table
- missing report capability hides report suggestions
- action buttons use expected routes
- request errors render friendly retry state

## Implementation Phases

### Phase 1: Catalog And API Foundation

Backend:

1. Create `app/features/ask`.
2. Add request and response schemas.
3. Add help catalog.
4. Add navigation catalog.
5. Add deterministic classifier.
6. Add deterministic entity extractor.
7. Add optional LLM NER extractor using the configured admin LLM runtime.
8. Add safe merge/validation rules for deterministic and LLM output.
9. Add `POST /api/v1/campaigns/<campaign_id>/ask`.
10. Register route.
11. Add backend tests for help, navigation, LLM fallback, invalid LLM output,
    and clarification.

Frontend:

1. Add route constant and nav item.
2. Add `AskBlessingTreePage`.
3. Add API wrapper and typed response model.
4. Render help/navigation results.
5. Add frontend tests.

Exit criteria:

- staff can ask how to perform common app tasks
- staff can jump directly to relevant screens
- unsupported prompts return useful suggestions

### Phase 2: Report Catalog And First Executors

Backend:

1. Add report catalog.
2. Add filter and intent parser.
3. Add report plan validation.
4. Implement MVP report executors:
   - `recipients_needing_sponsors`
   - `recipients_needing_gifts`
   - `committed_gifts_not_received`
   - `ready_gifts_not_distributed`
   - `readiness_blockers`
5. Add capability checks for report execution.
6. Add tests for each executor.

Frontend:

1. Render `report_result`.
2. Add count cards, tables, filter chips, and warnings.
3. Add suggested report prompts.
4. Add empty-result states.

Exit criteria:

- staff can ask bounded campaign reporting questions
- the response explains which report was run
- report results are campaign-scoped and permission-checked

### Phase 3: Expanded Operational Reports

Backend:

1. Add remaining MVP executors:
   - `open_wishlist_items`
   - `received_gifts_not_wrapped`
   - `sponsors_needing_follow_up`
   - `sponsors_without_commitments`
   - `unmatched_donated_inventory`
2. Add CSV export endpoint if needed.
3. Add more parser aliases from real user prompts.

Frontend:

1. Add export action if backend export is built.
2. Add richer table formatting for sponsor, recipient, and gift rows.
3. Add recent prompt history.

Exit criteria:

- Ask Blessing Tree covers the highest-value campaign operations questions
- users can move from answers to operational screens quickly

### Phase 4: Optional Semantic Matching And Feedback

Only start this phase after staff use the deterministic version.

Tasks:

1. Add optional Qdrant-backed fuzzy matching for help and report catalogs.
2. Add optional prompt feedback:
   - thumbs up
   - thumbs down
   - "not what I meant"
3. Add admin review for failed or low-confidence prompts.
4. Promote repeated failures into code-owned aliases.

Exit criteria:

- failed prompts create actionable improvement data
- matching improves without allowing arbitrary SQL or unreviewed behavior

## Rollout Plan

1. Ship Phase 1 behind normal campaign access.
2. Validate help/navigation language with real staff phrasing.
3. Ship Phase 2 report queries.
4. Watch unsupported prompts and add aliases.
5. Use LLM NER when configured, with deterministic fallback always available.
6. Defer Qdrant until deterministic and LLM-assisted matching show clear gaps.

## Open Decisions

Recommended defaults:

- name: **Ask Blessing Tree**
- route: `/campaigns/:campaignId/ask`
- nav icon: `bi-stars`
- first release: deterministic plus optional LLM NER
- database prompt logging: off
- report row limit: 100

Decisions to revisit after MVP:

- whether to add CSV export from Ask results
- whether to store prompt history server-side
- whether to enable Qdrant for fuzzy catalog matching
- whether to add broader LLM-based plan suggestions behind strict validation
