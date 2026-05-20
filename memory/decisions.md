# Decisions

## Ignore `files/`

- Status: active
- Decision: `files/` is out of scope for active project work.
- Rationale: user explicitly said it can be ignored completely.
- Consequence: do not plan roadmap or implementation work around those artifacts unless the user reintroduces them.

## Canonical Documentation Set

- Status: active
- Decision: keep a small canonical doc set and replace stale UI delivery docs with redirect stubs.
- Rationale: the earlier docs were duplicated and no longer reflected the real codebase.
- Consequence: update root/backend/frontend READMEs and roadmap instead of reviving the old summary files.

## Split Memory System

- Status: active
- Decision: Blessing Tree now follows the same split-memory pattern used in `../query_forge`.
- Rationale: durable guidance and operational memory should not live in one growing file.
- Consequence: keep `memory.md` as the index and use `docs/engineering/` plus `memory/` for future updates.

## Auth Description Policy

- Status: active
- Decision: keep local login as a direct one-step flow unless a real second-factor requirement is introduced.
- Rationale: the fake OTP bridge has been removed and the backend still does not expose a real OTP verification API.
- Consequence: future docs and planning should treat second-factor auth as a separate future feature, not as current behavior.

## Query Forge Reuse Policy

- Status: active
- Decision: reuse Query Forge patterns selectively for backend auth, setup, and configuration, but do not copy unrelated runtime features wholesale.
- Rationale: the two projects share the same Flask/JWT/refresh-cookie/Valkey setup shape, while Query Forge also carries broader product concerns that Blessing Tree does not need.
- Consequence: prefer Query Forge-style env naming, bootstrap conventions, and cookie/auth handling where they fit, while keeping Blessing Tree's config surface intentionally smaller.

## RBAC Strategy

- Status: active
- Decision: use minimal global app roles, campaign-scoped role assignments, and code-defined capability bundles instead of a fully dynamic RBAC framework.
- Rationale: Blessing Tree needs feature-level authorization soon, but the likely operational roles are stable enough that dynamic permission administration would add more complexity than value right now.
- Consequence: implement campaign RBAC and explicit capability checks now; defer admin-defined custom roles and database-managed permission graphs until there is real product pressure for them.

## App Role Compatibility

- Status: active
- Decision: keep `app_user.role` in its legacy enum for now, but normalize it at runtime into app-level semantics where `ADMIN -> APP_ADMIN` and non-admin legacy values resolve to `APP_USER`.
- Rationale: the existing schema and auth flow already depend on the legacy role field, but RBAC needs cleaner global-role meaning immediately without blocking on a data migration.
- Consequence: authorization code should treat `app_user.role` as a compatibility source until a later schema migration narrows the stored values to app-level roles only.

## Campaign Product Direction

- Status: active
- Decision: treat campaign as the primary operating container, allow multiple campaigns per year, use one selected active campaign in the UI, add `description` in the immediate schema work, default to archival rather than delete, include sponsorship-item and fulfillment counts in v1 summary, support AI-assisted campaign draft creation, keep AI drafts transient by default, and design a Campaign Studio surface inspired by Query Forge Workflow Studio's rail/work-area/inspector interaction model.
- Rationale: the existing data model is already campaign-centered, operational users will likely move across multiple campaigns, and the app needs a structured control surface that is richer than plain CRUD forms.
- Consequence: campaign APIs should be path-scoped and capability-aware, the next campaign migration batch should include `description`, summary endpoints should expose the broader operational counts, campaign creation should support both structured input and prompt-driven draft generation, AI drafts should not require backend persistence before save, and the frontend should evolve toward a studio-style campaign surface rather than only list/detail forms.

## Campaign Studio V1 Direction

- Status: active
- Decision: make Campaign Studio a card-based campaign composition surface at `/campaigns/:campaignId/studio`, with left-rail section navigation, a visible center work surface, and a persistent AI builder rail. Treat team, communications, milestone dates, and readiness as first-class campaign-building cards. Use global mail templates with campaign bindings, fixed named milestone fields in v1, role-assignment-based volunteer management first, and AI suggestions that require human approval before apply.
- Rationale: the project needs a visible “build the campaign” cockpit rather than another settings form, and the Query Forge Workflow Studio interaction model is a strong reference for keeping overview, detail, and AI assistance in one operator-facing workspace.
- Consequence: the next frontend step should be the Campaign Studio shell and overview cards, while the next backend steps should add campaign assignment, communication template binding, schedule, milestone, and readiness APIs to support that shell.

## Campaign Schedule Direction

- Status: active
- Decision: replace the current Studio `Dates` section with a first-class `Schedule` section, add a real `campaign_event` backend model, and make the calendar the primary planning surface. Milestones, communications, and manual campaign events should all appear on that calendar, and a shared modal should create/edit/delete them directly from the grid. The Studio AI rail should be able to draft and apply new schedule events, milestones, and communications from prompts.
- Rationale: campaign managers need the schedule to behave more like a real calendar than a collection of alternate views, and the old `Timeline | Calendar | Milestones` split still made the calendar feel secondary. Prompt-driven add flows are also most useful when they land directly on the primary planning surface instead of generating disconnected suggestions.
- Consequence: keep milestones and communications as their own source-of-truth records, but allow them to be edited through the shared calendar modal; maintain distinct visual treatment for each source type; support deleting communication schedules from the backend; and treat deeper AI/model-backed schedule drafting as an enhancement on top of the now-functional prompt-to-calendar path.

## Communications Builder Direction

- Status: active
- Decision: make the Studio `Communications` section template-only and move all communication timing/scheduling responsibility to the calendar/scheduler surfaces. Use Query Forge's communication template builder as the interaction reference, but adapt it to Blessing Tree's simpler `subjectTemplate` and `bodyTemplate` backend model instead of copying Query Forge's block-based schema.
- Rationale: campaign operators need one clear place to design reusable email content and another clear place to place that content on the calendar. Mixing template authoring and scheduling on the same Studio page duplicates responsibility and makes the communications surface less focused.
- Consequence: the Communications section should present a saved-template rail, a metadata/content editing workspace, and a rendered email preview; it should support real create/update template persistence; any communication scheduling UI should remain in the schedule calendar modal and related scheduler flows instead of the template builder page; and richer heading/text/image blocks should be persisted through a versioned envelope inside the current `bodyTemplate` field until the backend grows a first-class structured template schema.

## Code Structure Policy

- Status: active
- Decision: enforce small files, single responsibility, reusable components, feature-driven backend structure, version bumps for code changes, schema-plus-migration discipline including local MySQL apply/verify, backend-enforced authorization, additive API changes by default, narrow shared modules, mandatory review/tests/doc updates before completion, custom in-app confirmation UI instead of native browser dialogs, and rounded-rectangle badges/controls instead of pill styling.
- Rationale: the project is still early enough to avoid structural drift, and these rules reduce the chance of god files, mixed concerns, silent contract breakage, untested migrations, weak auth enforcement, invisible regressions, inconsistent low-quality browser-native dialog UX, and soft default “pill UI” aesthetics becoming normal.
- Consequence: future implementation should split oversized files proactively, organize backend work by feature, ship migrations with schema changes, apply and verify them against local MySQL when available, treat frontend access control as advisory only, avoid casual API breakage, keep shared modules intentionally small, bump version files for real code changes, treat review, tests, docs, and commit as part of task completion, never use `window.confirm`, `window.alert`, or `window.prompt` in the product UI, and avoid `border-radius: 999px` style treatment for badges and similar controls.
