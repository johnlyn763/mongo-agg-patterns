"""Pattern 7 — Faceted dashboard: live invariants (parity with Node tests)."""

from __future__ import annotations

from datetime import datetime

import pytest

from pattern_07 import DEFAULT_COLL, DEFAULT_DB, get_pipeline


@pytest.fixture(scope="module")
def payload(client):
    coll = client[DEFAULT_DB][DEFAULT_COLL]
    results = list(coll.aggregate(get_pipeline({"recentLimit": 10})))
    assert len(results) == 1
    return results[0]


def test_has_facet_keys(payload):
    assert isinstance(payload["kpis"], list)
    assert isinstance(payload["byStore"], list)
    assert isinstance(payload["recent"], list)


def test_kpis_shape(payload):
    assert len(payload["kpis"]) == 1
    k = payload["kpis"][0]
    assert isinstance(k["sales"], int)
    assert k["sales"] > 0
    assert isinstance(k["coupons"], int)
    assert 0 <= k["coupons"] <= k["sales"]
    assert isinstance(k["avgSatisfaction"], (int, float))


def test_by_store_sorted_and_sums_to_kpis(payload):
    assert len(payload["byStore"]) > 0
    total = 0
    for i, row in enumerate(payload["byStore"]):
        assert isinstance(row["store"], str)
        assert isinstance(row["sales"], int)
        assert row["sales"] > 0
        total += row["sales"]
        if i > 0:
            assert payload["byStore"][i - 1]["sales"] >= row["sales"]
    assert total == payload["kpis"][0]["sales"]


def test_recent_bounded_and_sorted(payload):
    assert len(payload["recent"]) > 0
    assert len(payload["recent"]) <= 10
    for i, r in enumerate(payload["recent"]):
        assert isinstance(r["saleDate"], datetime)
        assert isinstance(r["storeLocation"], str)
        assert isinstance(r["purchaseMethod"], str)
        assert isinstance(r["email"], str)
        if i > 0:
            assert payload["recent"][i - 1]["saleDate"] >= r["saleDate"]
