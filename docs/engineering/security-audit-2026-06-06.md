# Security Audit - 2026-06-06

## Scope

This audit reviewed the current Blessing Tree codebase and deployment assets on
branch `codex/production-safety-runbooks`. It was read-only and covered:

- frontend and backend dependency advisories
- committed secret hygiene
- auth, session, password reset, and public sponsor token handling
- request logging and audit metadata behavior
- public/mobile sponsor drop-off QR endpoints
- Docker Compose and GitHub Actions deployment configuration
- static Python security patterns

## Commands Run

```bash
git status --short --branch
git ls-files blessing-tree-api/.env files/blessing-tree.pem deploy/docker/blessing-tree.env.example blessing-tree-api/.env.example
git check-ignore -v blessing-tree-api/.env files/blessing-tree.pem
ls -l files/blessing-tree.pem blessing-tree-api/.env
git grep -n -I -E "sk-[A-Za-z0-9]|BEGIN (RSA |OPENSSH |EC )?PRIVATE KEY|OPENAI_API_KEY=.+|JWT_SECRET=.+|SMTP_PASSWORD=.+|DB_PASSWORD=.+|AWS_SECRET_ACCESS_KEY|GHCR_TOKEN"
cd blessing-tree-ui && npm audit --audit-level=moderate --json
cd blessing-tree-api && uvx pip-audit -r requirements.txt
cd blessing-tree-api && uvx bandit -q -r app -x '*/tests/*'
```

## Executive Summary

The app has a reasonable security foundation for a small production system:
refresh cookies are HttpOnly, access tokens are memory-only in the frontend,
refresh tokens rotate through Valkey, password reset tokens are hashed, staff
APIs generally enforce backend RBAC, and no committed private keys or concrete
runtime secrets were found.

The main security work is hardening rather than emergency containment. The
highest priority is dependency remediation, followed by reducing PII/secrets in
request logs, tightening token-bearing QR responses, and hashing public sponsor
verification tokens.

## Findings

### P0 - None Found

No committed private keys, `.env` files, OpenAI keys, AWS keys, or cleartext
production secrets were found in tracked source.

### P1 - Frontend Dependency Advisories

Evidence:

- `blessing-tree-ui/package.json`
- `npm audit --audit-level=moderate --json`

`npm audit` reported 13 advisories:

- 2 critical
- 8 high
- 3 moderate

High-signal items:

- `react-router-dom` / `react-router`: runtime dependency with high advisories.
- `xlsx`: runtime export dependency with prototype pollution and ReDoS
  advisories. npm reports no fix available.
- `vite`, `rollup`, `vitest`, and coverage tooling: mostly development/build
  surface, but still important for local/dev-server and CI safety.

Risk:

Blessing Tree handles sponsor and recipient PII. Runtime dependencies used in
normal browser sessions and report/export flows have a higher practical risk
than purely local build tooling.

Recommended remediation:

1. Run targeted dependency updates for packages with fixed versions.
2. Replace `xlsx` with a maintained library such as ExcelJS, or move spreadsheet
   export generation to the backend.
3. Keep `npm audit --audit-level=high` in regular release checks.

### P1 - Backend Dependency Advisories

Evidence:

- `blessing-tree-api/requirements.txt`
- `uvx pip-audit -r requirements.txt`

`pip-audit` reported 12 advisories:

- `cryptography==46.0.3`, fixed by `46.0.7`
- `Flask==3.1.2`, fixed by `3.1.3`
- `PyJWT==2.11.0`, fixed by `2.13.0`
- `python-dotenv==1.2.1`, fixed by `1.2.2`
- `requests==2.32.5`, fixed by `2.33.0`

Risk:

Flask, PyJWT, cryptography, and requests are runtime-sensitive. Even if a
specific CVE path is unlikely in this app, these should be patched before
calling the app fully hardened.

Recommended remediation:

1. Update pinned backend requirements to fixed versions.
2. Run backend tests and a local smoke test.
3. Add periodic `pip-audit` to the release checklist or CI.

### P1 - Request Body Logging Can Capture PII Or Secrets

Evidence:

- `blessing-tree-api/app/factory.py`
- `try_get_json_body()` only masks top-level `password` and `token` keys.
- `g.audit_data["request_body"]` is populated for every JSON request.

Risk:

Sponsor, recipient, child, address, phone, notes, invite/reset data, SMTP/API
configuration, or other sensitive values can be copied into request logs. The
current masking is shallow and narrow, so nested or differently named sensitive
fields can leak.

Recommended remediation:

1. Stop logging request bodies by default.
2. If body logging is still useful, use an allowlist by route and recursively
   redact sensitive keys.
3. Always skip bodies for:
   - `/api/v1/auth/*`
   - admin configuration routes
   - LLM/SMTP/API key configuration routes
   - public sponsor registration routes
4. Expand sensitive markers to include `secret`, `api_key`, `apikey`,
   `authorization`, `cookie`, `email`, `phone`, `address`, `notes`, `reset`,
   `invite`, `smtp`, and `credential` where appropriate.

### P2 - Public Sponsor Verification Tokens Are Stored Raw

Evidence:

- `blessing-tree-api/app/models/pending_sponsor_registration.py`
- `verification_token` is stored directly and queried directly.
- `blessing-tree-api/app/features/sponsors/service.py` queries by raw token.

Risk:

Anyone with database read access can use pending public sponsor verification
tokens until they expire. Password reset and sponsor drop-off tokens already
use hashed storage, so public sponsor verification should match that pattern.

Recommended remediation:

1. Add a `verification_token_hash` column.
2. Store only SHA-256 hashes for newly generated tokens.
3. Query by token hash.
4. Migrate existing pending rows carefully or expire them.
5. Remove raw token storage after compatibility is no longer needed.

### P2 - Sponsor Drop-Off QR Images Are Publicly Cacheable

Evidence:

- `blessing-tree-api/app/features/campaigns/mobile_dropoff_api.py`
- `/api/v1/campaigns/mobile/dropoff-qr/<token>.png`
- `Cache-Control: public, max-age=86400`

Risk:

The QR image endpoint embeds a token-bearing URL. The image only renders a QR,
but the token is still in the path and can be cached or logged by proxies,
browsers, or intermediaries. The authenticated payload endpoint is protected,
but token-bearing artifacts should not be publicly cacheable.

Recommended remediation:

Change QR response headers to:

```http
Cache-Control: private, no-store
Pragma: no-cache
```

Also consider moving token-bearing QR generation fully into the authenticated
email/rendering flow so raw token image URLs are less reusable.

### P2 - Swagger UI Is Exposed In Production App

Evidence:

- `blessing-tree-api/app/factory.py`
- Flask-RESTX `Api(..., doc="/swagger-ui")`

Risk:

Swagger does not bypass endpoint auth, but it exposes endpoint structure and
payload expectations. That is useful in development and unnecessary in normal
production operation.

Recommended remediation:

1. Disable Swagger UI when `CURRENT_ENVIRONMENT=production`.
2. Or gate Swagger behind app-admin auth.
3. Keep OpenAPI docs available locally for developer use.

### P2 - Deployment Runner Has High Production Power

Evidence:

- `.github/workflows/deploy-docker-ec2.yml`
- deploy job runs on `[self-hosted, prod-blessing-tree]`.
- known operational memory states the runner has Docker group access and
  limited sudo for deployment commands.

Risk:

Any workflow routed to the production runner executes shell commands on the EC2
host. This is an intentional deployment design, but it is a high-trust boundary.

Recommended remediation:

1. Keep the runner repository-scoped.
2. Keep narrow labels and do not reuse `prod-blessing-tree` labels elsewhere.
3. Keep production environment approval enabled.
4. Never run untrusted pull request code on the self-hosted runner.
5. Review workflows for any future `pull_request` triggers.

### P3 - CORS Origins Should Be Fully Environment-Driven

Evidence:

- `blessing-tree-api/app/factory.py`
- `build_cors_origins()` always includes:
  - `https://blessing-tree.com`
  - `http://localhost:3000`
  - `http://localhost:5173`

Risk:

The hardcoded production origin is probably fine today, but this is brittle if
the product moves domains or is reused for QueryForge. Localhost origins are
low risk in production, but the intent should be explicit.

Recommended remediation:

Use an env var such as `BT_CORS_ORIGINS` and include localhost only in
development.

### P3 - Qdrant Image Uses `latest`

Evidence:

- `docker-compose.yml`
- `qdrant/qdrant:latest`

Risk:

Unpinned images can change behavior unexpectedly across deploys. This is more
availability/release risk than direct exploit risk, but Qdrant is now part of
search behavior.

Recommended remediation:

Pin Qdrant to a known version and update deliberately.

### P3 - Valkey Auth Is Not End-To-End Configured

Evidence:

- `docker-compose.yml` starts Valkey without a password.
- `blessing-tree-api/app/adapters/valkey_client.py` supports
  `VALKEY_PASSWORD`.
- `blessing-tree-api/app/config/__init__.py` builds `VALKEY_CONFIG` as
  `redis://host:port/0`, without password.

Risk:

Valkey is internal-only in Compose, which is acceptable for the current shape.
If Valkey auth is enabled later, Celery broker/result URLs will not use the
password unless `VALKEY_CONFIG` is updated.

Recommended remediation:

1. Keep Valkey unexposed to the host/network.
2. If enabling `VALKEY_PASSWORD`, update `VALKEY_CONFIG` to include it safely.
3. Add a health check that validates authenticated access when password is set.

### P3 - Local `.env` File Permissions Are Loose

Evidence:

- `blessing-tree-api/.env` exists locally and is gitignored.
- Local mode observed: `rw-r--r--`.
- `files/blessing-tree.pem` is correctly `rw-------`.

Risk:

This is local-machine hygiene. Any local user account could read the local
`.env` file. The PEM key is already properly restricted.

Recommended remediation:

Run:

```bash
chmod 600 blessing-tree-api/.env
```

### P3 - Development Entrypoint Binds Debug Server To All Interfaces

Evidence:

- `blessing-tree-api/app/main.py`
- `blessing_tree.run(host="0.0.0.0", port=5000, debug=True)`
- Bandit reported this as medium severity.

Risk:

Production uses Gunicorn through Docker, so this is mostly accidental misuse
risk. Still, a developer could expose Flask debug mode on a network.

Recommended remediation:

Guard debug entrypoint with environment checks or bind to `127.0.0.1` by
default.

## Positive Controls Observed

- `.env` and PEM files are ignored and not tracked.
- No obvious committed private key or concrete runtime secret material found.
- Refresh cookie is HttpOnly.
- Refresh cookie becomes Secure in production.
- Access tokens are stored in frontend memory, not localStorage.
- Refresh tokens rotate and are stored hashed in Valkey.
- Password reset tokens are hashed and expire.
- Sponsor drop-off tokens are generated with strong randomness and stored as
  SHA-256 hashes.
- Staff gift/drop-off payload access is protected by campaign RBAC.
- Public sponsor signup includes honeypot and IP/email rate limiting.
- Public sponsor gift commitment validates campaign scope, availability, and
  sponsor gift limits server-side.
- Compose keeps Valkey and Qdrant internal rather than host-published.
- Docker deploy now uses a self-hosted EC2 runner instead of copying SSH keys
  from GitHub Actions.

## Remediation Plan

### Slice 1 - Dependency Security

Goal: remove known fixed dependency CVEs.

Tasks:

1. Update backend requirements:
   - `cryptography` to at least `46.0.7`
   - `Flask` to at least `3.1.3`
   - `PyJWT` to at least `2.13.0`
   - `python-dotenv` to at least `1.2.2`
   - `requests` to at least `2.33.0`
2. Update frontend dependencies with fixed versions for React Router, Vite,
   Rollup, Vitest, PostCSS, Picomatch, Minimatch, Brace Expansion, AJV, and
   Flatted.
3. Decide whether to replace `xlsx` immediately or temporarily accept the risk
   with a tracked issue.
4. Run:

```bash
cd blessing-tree-api && uvx pip-audit -r requirements.txt
cd blessing-tree-ui && npm audit --audit-level=high
cd blessing-tree-ui && npm run lint && npm test && npm run build
```

### Slice 2 - Logging And Token Hygiene

Goal: reduce accidental PII/secret exposure.

Tasks:

1. Replace request-body logging with route allowlisting or remove it entirely.
2. Add recursive sanitization for any retained request metadata.
3. Set sponsor QR image responses to `private, no-store`.
4. Change public sponsor verification tokens to hashed storage with a migration.
5. Add regression tests for:
   - sensitive field redaction
   - QR cache headers
   - public sponsor verification by hash

### Slice 3 - Production Surface Reduction

Goal: reduce information disclosure and accidental operational exposure.

Tasks:

1. Disable or admin-gate Swagger UI in production.
2. Move CORS origins to environment configuration.
3. Retire or clearly disable the legacy manual deploy workflow if Docker deploy
   is the only supported path.
4. Pin Qdrant image version.
5. Document runner restrictions in deployment docs.

### Slice 4 - Local And Operational Hygiene

Goal: keep support/development practices aligned with production risk.

Tasks:

1. `chmod 600 blessing-tree-api/.env`.
2. Bind local Flask debug entrypoint to `127.0.0.1` or require explicit env opt-in
   for `0.0.0.0`.
3. Add `npm audit` and `pip-audit` notes to the release checklist.
4. Add a quarterly dependency/security review reminder to the engineering
   memory or release process.

## Definition Of Done

Security hardening from this audit should be considered complete when:

- fixed-version dependency audits pass or remaining advisories are explicitly
  accepted in `memory/known-risks.md`
- request logs no longer capture broad raw PII payloads
- token-bearing QR responses are non-cacheable
- public sponsor verification tokens are stored hashed
- production Swagger exposure is removed or admin-gated
- CORS, Qdrant image pinning, and deploy workflow ownership are explicit
- frontend and backend tests/builds pass after changes
