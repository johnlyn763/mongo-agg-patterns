"""Pattern 2 — Top-N per category: live invariants (parity with Node tests)."""

from __future__ import annotations

import pytest
from bson.decimal128 import Decimal128

from pattern_02 import DEFAULT_COLL, DEFAULT_DB, get_pipeline

N = 5


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
    return list(coll.aggregate(get_pipeline({"n": N})))


def test_returns_nonempty_array_of_stores(results):
    assert isinstance(results, list)
    assert len(results) > 0, "expected at least one store"


def test_each_doc_has_store_and_top_products(results):
    for doc in results:
        assert isinstance(doc["store"], str)
        assert isinstance(doc["topProducts"], list)
        assert len(doc["topProducts"]) > 0
        assert len(doc["topProducts"]) <= N, (
            f"topProducts length {len(doc['topProducts'])} > n={N}"
        )


def test_stores_sorted_ascending(results):
    for i in range(1, len(results)):
        assert results[i - 1]["store"] <= results[i]["store"]


def test_no_duplicate_stores(results):
    stores = [d["store"] for d in results]
    assert len(set(stores)) == len(stores)


def test_products_shape_and_revenue_descending(results):
    for doc in results:
        for i, p in enumerate(doc["topProducts"]):
            assert isinstance(p["product"], str)
            assert p["revenue"] is not None
            assert isinstance(p["units"], int)
            assert p["units"] > 0
            rev = to_number(p["revenue"])
            assert rev == rev and abs(rev) != float("inf") and rev > 0
            if i > 0:
                prev = to_number(doc["topProducts"][i - 1]["revenue"])
                assert prev >= rev, "revenue should be descending within store"
