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

## Campaign Readiness Direction

- Status: active
- Decision: evolve Campaign Readiness from a flat backend finding list into a lifecycle-aware, backend-driven control surface with grouped categories, phase-specific gating, explicit action labels, and future automation-health checks.
- Rationale: the current readiness model is useful for early scaffolding, but it will become noisy and hard to reason about once scheduling, communications, recipient workflows, and automation execution all exist. Operators need to know what blocks activation, what is still a planning gap, and what is wrong during live operations.
- Consequence: readiness items should eventually include `category`, `action_label`, and `blocking_for`; the UI should group findings into `blockers`, `launch_checks`, `planning_gaps`, and `operational_health`; readiness should report phase status for `draft`, `activate`, `operations`, and `close`; and future scheduling/automation work should report health back through readiness instead of inventing a separate warning surface.

## Communications Builder Direction

- Status: active
- Decision: make the Studio `Communications` section template-only and move all communication timing/scheduling responsibility to the calendar/scheduler surfaces. Use Query Forge's communication template builder as the interaction reference, but adapt it to Blessing Tree's simpler `subjectTemplate` and `bodyTemplate` backend model instead of copying Query Forge's block-based schema.
- Rationale: campaign operators need one clear place to design reusable email content and another clear place to place that content on the calendar. Mixing template authoring and scheduling on the same Studio page duplicates responsibility and makes the communications surface less focused.
- Consequence: the Communications section should present a saved-template rail, a metadata/content editing workspace, and a rendered email preview; it should support real create/update template persistence; any communication scheduling UI should remain in the schedule calendar modal and related scheduler flows instead of the template builder page; richer heading/text/image blocks should be persisted through a versioned envelope inside the current `bodyTemplate` field until the backend grows a first-class structured template schema; and small uploaded images should be embedded inline as data URLs until dedicated asset storage exists.

## Campaign Team Workspace Direction

- Status: active
- Decision: redesign Campaign Studio Team around a campaign roster workspace instead of a direct app-user assignment flow. Treat campaign members, app access, fixed app access roles, user-defined teams, and team-scoped team roles as separate concepts. Keep app access roles fixed for RBAC, but use teams and team roles for operational grouping and email targeting.
- Rationale: the earlier Team flow assumed every person was an app user and overloaded roles as the only grouping mechanism. That still left a gap once the new roster workspace landed, because campaign managers also need to assign people to teams without granting app permissions and may want team-specific responsibilities such as `Lead`, `Caller`, or `Gift Check-In` inside a given team.
- Consequence: keep `campaign_member` as the roster source of truth, make app access optional, keep RBAC code-defined and backend-authoritative, rename UI language to `App Access Roles` where applicable, add team-owned role definitions, allow plain team membership with no explicit role, and evolve communications audiences to target teams and team roles separately from RBAC.

## Campaign Studio AI Actions Direction

- Status: active
- Decision: evolve Campaign Studio AI from a mostly advisory drawer into a structured section-scoped action system. AI should draft concrete actions such as creating templates, placing communications on the calendar, creating milestones, creating teams, creating team roles, and generating readiness fix bundles, but users must review and apply those actions explicitly.
- Rationale: the current Studio AI is strongest on Schedule and much weaker elsewhere, which makes the feature feel inconsistent. Operators want AI to actually do work on the current screen, not just explain it. A draft/review/apply model preserves trust while still making the feature useful.
- Consequence: add a backend AI draft endpoint, normalize AI action payloads, keep existing feature APIs authoritative for persistence, support multi-action bundles for prompts like "create a template and schedule it," keep `Apply All` best-effort instead of transactional, ask before updating an existing template, keep AI drafts transient by default, keep readiness and automation warnings visible when AI creates planned schedule records that still depend on a future execution layer, only allow lightweight inline edits in the AI drawer before routing users into the native section forms for more structural changes, and use the configured admin LLM as the primary draft engine with deterministic backend drafting retained as fallback, guardrails, and verification.

## Team Phase 2 Transition Policy

- Status: active
- Decision: phase 2 of the Team redesign adds `campaign_member_access_role` and member-first authorization resolution, but does not perform SQL backfill from legacy `campaign_user_role` because the app has no real users yet.
- Rationale: the user explicitly said not to worry about migration backfill for this app state, and forcing backfill logic now would add noise without real data pressure.
- Consequence: authorization should resolve through member-linked access roles when a linked campaign member exists, and should keep `campaign_user_role` as a temporary compatibility fallback until Team write flows move to the new model.

## Code Structure Policy

- Status: active
- Decision: enforce small files, single responsibility, reusable components, feature-driven backend structure, version bumps for code changes, schema-plus-migration discipline including local MySQL apply/verify, backend-enforced authorization, additive API changes by default, narrow shared modules, mandatory review/tests/doc updates before completion, custom in-app confirmation UI instead of native browser dialogs, rounded-rectangle badges/controls instead of pill styling, and icons on all product UI buttons.
- Rationale: the project is still early enough to avoid structural drift, and these rules reduce the chance of god files, mixed concerns, silent contract breakage, untested migrations, weak auth enforcement, invisible regressions, inconsistent low-quality browser-native dialog UX, soft default “pill UI” aesthetics becoming normal, and text-only button treatments drifting into the interface.
- Consequence: future implementation should split oversized files proactively, organize backend work by feature, ship migrations with schema changes, apply and verify them against local MySQL when available, treat frontend access control as advisory only, avoid casual API breakage, keep shared modules intentionally small, bump version files for real code changes, treat review, tests, docs, and commit as part of task completion, never use `window.confirm`, `window.alert`, or `window.prompt` in the product UI, avoid `border-radius: 999px` style treatment for badges and similar controls, and ensure every product UI button includes an icon.

## Automation Runtime Direction

- Status: active
- Decision: run Blessing Tree campaign automation through Celery worker/beat with explicit execution logging, worker heartbeat health checks, and a dedicated default queue named `bt` even when sharing the same local Valkey broker with other projects.
- Rationale: scheduled communications and lifecycle transitions now need a real execution path, and local development already shares broker infrastructure with Query Forge. Using the default Celery queue caused Blessing Tree workers to receive Query Forge task envelopes, which is operationally noisy and unsafe.
- Consequence: communication schedules now record delivery attempts and dispatch outcomes, lifecycle transitions can be advanced by worker tasks, readiness reflects actual worker health and recent execution issues, and all Blessing Tree automation tasks must publish and consume on the dedicated `bt` queue.

## Admin Runtime Direction

- Status: active
- Decision: add a first-class admin runtime slice for Query Forge-style user invitations, global LLM configuration, runtime health visibility, and feature flag control.
- Rationale: Blessing Tree now has enough moving parts that operators need a real admin surface instead of ad hoc environment edits. The invitation flow should match the existing Query Forge pattern, LLM configuration should be app-managed, and health/feature state should be visible in-product.
- Consequence: the backend now owns invitation lifecycle, encrypted LLM settings, feature-flag state, and health probes; the frontend admin page is no longer a placeholder; and authenticated users can read feature flags for route/navigation gating while only app admins can mutate admin settings.

## Invitation-Centric Onboarding Direction

- Status: active
- Decision: invitation is the only onboarding funnel into Blessing Tree. An invited user may choose Google, Yahoo, or a local password as their first authentication method, and the first successful identity binding should accept the invitation. App roles remain admin-controlled internally.
- Rationale: the current split between local-password invite acceptance and pre-provisioned OAuth login is inconsistent. The cleaner model is controlled provisioning plus user-chosen auth method.
- Consequence: generic Google/Yahoo login should be for already-linked returning users only; first-time onboarding should start from the invite link; invite-scoped OAuth must validate the invited email, bind the identity, accept the invite, and complete sign-in; and local password setup becomes one onboarding option rather than the definition of invite acceptance.
