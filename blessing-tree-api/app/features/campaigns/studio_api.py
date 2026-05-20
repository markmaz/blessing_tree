from __future__ import annotations

from flask import g, request
from flask_restx import Resource

from app.db import SessionLocal
from app.features.campaigns import campaign_ns
from app.features.campaigns.studio_serializers import (
    serialize_campaign_assignment,
    serialize_communication_schedule,
    serialize_communication_template,
    serialize_milestone,
    serialize_readiness,
    serialize_studio_payload,
    serialize_team_snapshot,
)
from app.features.campaigns.studio_service import CampaignStudioService
from app.features.rbac.decorators import require_campaign_capability

_studio_service = CampaignStudioService()


@campaign_ns.route("/<string:campaign_id>/studio")
class CampaignStudioResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            payload = _studio_service.get_studio_payload(db, getattr(g, "user_id"), campaign_id)
        return serialize_studio_payload(**payload)


@campaign_ns.route("/<string:campaign_id>/assignments")
class CampaignAssignmentListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            snapshot = _studio_service.get_team_snapshot(db, campaign_id)
        return serialize_team_snapshot(snapshot["assignments"], snapshot["counts"])

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            assignment = _studio_service.create_assignment(db, campaign_id, payload)
        return serialize_campaign_assignment(assignment), 201


@campaign_ns.route("/<string:campaign_id>/assignments/<string:assignment_id>")
class CampaignAssignmentDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, assignment_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            assignment = _studio_service.update_assignment(db, campaign_id, assignment_id, payload)
        return serialize_campaign_assignment(assignment)


@campaign_ns.route("/<string:campaign_id>/communications/templates")
class CommunicationTemplateListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            templates = _studio_service.list_templates(db)
        return [serialize_communication_template(template) for template in templates]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            template = _studio_service.create_template(db, getattr(g, "user_id"), payload)
        return serialize_communication_template(template), 201


@campaign_ns.route("/<string:campaign_id>/communications/templates/<string:template_id>")
class CommunicationTemplateDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, template_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            template = _studio_service.update_template(db, template_id, payload)
        return serialize_communication_template(template)


@campaign_ns.route("/<string:campaign_id>/communications/schedules")
class CommunicationScheduleListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            schedules = _studio_service.list_schedules(db, campaign_id)
        return [serialize_communication_schedule(schedule) for schedule in schedules]

    @require_campaign_capability("campaign.admin")
    def post(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            schedule = _studio_service.create_schedule(db, campaign_id, payload)
        return serialize_communication_schedule(schedule), 201


@campaign_ns.route("/<string:campaign_id>/communications/schedules/<string:schedule_id>")
class CommunicationScheduleDetailResource(Resource):
    @require_campaign_capability("campaign.admin")
    def patch(self, campaign_id: str, schedule_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            schedule = _studio_service.update_schedule(db, campaign_id, schedule_id, payload)
        return serialize_communication_schedule(schedule)


@campaign_ns.route("/<string:campaign_id>/milestones")
class CampaignMilestoneListResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            milestones = _studio_service.list_milestones(db, campaign_id)
        return [serialize_milestone(milestone) for milestone in milestones]

    @require_campaign_capability("campaign.admin")
    def put(self, campaign_id: str):
        payload = request.get_json(silent=True) or {}
        with SessionLocal() as db:
            milestones = _studio_service.replace_milestones(db, campaign_id, payload)
        return [serialize_milestone(milestone) for milestone in milestones]


@campaign_ns.route("/<string:campaign_id>/readiness")
class CampaignReadinessResource(Resource):
    @require_campaign_capability("campaign.view")
    def get(self, campaign_id: str):
        with SessionLocal() as db:
            readiness = _studio_service.get_readiness(db, campaign_id)
        return serialize_readiness(readiness)
