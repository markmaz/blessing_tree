# Coding Standards

## Backend

- Use snake_case for backend modules, files, functions, variables, and payload keys unless an external contract requires otherwise.
- Keep route behavior explicit and aligned with actual backend capabilities.
- Use a feature-driven structure for backend code, following the Query Forge direction:
  - group route, service, and related model/repository logic by feature
  - avoid a single global dumping ground for unrelated routes or services
- Prefer typed SQLAlchemy 2.x patterns already used in `app/models/`.
- Keep env-driven configuration centralized through `app/config/__init__.py`.
- Add dependencies to `requirements.txt` or `requirements-dev.txt` when new imports are introduced.
- Avoid mixed responsibilities in one file. Break route, service, policy, persistence, and schema concerns into smaller files.
- Avoid god files. Target roughly 400 lines or less per file unless there is a strong reason not to.
- Break logic into the smallest reusable units that remain readable and coherent.
- When code changes, bump the backend version using the project version files that will be established for Blessing Tree. Do not bump versions for docs-only changes.

## Frontend

- Use camelCase for frontend variables, functions, helpers, and props. Use React component naming conventions (`PascalCase`) for components and files that export components.
- Keep route constants centralized in `src/app/routes.ts`.
- Prefer the existing app shell and auth context patterns over one-off state handling.
- Break UI into the smallest reusable components that are still meaningful and maintainable.
- Avoid mixed responsibilities in a single file.
- Avoid god files. Target roughly 400 lines or less per file unless there is a strong reason not to.
- When code changes, bump the frontend version in `package.json`. Do not bump versions for docs-only changes.
- Do not describe transitional UI behavior as final production design in docs.

## Documentation

- Keep docs short, current, and canonical.
- Favor project-root documentation for cross-cutting topics.
- Use redirect stubs for deprecated docs instead of deleting discoverability entirely.

## Completion And Review

- Run a code review before marking a task done. Review should check correctness, scope discipline, regressions, and obvious cleanup opportunities.
- Commit completed code work once the task is finished and verified.
