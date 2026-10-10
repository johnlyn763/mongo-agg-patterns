"""Pattern 9 — Active vs churned: live invariants (parity with Node tests)."""

from __future__ import annotations

import pytest

from pattern_09 import DEFAULT_COLL, DEFAULT_DB, get_pipeline


@pytest.fixture(scope="module")
def results(client):
    coll = client[DEFAULT_DB][DEFAULT_COLL]
    return list(coll.aggregate(get_pipeline()))


def test_returns_status_rows(results):
    assert isinstance(results, list)
    assert len(results) > 0


def test_status_values_and_counts(results):
    allowed = {"active", "churned", "other"}
    seen = set()
    for doc in results:
        assert doc["status"] in allowed, f"unexpected status {doc['status']}"
        seen.add(doc["status"])
        assert isinstance(doc["customers"], int)
        assert doc["customers"] > 0
        assert isinstance(doc["sales"], int)
        assert doc["sales"] >= doc["customers"]
    assert "active" in seen, "expected active customers"
    assert "churned" in seen, "expected churned customers"


def test_statuses_sorted_ascending(results):
    for i in range(1, len(results)):
        assert results[i - 1]["status"] <= results[i]["status"]


def test_no_duplicate_status_keys(results):
    keys = [d["status"] for d in results]
    assert len(set(keys)) == len(keys)
