"""Pattern 1 — Time-bucket totals: live invariants (parity with Node tests)."""

from __future__ import annotations

from datetime import datetime

import pytest
from bson.decimal128 import Decimal128

from pattern_01 import (
    DEFAULT_COLL,
    DEFAULT_DB,
    get_exploration_pipeline,
    get_pipeline,
)


def to_number(value) -> float:
    """Convert Decimal128 / number / Long-ish values to a finite float."""
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


@pytest.fixture(scope="module")
def coll(client):
    return client[DEFAULT_DB][DEFAULT_COLL]


def test_returns_nonempty_array(results):
    assert isinstance(results, list)
    assert len(results) > 0, "2015 window should yield at least one bucket"


def test_each_doc_shape(results):
    for doc in results:
        assert isinstance(doc["bucketStart"], datetime), "bucketStart must be datetime"
        assert "revenue" in doc
        assert "lineItems" in doc
        assert "sales" in doc


def test_bucket_start_sorted_ascending(results):
    for i in range(1, len(results)):
        assert (
            results[i - 1]["bucketStart"] <= results[i]["bucketStart"]
        ), f"bucketStart not sorted at index {i}"


def test_no_duplicate_bucket_start(results):
    keys = [d["bucketStart"] for d in results]
    assert len(set(keys)) == len(keys), "duplicate bucketStart found"


def test_line_items_and_sales_positive(results):
    for doc in results:
        assert isinstance(doc["lineItems"], int)
        assert isinstance(doc["sales"], int)
        assert doc["lineItems"] > 0
        assert doc["sales"] > 0
        assert (
            doc["sales"] <= doc["lineItems"]
        ), f"sales ({doc['sales']}) should be <= lineItems ({doc['lineItems']})"


def test_revenue_decimal_or_convertible_sum_positive(results):
    total = 0.0
    for doc in results:
        is_decimal = isinstance(doc["revenue"], Decimal128)
        n = to_number(doc["revenue"])
        assert is_decimal or (n == n and abs(n) != float("inf")), (
            f"revenue should be Decimal128 or convertible number, got {type(doc['revenue'])}"
        )
        assert n == n and abs(n) != float("inf"), "revenue converts to finite number"
        assert n > 0, "each bucket revenue should be > 0"
        total += n
    assert total > 0, "sum of revenues for 2015 window should be > 0"


def test_exploration_match_limit(coll):
    docs = list(coll.aggregate(get_exploration_pipeline({"limit": 3})))
    assert isinstance(docs, list)
    assert len(docs) <= 3
    assert len(docs) >= 1, "exploration should find at least one 2015 sale"


def test_sample_first_row_shape(results):
    first = results[0]
    assert first is not None
    assert isinstance(first["bucketStart"], datetime)
    assert isinstance(first["revenue"], Decimal128) or isinstance(
        first["revenue"], (int, float)
    )
    assert isinstance(first["lineItems"], int)
    assert isinstance(first["sales"], int)
