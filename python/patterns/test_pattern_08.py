"""Pattern 8 — Histogram: live invariants (parity with Node tests)."""

from __future__ import annotations

import pytest
from bson.decimal128 import Decimal128

from pattern_08 import DEFAULT_COLL, DEFAULT_DB, get_pipeline


def bucket_id_key(value) -> str:
    if isinstance(value, Decimal128):
        return str(value)
    return str(value)


@pytest.fixture(scope="module")
def results(client):
    coll = client[DEFAULT_DB][DEFAULT_COLL]
    return list(coll.aggregate(get_pipeline()))


def test_returns_nonempty_buckets(results):
    assert isinstance(results, list)
    assert len(results) > 0


def test_each_bucket_has_id_count_units(results):
    for doc in results:
        assert "_id" in doc
        assert isinstance(doc["count"], int)
        assert doc["count"] > 0
        assert isinstance(doc["units"], int)
        assert doc["units"] >= doc["count"], "units should be >= count (quantity per line)"


def test_bucket_ids_are_known_boundaries_or_other(results):
    allowed = {"0", "10", "25", "50", "100", "other"}
    for doc in results:
        key = bucket_id_key(doc["_id"])
        assert key in allowed, f"unexpected bucket _id {key}"


def test_total_count_substantial(results):
    total = sum(d["count"] for d in results)
    assert total > 100
