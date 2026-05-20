# Coding Standards

## Backend

- Use snake_case for backend modules, files, functions, variables, and payload keys unless an external contract requires otherwise.
- Keep route behavior explicit and aligned with actual backend capabilities.
- Treat backend authorization as the source of truth. Frontend gating is for UX only and must not be relied on for access control.
- Use a feature-driven structure for backend code, following the Query Forge direction:
  - group route, service, and related model/repository logic by feature
  - avoid a single global dumping ground for unrelated routes or services
- Prefer typed SQLAlchemy 2.x patterns already used in `app/models/`.
- Keep env-driven configuration centralized through `app/config/__init__.py`.
- Add dependencies to `requirements.txt` or `requirements-dev.txt` when new imports are introduced.
- Ship migrations with the schema and model changes they belong to.
- Avoid mixed responsibilities in one file. Break route, service, policy, persistence, and schema concerns into smaller files.
- Avoid god files. Target roughly 400 lines or less per file unless there is a strong reason not to.
- Break logic into the smallest reusable units that remain readable and coherent.
- When code changes, bump the backend version using the project version files that will be established for Blessing Tree. Do not bump versions for docs-only changes.

## Frontend

- Use camelCase for frontend variables, functions, helpers, and props. Use React component naming conventions (`PascalCase`) for components and files that export components.
- Keep route constants centralized in `src/app/routes.ts`.
- Prefer the existing app shell and auth context patterns over one-off state handling.
- Treat frontend capability and menu gating as advisory UX only. Sensitive enforcement belongs on the backend.
- Break UI into the smallest reusable components that are still meaningful and maintainable.
- Avoid mixed responsibilities in a single file.
- Avoid god files. Target roughly 400 lines or less per file unless there is a strong reason not to.
- When code changes, bump the frontend version in `package.json`. Do not bump versions for docs-only changes.
- Do not describe transitional UI behavior as final production design in docs.
- Frontend behavior changes must ship with automated tests unless explicitly deferred and documented.
- Frontend verification for code changes now includes `npm run test` in addition to lint/build.
- Do not use native browser dialogs such as `window.confirm`, `window.alert`, or `window.prompt` in product UI. Confirmation and notice flows must use custom application UI.

## APIs And Shared Code

- Prefer additive API changes. Breaking contract changes require an explicit decision and coordinated frontend/backend updates.
- Avoid shared dumping-ground modules. Shared helpers, clients, and utilities should stay intentionally small and narrowly scoped.

## Documentation

- Keep docs short, current, and canonical.
- Favor project-root documentation for cross-cutting topics.
- Use redirect stubs for deprecated docs instead of deleting discoverability entirely.

## Completion And Review

- Run a code review before marking a task done. Review should check correctness, scope discipline, regressions, and obvious cleanup opportunities.
- Ship tests with new behavior unless the task explicitly documents why they are deferred.
- Treat automated frontend tests as mandatory for new frontend behavior unless an explicit deferral is documented.
- Update canonical docs in the same change when behavior changes.
- Commit completed code work once the task is finished and verified.
