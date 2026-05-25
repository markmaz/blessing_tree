# Admin-Managed Milestones And Readiness Implementation Plan

Last updated: 2026-05-23

## Status

- In progress on `feature/sponsor-workspace`
- Phases 1-3 are implemented in the backend
- Phase 4 is implemented: Campaign Studio milestone save validation, frontend milestone dropdowns, and Campaign Studio AI draft/normalizer paths now use database-backed milestone definitions as the runtime source
- Phase 5 admin UI is implemented and polished: Admin -> Campaign Operations can list/search/create/update milestone definitions and missing-milestone readiness rules, show rule references from milestone definitions, preview rule impact, and require explicit confirmation before deactivating active system definitions/rules

This plan follows:

- `docs/engineering/admin-milestone-readiness-design.md`

## Objective

Replace hardcoded campaign milestone and milestone-readiness policy with admin-managed definitions while preserving the current Campaign Studio readiness response shape.

The first useful outcome is:

- app admins can define available milestone types
- app admins can define whether a missing milestone creates a readiness blocker, warning, or info item
- sponsor public signup readiness blockers are database-seeded instead of hardcoded
- Campaign Studio continues to show readiness findings without frontend-specific logic

## Delivery Strategy

Do this in stages.

The current codebase has a working readiness pipeline. Do not rewrite it wholesale.

Use this sequence:

1. add database-backed definitions
2. seed current hardcoded behavior
3. read definitions in backend services
4. preserve current API response contracts
5. add admin UI for managing definitions
6. gradually retire hardcoded constants

## Phase 1: Data Model And Seed Migration

### Goal

Create the global definition tables and seed them with the current hardcoded milestone and readiness behavior.

### Backend Tasks

1. Add `campaign_milestone_definition` model.

   Fields:

   - `id`
   - `milestone_key`
   - `label`
   - `description`
   - `feature_area`
   - `default_sort_order`
   - `is_active`
   - `is_system`
   - `created_at`
   - `updated_at`

2. Add `campaign_readiness_rule_definition` model.

   Fields:

   - `id`
   - `rule_key`
   - `name`
   - `description`
   - `rule_type`
   - `feature_area`
   - `condition_type`
   - `condition_config_json`
   - `milestone_key`
   - `severity`
   - `category`
   - `blocking_for_json`
   - `section`
   - `action_label`
   - `message`
   - `is_active`
   - `is_system`
   - `created_at`
   - `updated_at`

3. Add migration.

   Seed milestone definitions for current keys:

   - `registration_open`
   - `registration_close`
   - `sponsor_registration_start`
   - `sponsor_registration_end`
   - `sponsor_outreach_start`
   - `gift_intake_start`
   - `gift_intake_end`
   - `pickup_start`
   - `pickup_end`
   - `campaign_close`

4. Seed initial readiness rules.

   Sponsor public signup blockers:

   - `missing_public_sponsor_registration_start`
   - `missing_public_sponsor_registration_end`
   - `missing_public_sponsor_gift_turn_in`

   General milestone warnings:

   - create one missing-milestone rule per current required milestone, or keep the existing grouped `missing_milestones` code until Phase 3

5. Add indexes and uniqueness constraints.

   Recommended constraints:

   - unique `campaign_milestone_definition.milestone_key`
   - unique `campaign_readiness_rule_definition.rule_key`
   - index readiness rules by `is_active`, `rule_type`, `milestone_key`

### Tests

- migration creates both tables
- seeded milestone definitions exist
- seeded sponsor readiness rules exist
- unique keys are enforced

### Deliverables

- migration
- ORM models
- model exports
- seed verification tests

## Phase 2: Backend Services And Admin APIs

### Goal

Expose admin APIs for milestone definitions and readiness rules.

### Backend Tasks

1. Add `app/features/campaign_operations/` or equivalent feature package.

2. Add service methods for milestone definitions:

   - list definitions
   - create definition
   - update definition
   - deactivate definition

3. Add service methods for readiness rule definitions:

   - list rules
   - create rule
   - update rule
   - deactivate rule

4. Add validation helpers.

   Milestone definition validation:

   - key format
   - label required
   - feature area allowed
   - default sort order numeric

   Readiness rule validation:

   - rule key format
   - supported rule type
   - supported condition type
   - condition config allowlist
   - active milestone key exists
   - severity/category/phase values allowed
   - section value allowed

5. Add admin endpoints:

   - `GET /api/v1/admin/campaign-operations/milestone-definitions`
   - `POST /api/v1/admin/campaign-operations/milestone-definitions`
   - `PATCH /api/v1/admin/campaign-operations/milestone-definitions/<id>`
   - `GET /api/v1/admin/campaign-operations/readiness-rules`
   - `POST /api/v1/admin/campaign-operations/readiness-rules`
   - `PATCH /api/v1/admin/campaign-operations/readiness-rules/<id>`
   - `GET /api/v1/admin/campaign-operations/readiness-rule-options`

6. Apply app-admin authorization.

   Only app admins should be able to mutate global definitions.

### Tests

- app admin can list/create/update milestone definitions
- non-admin cannot mutate definitions
- duplicate milestone key returns `409`
- invalid key returns `400`
- app admin can list/create/update readiness rules
- invalid condition config returns `400`
- rule cannot reference inactive or unknown milestone key

### Deliverables

- backend feature package
- admin API endpoints
- serializers
- validation
- tests

## Phase 3: Dynamic Readiness Evaluation

### Goal

Make Campaign Readiness evaluate database-defined missing-milestone rules.

### Backend Tasks

1. Add a readiness definition repository/service.

   It should load:

   - active milestone definitions
   - active readiness rules

2. Add a constrained condition evaluator.

   Initial supported conditions:

   - `ALWAYS`
   - `CAMPAIGN_FIELD_TRUE`
   - `CAMPAIGN_STATUS_IS`
   - `FEATURE_ENABLED`

3. Implement `MISSING_MILESTONE` evaluator.

   It should:

   - check whether rule condition applies
   - check campaign milestone presence by `milestone_key`
   - emit a readiness item using rule metadata when missing
   - emit nothing when present or condition does not apply

4. Wire dynamic rules into `build_campaign_readiness`.

   Preserve the current response shape:

   - `items`
   - `groups`
   - `counts`
   - `phase_status`
   - `overall_status`

5. Keep hardcoded non-milestone rules in code.

   Examples:

   - missing manager
   - missing templates
   - automation worker unavailable

6. Replace hardcoded sponsor public signup milestone blockers with seeded dynamic rules.

7. Decide whether to replace general `missing_milestones` warning with individual dynamic rules in this phase.

   Recommendation:

   - replace it now, because the UI visibility problem is the same as sponsor readiness

### Tests

- dynamic rule emits blocker when condition true and milestone missing
- dynamic rule does not emit when milestone exists
- dynamic rule does not emit when condition false
- public sponsor signup enabled emits three seeded blockers when all three milestones are missing
- public sponsor signup disabled emits none of those three blockers
- existing readiness response grouping still works

### Deliverables

- dynamic readiness evaluator
- service integration
- backend tests
- old hardcoded sponsor milestone blocker removed

## Phase 4: Campaign Milestone Validation Uses Definitions

### Goal

Allow campaign milestone options to come from the database rather than the hardcoded `MILESTONE_DEFINITIONS` map.

### Backend Tasks

1. Update milestone validation to load active milestone definitions.

2. Preserve compatibility for existing rows whose definitions are now inactive.

   Recommended behavior:

   - existing inactive definitions can remain visible on campaigns that already use them
   - new campaign milestone saves cannot add inactive definitions

3. Update Campaign Studio milestone listing to include database-derived labels and sort order.

4. Update AI draft and normalizer paths that currently use hardcoded milestone definitions.

   They should use a milestone catalog loaded from the definition service.

5. Keep a small code fallback for startup/migration safety until seeded definitions are guaranteed.

### Tests

- campaign milestone save accepts active definition
- campaign milestone save rejects unknown definition
- campaign milestone save rejects inactive new definition
- existing inactive campaign milestone can still be listed
- AI action normalizer recognizes database-defined milestone labels

### Deliverables

- database-backed milestone catalog service
- updated validation paths
- updated AI context/normalizer paths
- tests

## Phase 5: Admin UI

### Goal

Give app admins a usable interface for milestone definitions and readiness rules.

### Frontend Tasks

1. Add admin route.

   Recommended path:

   - `/admin/campaign-operations`

2. Add admin navigation item.

   Label:

   - `Campaign Operations`

3. Build API client.

   Recommended files:

   - `src/features/admin/api/campaignOperationsApi.ts`
   - `src/features/admin/model/campaignOperationsTypes.ts`

4. Build `Milestone Definitions` tab.

   Required capabilities:

   - list definitions
   - create definition
   - edit definition
   - activate/deactivate definition
   - show system status

5. Build `Readiness Rules` tab.

   Required capabilities:

   - list rules
   - create missing-milestone rule
   - edit rule metadata
   - activate/deactivate rule
   - choose condition from constrained options
   - choose blocking phases

6. Add form UX safeguards.

   - disable `milestone_key` edit after creation or once referenced
   - show which rules reference a milestone
   - confirm deactivate actions
   - explain that campaign managers still set actual dates in Campaign Studio

### Tests

- admin route renders
- milestone table renders seeded data
- create/edit milestone form submits expected payload
- readiness rule table renders seeded data
- create/edit rule form submits expected payload
- non-admin behavior follows existing admin access patterns

### Deliverables

- admin page
- API client
- tests

## Phase 6: Cleanup And Documentation

### Goal

Remove stale hardcoded milestone policy and document the new operational configuration model.

### Tasks

1. Update `campaign-readiness-design.md`.

   Add link to the admin-managed milestone readiness design.

2. Update `campaign-schedule-design.md`.

   Note that milestone definitions are admin-managed while campaign dates remain campaign-managed.

3. Update any README or admin docs.

4. Remove or narrow hardcoded constants:

   - `MILESTONE_DEFINITIONS`
   - `REQUIRED_MILESTONE_KEYS`
   - `PUBLIC_SPONSOR_REQUIRED_MILESTONE_KEYS`

   These may remain as seed defaults or migration constants, but should not be the primary runtime source.

5. Add operational runbook notes:

   - how to add a milestone definition
   - how to add a missing-milestone readiness rule
   - how to disable a readiness rule safely

### Tests

- full backend test suite
- full frontend test suite
- smoke test Campaign Studio readiness with public sponsor signup enabled

### Deliverables

- updated docs
- cleaned hardcoded runtime policy
- regression test coverage

## Suggested Initial Admin Seed Values

### Sponsor Public Signup Rules

1. Missing sponsor registration start

   - `rule_key`: `missing_public_sponsor_registration_start`
   - `rule_type`: `MISSING_MILESTONE`
   - `milestone_key`: `sponsor_registration_start`
   - `condition_type`: `CAMPAIGN_FIELD_TRUE`
   - `condition_config_json`: `{"field": "public_sponsor_signup_enabled"}`
   - `severity`: `error`
   - `category`: `blockers`
   - `blocking_for_json`: `["activate", "operations"]`
   - `section`: `schedule`
   - `action_label`: `Open Schedule`
   - `message`: `Public sponsor signup is enabled, but the sponsor registration start milestone is missing.`

2. Missing sponsor registration end

   - `rule_key`: `missing_public_sponsor_registration_end`
   - `rule_type`: `MISSING_MILESTONE`
   - `milestone_key`: `sponsor_registration_end`
   - same condition/severity/category/blocking/section/action pattern
   - `message`: `Public sponsor signup is enabled, but the sponsor registration end milestone is missing.`

3. Missing gift turn-in deadline

   - `rule_key`: `missing_public_sponsor_gift_turn_in`
   - `rule_type`: `MISSING_MILESTONE`
   - `milestone_key`: `gift_intake_end`
   - same condition/severity/category/blocking/section/action pattern
   - `message`: `Public sponsor signup is enabled, but the gift turn-in deadline milestone is missing.`

## Rollout Notes

- This can ship incrementally with hardcoded fallback behavior.
- The admin UI should not be released before backend validation is strict enough to prevent unusable rules.
- Dynamic rules should be read-only in production until seed parity is verified.
- Rule edits should take effect immediately because readiness is computed on request.
- If caching is later added, admin writes must invalidate readiness definition caches.

## Risks

### Too Much Rule Flexibility

Arbitrary rule expressions would create support and security risk.

Mitigation:

- only support constrained condition types in v1
- use allowlisted campaign fields

### Breaking Existing Campaign Milestones

Existing campaigns may have milestone keys before definitions are seeded.

Mitigation:

- seed all current keys before switching validation
- allow listing existing inactive definitions

### Admin Misconfiguration

Admins could disable important rules.

Mitigation:

- mark seeded rules as system rules
- require confirmation to deactivate system rules
- show operational impact in the admin UI

### AI Draft Breakage

AI schedule and readiness drafts currently depend on hardcoded milestone definitions.

Mitigation:

- migrate AI context generation to use the same milestone definition service
- keep a code fallback until test coverage confirms parity
