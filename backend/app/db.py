# MongoDB connection, created once at import time and reused for the life
# of the process (not per-request) so requests share a connection pool.
#
# Uses pymongo's native async API (AsyncMongoClient), not the older `motor`
# package — motor is in maintenance-only mode and heading toward end of
# life, while pymongo's async client is the actively maintained replacement
# with the same async/await shape.
import logging

from pymongo import AsyncMongoClient
from pymongo.asynchronous.collection import AsyncCollection

from app.config import settings

logger = logging.getLogger(__name__)

client: AsyncMongoClient = AsyncMongoClient(settings.mongodb_uri)
db = client[settings.mongodb_db_name]

# Raw collection handles. Routers/dependencies reach these only through the
# get_*_collection() functions below (via FastAPI's Depends) rather than
# importing the names directly — that way a test only has to monkeypatch
# these two module attributes, not every module that would otherwise bind
# its own local name via `from app.db import ...`.
users_collection = db["users"]
simulations_collection = db["simulations"]


def get_users_collection() -> AsyncCollection:
    return users_collection


def get_simulations_collection() -> AsyncCollection:
    return simulations_collection


async def init_indexes() -> None:
    """Create indexes once at app startup (called from main.py's lifespan).

    - users.email: unique, so two accounts can never share an email.
    - users.reset_token_hash: sparse, since most users don't have a pending
      reset token at any given time.
    - simulations (user_id, created_at): supports the paginated, most-recent
      -first history query in routers/simulations.py.

    Wrapped in try/except so a slow or unreachable MongoDB Atlas cluster
    can't prevent the app (and its /health check) from starting up.
    """
    try:
        await users_collection.create_index("email", unique=True)
        await users_collection.create_index("reset_token_hash", sparse=True)
        await simulations_collection.create_index([("user_id", 1), ("created_at", -1)])
    except Exception as exc:  # best-effort at boot; don't block startup on a slow/unreachable Atlas cluster
        logger.warning("Index creation skipped: %s", exc)
