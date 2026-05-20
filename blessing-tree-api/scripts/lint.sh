#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

if [[ $# -gt 0 ]]; then
  ruff check "$@"
else
  ruff check app tests
fi
