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

## Code Structure Policy

- Status: active
- Decision: enforce small files, single responsibility, reusable components, feature-driven backend structure, version bumps for code changes, schema-plus-migration discipline, backend-enforced authorization, additive API changes by default, narrow shared modules, and mandatory review/tests/doc updates before completion.
- Rationale: the project is still early enough to avoid structural drift, and these rules reduce the chance of god files, mixed concerns, silent contract breakage, weak auth enforcement, and invisible regressions becoming normal.
- Consequence: future implementation should split oversized files proactively, organize backend work by feature, ship migrations with schema changes, treat frontend access control as advisory only, avoid casual API breakage, keep shared modules intentionally small, bump version files for real code changes, and treat review, tests, docs, and commit as part of task completion.
