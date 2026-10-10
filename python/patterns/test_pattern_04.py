"""Pattern 4 — Period-over-period: live invariants (parity with Node tests)."""

from __future__ import annotations

from datetime import datetime

import pytest
from bson.decimal128 import Decimal128

from pattern_04 import DEFAULT_COLL, DEFAULT_DB, get_pipeline


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


def test_returns_nonempty_monthly_periods(results):
    assert isinstance(results, list)
    assert len(results) >= 2, "need at least two periods for prior/delta"


def test_shape_and_first_row_null_prior(results):
    assert results[0]["priorRevenue"] is None
    assert results[0]["pctChange"] is None

    for i, doc in enumerate(results):
        assert isinstance(doc["periodStart"], datetime)
        assert doc["revenue"] is not None
        assert "delta" in doc
        assert "pctChange" in doc
        if i == 0:
            assert doc["priorRevenue"] is None
        else:
            assert doc["priorRevenue"] is not None
            prior = to_number(doc["priorRevenue"])
            rev = to_number(doc["revenue"])
            delta = to_number(doc["delta"])
            diff = abs(delta - (rev - prior))
            assert diff < 1e-4 or diff / max(1, abs(rev)) < 1e-9


def test_period_start_sorted_ascending_unique(results):
    keys = [d["periodStart"] for d in results]
    assert len(set(keys)) == len(keys)
    for i in range(1, len(keys)):
        assert keys[i - 1] < keys[i]


def test_prior_equals_previous_revenue(results):
    for i in range(1, len(results)):
        assert str(results[i]["priorRevenue"]) == str(results[i - 1]["revenue"])
