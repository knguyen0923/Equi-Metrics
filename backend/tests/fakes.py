"""A tiny in-memory stand-in for the pymongo collections the app talks to.

The app has no ORM layer — routers call find_one/insert_one/update_one/find
directly on collection objects (see app/db.py) — so tests fake out just
those methods instead of pulling in a real MongoDB (or a heavier library
like mongomock, which doesn't yet support pymongo's newer AsyncMongoClient
API). This keeps tests hermetic: no network access, no leftover test data
in Atlas, and they run the same whether or not a real .env is configured.

Only the filter/update shapes this app actually uses are supported
(plain-equality filters, $set/$inc/$unset updates) — it's a fake, not a
reimplementation of MongoDB.
"""

from bson import ObjectId


def _matches(doc: dict, filter: dict) -> bool:
    return all(doc.get(key) == value for key, value in filter.items())


def _apply_update(doc: dict, update: dict) -> None:
    for key, value in update.get("$set", {}).items():
        doc[key] = value
    for key, value in update.get("$inc", {}).items():
        doc[key] = doc.get(key, 0) + value
    for key in update.get("$unset", {}):
        doc.pop(key, None)


class FakeCursor:
    """Mimics the chainable find().sort().skip().limit() cursor, async-iterable."""

    def __init__(self, docs: list[dict]):
        self._docs = list(docs)

    def sort(self, field: str, direction: int = 1):
        self._docs.sort(key=lambda d: d.get(field), reverse=direction < 0)
        return self

    def skip(self, n: int):
        self._docs = self._docs[n:]
        return self

    def limit(self, n: int):
        self._docs = self._docs[:n]
        return self

    def __aiter__(self):
        return self._iter()

    async def _iter(self):
        for doc in self._docs:
            yield dict(doc)


class FakeCollection:
    """Drop-in replacement for a pymongo AsyncMongoClient collection, backed
    by a plain dict keyed on _id. Good enough for the queries this app runs.
    """

    def __init__(self):
        self.docs: dict[ObjectId, dict] = {}

    async def create_index(self, *args, **kwargs):
        # Indexes don't matter for correctness in tests, only performance.
        return None

    async def find_one(self, filter: dict):
        for doc in self.docs.values():
            if _matches(doc, filter):
                return dict(doc)
        return None

    async def insert_one(self, doc: dict):
        new_doc = dict(doc)
        new_doc.setdefault("_id", ObjectId())
        self.docs[new_doc["_id"]] = new_doc

        class _Result:
            inserted_id = new_doc["_id"]

        return _Result()

    async def update_one(self, filter: dict, update: dict):
        for doc in self.docs.values():
            if _matches(doc, filter):
                _apply_update(doc, update)
                return

    def find(self, filter: dict | None = None):
        filter = filter or {}
        return FakeCursor([doc for doc in self.docs.values() if _matches(doc, filter)])
