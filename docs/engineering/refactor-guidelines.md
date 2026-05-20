# Refactor Guidelines

- Refactor when a file becomes misleading, duplicated, or structurally out of sync with the live code.
- Prefer consolidating duplicate documentation rather than editing every copy.
- Preserve stable entrypoints while simplifying internals.
- Be cautious around auth, cookie handling, environment loading, and UUID model infrastructure.
