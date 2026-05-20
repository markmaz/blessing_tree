# Security And Trust Boundaries

- Treat auth and refresh-cookie behavior as a sensitive boundary.
- Do not weaken cookie, token, or JWT assumptions casually during UI cleanup.
- Keep secrets and environment-specific values out of committed docs except through examples and placeholders.
- The project is not currently modeled as a multi-tenant system, but auth and role boundaries still matter for future admin and operational features.
