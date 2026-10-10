"""
Pattern 10 — Pagination-friendly report pages
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_DB = "sample_supplies"
DEFAULT_COLL = "sales"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the facet pagination pipeline (page + total).

    opts keys:
      pageSize: int  (default 25)
      page: int      zero-based (default 0)
      start: datetime
      end: datetime
    """
    opts = opts or {}
    page_size = opts.get("pageSize", 25)
    page = opts.get("page", 0)
    start = opts.get("start", datetime(2015, 1, 1, tzinfo=timezone.utc))
    end = opts.get("end", datetime(2016, 1, 1, tzinfo=timezone.utc))

    return [
        {
            "$match": {
                "saleDate": {
                    "$gte": start,
                    "$lt": end,
                },
            },
        },
        {"$sort": {"saleDate": -1, "_id": -1}},
        {
            "$facet": {
                "rows": [
                    {"$skip": page_size * page},
                    {"$limit": page_size},
                    {
                        "$project": {
                            "_id": 1,
                            "saleDate": 1,
                            "storeLocation": 1,
                            "purchaseMethod": 1,
                            "email": "$customer.email",
                            "itemCount": {"$size": {"$ifNull": ["$items", []]}},
                        },
                    },
                ],
                "meta": [{"$count": "total"}],
            },
        },
        {
            "$project": {
                "rows": 1,
                "total": {
                    "$ifNull": [{"$arrayElemAt": ["$meta.total", 0]}, 0],
                },
            },
        },
    ]


def get_keyset_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Keyset pagination variation (deep pages).

    opts keys:
      pageSize: int
      lastSaleDate: datetime  (required)
      lastId: ObjectId        (required)
    """
    opts = opts or {}
    page_size = opts.get("pageSize", 25)
    last_sale_date = opts["lastSaleDate"]
    last_id = opts["lastId"]

    return [
        {
            "$match": {
                "$or": [
                    {"saleDate": {"$lt": last_sale_date}},
                    {"saleDate": last_sale_date, "_id": {"$lt": last_id}},
                ],
            },
        },
        {"$sort": {"saleDate": -1, "_id": -1}},
        {"$limit": page_size},
        {
            "$project": {
                "_id": 1,
                "saleDate": 1,
                "storeLocation": 1,
                "purchaseMethod": 1,
                "email": "$customer.email",
            },
        },
    ]
