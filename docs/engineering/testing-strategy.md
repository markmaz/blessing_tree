# Testing Strategy

## Current Expectations

- Backend:
  - use `scripts/lint.sh`
  - use `scripts/test.sh`
  - prefer `.venv/bin/python -m pytest` and `.venv/bin/python -m ruff` for environment-specific verification when validating dependency/setup work
  - for schema changes, apply the migration to the local MySQL `blessing_tree` database and verify the resulting table/constraint shape when local DB access is available
- Frontend:
  - use `npm run build`
  - use `npm run lint`

## Priority Areas

- auth login/refresh/logout behavior
- frontend auth routing and protected state
- UUID binary conversion behavior
- any new API slice added under the roadmap

## Documentation Changes

- Docs-only changes do not require full application testing, but should still be sanity-checked by reading the final files.
