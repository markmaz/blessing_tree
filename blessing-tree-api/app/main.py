from __future__ import annotations

import sys
from pathlib import Path


CURRENT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = CURRENT_DIR.parent

# When this file is executed as `python app/main.py`, Python places the
# `app/` directory first on sys.path. That causes `from celery import Celery`
# inside `app/celery.py` to resolve back to this package's `celery.py` module
# instead of the installed Celery package. Normalize sys.path so project-root
# imports work consistently for both `python app/main.py` and `python -m app.main`.
if str(CURRENT_DIR) in sys.path:
    sys.path.remove(str(CURRENT_DIR))
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def build_app():
    from app.factory import create_app

    return create_app()


blessing_tree = build_app()

if __name__ == "__main__":
    blessing_tree.run(host="0.0.0.0", port=5000, debug=True)
