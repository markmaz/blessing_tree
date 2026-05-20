# Compatibility And Versioning

- Keep backend dependency manifests current with code imports.
- Backend code changes bump `blessing-tree-api/version.json`.
- Frontend code changes bump `blessing-tree-ui/package.json`.
- Documentation-only and memory-only changes do not require app version bumps.
- Add environment examples when configuration shape changes.
- Prefer additive schema/API work while the first real domain slice is being established.
- When behavior changes, update canonical docs in the same change so runtime and documentation stay compatible.
