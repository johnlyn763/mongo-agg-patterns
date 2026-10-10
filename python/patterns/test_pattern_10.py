"""Pattern 10 — Pagination: live invariants (parity with Node tests)."""

from __future__ import annotations

from datetime import datetime

import pytest
from bson import ObjectId

from pattern_10 import (
    DEFAULT_COLL,
    DEFAULT_DB,
    get_keyset_pipeline,
    get_pipeline,
)

PAGE_SIZE = 25


@pytest.fixture(scope="module")
def coll(client):
    return client[DEFAULT_DB][DEFAULT_COLL]


@pytest.fixture(scope="module")
def page0(coll):
    results = list(coll.aggregate(get_pipeline({"pageSize": PAGE_SIZE, "page": 0})))
    assert len(results) == 1
    return results[0]


def test_facet_form_returns_rows_and_total(page0):
    assert isinstance(page0["rows"], list)
    assert isinstance(page0["total"], int)
    assert page0["total"] > PAGE_SIZE
    assert len(page0["rows"]) == PAGE_SIZE


def test_row_shape(page0):
    for row in page0["rows"]:
        assert isinstance(row["_id"], ObjectId)
        assert isinstance(row["saleDate"], datetime)
        assert isinstance(row["storeLocation"], str)
        assert isinstance(row["purchaseMethod"], str)
        assert isinstance(row["email"], str)
        assert isinstance(row["itemCount"], int)
        assert row["itemCount"] >= 0


def test_rows_sorted_sale_date_desc_id_desc(page0):
    for i in range(1, len(page0["rows"])):
        a = page0["rows"][i - 1]
        b = page0["rows"][i]
        if a["saleDate"] == b["saleDate"]:
            assert a["_id"] >= b["_id"]
        else:
            assert a["saleDate"] > b["saleDate"]


def test_page1_disjoint_same_total(coll, page0):
    page1 = list(coll.aggregate(get_pipeline({"pageSize": PAGE_SIZE, "page": 1})))[0]
    assert page1["total"] == page0["total"]
    assert len(page1["rows"]) == PAGE_SIZE
    ids0 = {str(r["_id"]) for r in page0["rows"]}
    for r in page1["rows"]:
        assert str(r["_id"]) not in ids0, "pages should not overlap"
    last0 = page0["rows"][-1]
    first1 = page1["rows"][0]
    if last0["saleDate"] == first1["saleDate"]:
        assert last0["_id"] > first1["_id"]
    else:
        assert last0["saleDate"] > first1["saleDate"]


def test_keyset_continues_after_page0(coll, page0):
    last = page0["rows"][-1]
    keyset = list(
        coll.aggregate(
            get_keyset_pipeline(
                {
                    "pageSize": PAGE_SIZE,
                    "lastSaleDate": last["saleDate"],
                    "lastId": last["_id"],
                }
            )
        )
    )
    assert len(keyset) > 0
    assert len(keyset) <= PAGE_SIZE
    page1 = list(coll.aggregate(get_pipeline({"pageSize": PAGE_SIZE, "page": 1})))[0]
    assert str(keyset[0]["_id"]) == str(page1["rows"][0]["_id"])
