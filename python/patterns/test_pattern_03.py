"""Pattern 3 — Running totals: live invariants (parity with Node tests)."""

from __future__ import annotations

from datetime import datetime

import pytest
from bson.decimal128 import Decimal128

from pattern_03 import DEFAULT_COLL, DEFAULT_DB, get_pipeline


def to_number(value) -> float:
    if value is None:
        return float("nan")
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, Decimal128):
        return float(value.to_decimal())
    if hasattr(value, "to_decimal"):
        return float(value.to_decimal())
    return float(value)


@pytest.fixture(scope="module")
def results(client):
    coll = client[DEFAULT_DB][DEFAULT_COLL]
    return list(coll.aggregate(get_pipeline()))


def test_returns_nonempty_daily_buckets(results):
    assert isinstance(results, list)
    assert len(results) > 0


def test_each_doc_has_bucket_start_revenue_running(results):
    for doc in results:
        assert isinstance(doc["bucketStart"], datetime)
        assert doc["revenue"] is not None
        assert doc["runningRevenue"] is not None


def test_bucket_start_sorted_ascending_unique(results):
    keys = [d["bucketStart"] for d in results]
    assert len(set(keys)) == len(keys)
    for i in range(1, len(keys)):
        assert keys[i - 1] < keys[i], "strictly ascending unique buckets"


def test_running_revenue_cumulative(results):
    cum = 0.0
    for doc in results:
        rev = to_number(doc["revenue"])
        run = to_number(doc["runningRevenue"])
        assert rev == rev and abs(rev) != float("inf") and rev > 0
        assert run == run and abs(run) != float("inf")
        cum += rev
        assert abs(run - cum) < max(1e-4, abs(cum) * 1e-9), (
            f"runningRevenue {run} vs cum {cum}"
        )
    assert to_number(results[-1]["runningRevenue"]) >= to_number(
        results[0]["runningRevenue"]
    )
