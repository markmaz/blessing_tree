from __future__ import annotations

from flask_restx import Resource

from app.features.meta import meta_ns
from app.versioning import get_backend_version


@meta_ns.route("/version")
class VersionResource(Resource):
    def get(self):
        return {
            "backend_version": get_backend_version(),
        }, 200
