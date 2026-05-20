from itsdangerous import URLSafeTimedSerializer

from app.config import JWT_SECRET


def get_serializer():
    return URLSafeTimedSerializer (secret_key=JWT_SECRET, salt="invite-user")

def generate_token(user_id: str) -> str:
    s = get_serializer()
    return s.dumps(user_id)

def validate_token(token: str, max_age_seconds=86400) -> str:
    s = get_serializer()
    return s.loads(token, max_age=max_age_seconds)
