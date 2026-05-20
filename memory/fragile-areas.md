# Fragile Areas

## Auth And Cookies

- `blessing-tree-api/app/routes/auth_routes.py`
- `blessing-tree-api/app/services/auth/`
- `blessing-tree-ui/src/shared/api/authApi.ts`
- `blessing-tree-ui/src/features/auth/model/authContext.tsx`

Changes here can easily desynchronize UI behavior and backend reality.

## App Bootstrap

- `blessing-tree-api/app/factory.py`
- `blessing-tree-api/app/main.py`
- `blessing-tree-api/app/config/__init__.py`

These files control startup, env loading, logging, Celery wiring, and Valkey integration.

## UUID Model Infrastructure

- `blessing-tree-api/app/models/uuid_bin.py`
- `blessing-tree-api/tests/test_uuid_bin.py`

This is a central low-level contract across many models.

## App Shell Routing

- `blessing-tree-ui/src/app/App.tsx`
- `blessing-tree-ui/src/shared/ui/layout/AppLayout.tsx`
- `blessing-tree-ui/src/app/routes.ts`

These files shape the frontend navigation and protected-route behavior.
