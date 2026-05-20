# Constitution

## Non-Negotiable Rules

- Read the memory system at session start and keep it updated.
- Treat `README.md`, `ROADMAP.md`, and the backend/frontend READMEs as canonical docs.
- Ignore `files/` unless the user explicitly says otherwise.
- Do not document fake behavior as if it were production behavior.
- Prefer code and docs that reflect the current system over aspirational or delivery-era summaries.
- No god files. Keep file size around 400 lines unless there is a defensible reason to exceed it.
- Do not mix unrelated responsibilities in a single file.
- Break code into the smallest reusable components/services/helpers that still preserve clarity.
- Run a code review before a task is considered done.
- Bump frontend and backend version files for code changes, but not for docs-only changes.
- Use snake_case on the backend and camelCase on the frontend, with normal React component PascalCase conventions.
- Backend implementation should move toward feature-driven organization rather than global route/service dumping grounds.
- Ship migrations with the schema changes they belong to.
- Apply and verify backend schema migrations against the local MySQL `blessing_tree` database when local DB access is available.
- Backend authorization is authoritative; frontend access gating is advisory only.
- Prefer additive API changes unless an explicit breaking-change decision is made.
- Shared modules must stay narrowly scoped and must not become dumping grounds.
- New behavior should ship with tests unless deferred explicitly.
- Check in completed code work after verification.

## Invariants

- Backend is a Flask application under `blessing-tree-api/`.
- Frontend is a React + TypeScript + Vite application under `blessing-tree-ui/`.
- Auth currently centers on `/api/v1/auth/*` routes and frontend auth state in `src/features/auth/model/authContext.tsx`.
- Environment-driven configuration is loaded from `blessing-tree-api/app/config/__init__.py`.

## Definition Of Done

- Code changes are reflected in the canonical docs when relevant.
- Project memory is updated when priorities, rules, or notable findings change.
- Verification is run when practical, or the lack of verification is stated explicitly.
- A code review has been performed before the task is marked complete.
- Canonical docs are updated in the same change when behavior changes.
