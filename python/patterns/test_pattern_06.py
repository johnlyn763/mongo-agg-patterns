"""Pattern 6 — Lookup report (sample_mflix): live invariants (parity with Node)."""

from __future__ import annotations

from datetime import datetime

import pytest

from pattern_06 import DEFAULT_COLL, DEFAULT_DB, get_pipeline

LIMIT = 50


@pytest.fixture(scope="module")
def results(client):
    coll = client[DEFAULT_DB][DEFAULT_COLL]
    return list(coll.aggregate(get_pipeline({"limit": LIMIT})))


def test_returns_at_most_limit_movies(results):
    assert isinstance(results, list)
    assert len(results) > 0
    assert len(results) <= LIMIT


def test_shape(results):
    for doc in results:
        assert isinstance(doc["title"], str)
        assert len(doc["title"]) > 0
        assert isinstance(doc["year"], int)
        assert doc["year"] >= 2000
        assert "imdbRating" in doc
        assert isinstance(doc["commentCount"], int)
        assert doc["commentCount"] >= 0
        if doc["commentCount"] > 0:
            assert isinstance(doc["latestCommentAt"], datetime)
        else:
            assert doc["latestCommentAt"] is None


def test_sorted_by_comment_count_desc_then_title(results):
    for i in range(1, len(results)):
        a = results[i - 1]
        b = results[i]
        if a["commentCount"] == b["commentCount"]:
            assert a["title"] <= b["title"]
        else:
            assert a["commentCount"] >= b["commentCount"]


def test_at_least_one_movie_has_comments(results):
    with_comments = [d for d in results if d["commentCount"] > 0]
    assert len(with_comments) > 0, "expected some movies with comments"
