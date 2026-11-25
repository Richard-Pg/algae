"""In-memory stand-ins for the parts of the Supabase client the API uses."""

import copy
import uuid
from datetime import datetime, timezone
from types import SimpleNamespace


class _Query:
    def __init__(self, store, table):
        self.store, self.table = store, table
        self.filters, self.op, self.payload = [], "select", None
        self.count_mode, self.head = None, False
        self._order, self._range, self._limit = None, None, None

    # builders -----------------------------------------------------------
    def select(self, *_cols, count=None, head=False):
        self.op, self.count_mode, self.head = "select", count, head
        return self

    def insert(self, payload):
        self.op, self.payload = "insert", payload
        return self

    def upsert(self, payload):
        self.op, self.payload = "upsert", payload
        return self

    def update(self, payload):
        self.op, self.payload = "update", payload
        return self

    def delete(self):
        self.op = "delete"
        return self

    def eq(self, col, value):
        self.filters.append(("eq", col, value))
        return self

    def ilike(self, col, value):
        self.filters.append(("ilike", col, value))
        return self

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def range(self, start, end):
        self._range = (start, end)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def single(self):
        self._limit = 1
        return self

    # evaluation ---------------------------------------------------------
    def _value(self, row, col):
        if "->>" in col:
            base, key = col.split("->>")
            value = (row.get(base) or {}).get(key)
            return str(value).lower() if isinstance(value, bool) else value
        return row.get(col)

    def _match(self, row):
        for kind, col, value in self.filters:
            current = self._value(row, col)
            if kind == "eq" and current != value:
                return False
            if kind == "ilike" and str(current or "").lower() != str(value).lower():
                return False
        return True

    def execute(self):
        rows = self.store.setdefault(self.table, [])
        if self.op in ("insert", "upsert"):
            items = self.payload if isinstance(self.payload, list) else [self.payload]
            out = []
            for item in items:
                row = {"id": str(uuid.uuid4()), "created_at": datetime.now(timezone.utc).isoformat(), **copy.deepcopy(item)}
                if self.op == "upsert" and "key" in item:
                    rows[:] = [r for r in rows if r.get("key") != item["key"]]
                rows.append(row)
                out.append(copy.deepcopy(row))
            return SimpleNamespace(data=out, count=None)
        matched = [r for r in rows if self._match(r)]
        if self.op == "update":
            for r in matched:
                r.update(copy.deepcopy(self.payload))
            return SimpleNamespace(data=copy.deepcopy(matched), count=None)
        if self.op == "delete":
            rows[:] = [r for r in rows if r not in matched]
            return SimpleNamespace(data=matched, count=None)
        if self._order:
            col, desc = self._order
            matched.sort(key=lambda r: str(r.get(col) or ""), reverse=desc)
        total = len(matched)
        if self._range:
            matched = matched[self._range[0]: self._range[1] + 1]
        if self._limit is not None:
            matched = matched[: self._limit]
        return SimpleNamespace(data=[] if self.head else copy.deepcopy(matched), count=total if self.count_mode else None)


class _Bucket:
    def __init__(self, objects, name):
        self.objects, self.name = objects, name

    def upload(self, path, data, _opts=None):
        self.objects[(self.name, path)] = data

    def download(self, path):
        return self.objects[(self.name, path)]

    def remove(self, paths):
        for p in paths:
            self.objects.pop((self.name, p), None)

    def get_public_url(self, path):
        return f"https://public.example/{self.name}/{path}"

    def create_signed_url(self, path, _ttl):
        return {"signedURL": f"https://signed.example/{self.name}/{path}"}

    def create_signed_urls(self, paths, _ttl):
        return [{"path": p, "signedURL": f"https://signed.example/{self.name}/{p}"} for p in paths]


class FakeSupabase:
    def __init__(self):
        self.store = {}
        self.objects = {}
        self.storage = SimpleNamespace(from_=lambda name: _Bucket(self.objects, name))

    def table(self, name):
        return _Query(self.store, name)
