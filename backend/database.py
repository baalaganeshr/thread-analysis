import os
from dataclasses import dataclass
from typing import Optional

from pymongo import MongoClient

try:
    from qdrant_client import QdrantClient
except Exception:  # pragma: no cover
    QdrantClient = None  # type: ignore


@dataclass
class DBState:
    mongo_client: Optional[MongoClient] = None
    db: Optional[object] = None
    mongo_ok: bool = False
    qdrant_client: Optional[object] = None
    qdrant_ok: bool = False
    redis_client: Optional[object] = None
    redis_ok: bool = False

    async def init(self) -> None:
        # Mongo
        mongo_uri = os.getenv("MONGODB_URI", "mongodb://localhost:27017")
        mongo_db = os.getenv("MONGODB_DB", "cyberguard")
        try:
            self.mongo_client = MongoClient(mongo_uri, serverSelectionTimeoutMS=1000)
            self.mongo_client.admin.command("ping")
            self.db = self.mongo_client[mongo_db]
            # basic collection touch
            self.db["events"].create_index("timestamp")
            self.db["nodes"].create_index("id", unique=True)
            self.mongo_ok = True
        except Exception:
            self.mongo_client = None
            self.db = None
            self.mongo_ok = False

        # Qdrant
        try:
            if QdrantClient is not None:
                url = os.getenv("QDRANT_URL")
                host = os.getenv("QDRANT_HOST", "localhost")
                port = int(os.getenv("QDRANT_PORT", "6333"))
                if url:
                    self.qdrant_client = QdrantClient(url=url, timeout=1.0)
                else:
                    self.qdrant_client = QdrantClient(host=host, port=port, timeout=1.0)
                # soft check
                self.qdrant_client.get_collections()
                self.qdrant_ok = True
        except Exception:
            self.qdrant_client = None
            self.qdrant_ok = False

        # Redis (optional)
        try:
            import redis  # type: ignore

            redis_url = os.getenv("REDIS_URL", "redis://localhost:6379/0")
            self.redis_client = redis.Redis.from_url(redis_url, socket_connect_timeout=1.0)
            # ping
            self.redis_client.ping()
            self.redis_ok = True
        except Exception:
            self.redis_client = None
            self.redis_ok = False


db_state = DBState()
