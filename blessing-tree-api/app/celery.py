from celery import Celery

from app.config import VALKEY_CONFIG

celery = Celery(__name__, broker=VALKEY_CONFIG, backend=VALKEY_CONFIG)
celery.autodiscover_tasks(["app.tasks"])

def init_celery(app):
    celery.conf.update(app.config)