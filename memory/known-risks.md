# Known Risks

## Auth Mismatch

- Local login, OAuth callback completion, and reload-time session restoration now match the backend.
- The frontend still lacks automatic access-token refresh during active API use after a 401 response.
- Risk: authenticated reload and provider sign-in are improved, but future data-heavy screens may still need a refresh-on-401 client layer.

## Environment Reproducibility

- Dependency manifests and `.env.example` exist now.
- Risk: startup instructions are improved and the documented backend entrypoint now works again, but full clean-room app validation across backend and frontend still needs to be exercised end to end.

## Script Environment Drift

- Backend helper scripts rely on `pytest` and `ruff` from `PATH`.
- Risk: local shell tools may differ from the project virtualenv.

## Unimplemented Business Surface

- Many domain models exist, but business APIs and real UI pages are still incomplete.
- Risk: the project can look further along than it actually is if only the schema and shells are considered.
