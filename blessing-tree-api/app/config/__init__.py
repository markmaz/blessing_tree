import os

from dotenv import load_dotenv

load_dotenv()

DB_HOST = os.getenv("DB_HOST")
DB_USER = os.getenv("DB_USER")
DB_PASSWORD = os.getenv("DB_PASSWORD")
DB_NAME = os.getenv("DB_NAME")
DB_PORT = os.getenv("DB_PORT", "3306")
DB_URI = f"mysql+pymysql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
JWT_ISSUER = os.getenv("JWT_ISSUER")
JWT_AUDIENCE = os.getenv("JWT_AUDIENCE")
ACCESS_TOKEN_TTL_MINUTES = int(os.getenv("ACCESS_TOKEN_TTL_MINUTES", "10"))
REFRESH_TOKEN_TTL_DAYS = int(os.getenv("REFRESH_TOKEN_TTL_DAYS", "21"))
REFRESH_COOKIE_NAME = os.getenv("REFRESH_COOKIE_NAME", "bt_refresh")
REFRESH_COOKIE_SECURE = os.getenv("REFRESH_COOKIE_SECURE", "").strip().lower() in ("1", "true", "yes", "y", "on")
REFRESH_COOKIE_SAMESITE = os.getenv("REFRESH_COOKIE_SAMESITE", "Lax")
REFRESH_COOKIE_PATH = os.getenv("REFRESH_COOKIE_PATH", "/api/v1/auth")
GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = os.getenv("GOOGLE_REDIRECT_URI")
YAHOO_CLIENT_ID = os.getenv("YAHOO_CLIENT_ID")
YAHOO_CLIENT_SECRET = os.getenv("YAHOO_CLIENT_SECRET")
YAHOO_REDIRECT_URI = os.getenv("YAHOO_REDIRECT_URI")
JWT_EXP_DELTA_HOURS = 2
JWT_LEEWAY_SECONDS = int(os.getenv("JWT_LEEWAY_SECONDS", "120"))
JWT_VERIFY_IAT = os.getenv("JWT_VERIFY_IAT", "").strip().lower() in ("1", "true", "yes", "y", "on")
ACCESS_TOKEN_TTL_SECONDS = int(os.getenv("ACCESS_TOKEN_TTL_SECONDS", "900"))
REFRESH_TOKEN_TTL_SECONDS = int(os.getenv("REFRESH_TOKEN_TTL_SECONDS", "1209600"))
OTP_VALID_WINDOW = int(os.getenv("OTP_VALID_WINDOW", "2"))
COOKIE_SECURE = os.getenv("COOKIE_SECURE", "").strip().lower() in ("1", "true", "yes", "y", "on")
COOKIE_SAMESITE = os.getenv("COOKIE_SAMESITE", "Lax")

POOL_SIZE = int(os.getenv("POOL_SIZE", "10"))
MAX_OVERFLOW = int(os.getenv("MAX_OVERFLOW", "20"))
POOL_TIMEOUT = int(os.getenv("POOL_TIMEOUT", "30"))
POOL_RECYCLE = int(os.getenv("POOL_RECYCLE", "1800"))
VALKEY_ADDRESS = os.getenv("VALKEY_ADDRESS") or os.getenv("VALKEY_HOST", "localhost")
VALKEY_PORT = os.getenv("VALKEY_PORT", "6379")
USE_CLUSTER = os.getenv("USE_CLUSTER")
IS_STAND_ALONE = os.getenv("IS_STAND_ALONE")
VALKEY_CONFIG = f"redis://{VALKEY_ADDRESS}:{VALKEY_PORT}/0"
LOG_QUEUE = os.getenv("LOG_QUEUE", "API_LOG")

CURRENT_ENVIRONMENT = os.getenv("CURRENT_ENVIRONMENT", "development")
PASSWORD_CHECK_URL = os.getenv("PASSWORD_CHECK_URL")
MIN_PASSWORD_LENGTH = os.getenv("MIN_PASSWORD_LENGTH")

SMTP_USERNAME = os.getenv("SMTP_USERNAME")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
SMTP_SERVER = os.getenv("SMTP_SERVER")
SMTP_PORT = os.getenv("SMTP_PORT") or os.getenv("SMPT_PORT")
DEFAULT_MAIL_SENDER = os.getenv("DEFAULT_MAIL_SENDER")
INVITE_URL = os.getenv("INVITE_URL")
PASSWORD_RESET_URL = os.getenv("PASSWORD_RESET_URL")
FRONTEND_BASE_URL = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173")

# Qdrant
QDRANT_URL = os.getenv("QDRANT_URL", "http://localhost:6333")
QDRANT_API_KEY = os.getenv("QDRANT_API_KEY", "")
QDRANT_TIMEOUT_S = int(os.getenv("QDRANT_TIMEOUT_S", "30"))
QDRANT_DOMAIN_COLLECTION = os.getenv("QDRANT_DOMAIN_COLLECTION", "domain_catalog")
QDRANT_TABLE_COLLECTION = os.getenv("QDRANT_TABLE_COLLECTION", "table_catalog")
QDRANT_COLUMN_COLLECTION = os.getenv("QDRANT_COLUMN_COLLECTION", "column_catalog")
QDRANT_COLUMN_COLLECTION_V2 = os.getenv("QDRANT_COLUMN_COLLECTION_V2", "column_catalog_v2")
