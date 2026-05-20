# Coding Standards

## Backend

- Keep route behavior explicit and aligned with actual backend capabilities.
- Prefer typed SQLAlchemy 2.x patterns already used in `app/models/`.
- Keep env-driven configuration centralized through `app/config/__init__.py`.
- Add dependencies to `requirements.txt` or `requirements-dev.txt` when new imports are introduced.

## Frontend

- Keep route constants centralized in `src/app/routes.ts`.
- Prefer the existing app shell and auth context patterns over one-off state handling.
- Do not describe transitional UI behavior as final production design in docs.

## Documentation

- Keep docs short, current, and canonical.
- Favor project-root documentation for cross-cutting topics.
- Use redirect stubs for deprecated docs instead of deleting discoverability entirely.
