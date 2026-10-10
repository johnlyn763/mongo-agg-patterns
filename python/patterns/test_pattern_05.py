"""Pattern 5 — Null-safe metrics: live invariants (parity with Node tests)."""

from __future__ import annotations

import pytest
from bson.decimal128 import Decimal128

from pattern_05 import DEFAULT_COLL, DEFAULT_DB, get_pipeline


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


def test_returns_nonempty_store_metrics(results):
    assert isinstance(results, list)
    assert len(results) > 0


def test_shape(results):
    for doc in results:
        assert isinstance(doc["store"], str)
        assert isinstance(doc["sales"], int)
        assert doc["sales"] > 0
        assert isinstance(doc["avgSatisfaction"], (int, float))
        assert 1 <= doc["avgSatisfaction"] <= 5
        assert isinstance(doc["couponRate"], (int, float))
        assert 0 <= doc["couponRate"] <= 1
        assert doc["revenue"] is not None
        assert to_number(doc["revenue"]) > 0
        assert doc["revenuePerSale"] is not None
        assert to_number(doc["revenuePerSale"]) > 0


def test_stores_sorted_ascending_unique(results):
    stores = [d["store"] for d in results]
    assert len(set(stores)) == len(stores)
    for i in range(1, len(stores)):
        assert stores[i - 1] <= stores[i]


def test_revenue_per_sale_consistent(results):
    for doc in results:
        rps = to_number(doc["revenuePerSale"])
        rev = to_number(doc["revenue"])
        expected = rev / doc["sales"]
        assert abs(rps - expected) / max(1, expected) < 1e-6 or abs(rps - expected) < 0.01
