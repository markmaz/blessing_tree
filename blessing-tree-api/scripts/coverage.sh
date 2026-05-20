#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if pytest --help 2>/dev/null | grep -q -- "--cov"; then
  if [[ $# -gt 0 ]]; then
    PYTHONPATH=. pytest --cov=app --cov=tests --cov-report=term-missing --cov-report=html "$@"
  else
    PYTHONPATH=. pytest --cov=app --cov=tests --cov-report=term-missing --cov-report=html
  fi

  printf '\nHTML report: %s\n' "$repo_root/htmlcov/index.html"
  exit 0
fi

if python -c "import importlib.util, sys; sys.exit(0 if importlib.util.find_spec('coverage') else 1)" >/dev/null 2>&1; then
  if [[ $# -gt 0 ]]; then
    PYTHONPATH=. python -m coverage run -m pytest "$@"
  else
    PYTHONPATH=. python -m coverage run -m pytest
  fi

  python -m coverage report -m
  python -m coverage html
  printf '\nHTML report: %s\n' "$repo_root/htmlcov/index.html"
  exit 0
fi

cat <<'MSG'
pytest-cov (or coverage.py) is not installed in this environment.
Install one of the following:
  pip install pytest-cov
  pip install coverage
MSG
exit 1
