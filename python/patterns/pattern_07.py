"""
Pattern 7 — Faceted dashboard payload
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_DB = "sample_supplies"
DEFAULT_COLL = "sales"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the faceted dashboard pipeline.

    opts keys:
      start: datetime
      end: datetime
      recentLimit: int  (default 10)
    """
    opts = opts or {}
    start = opts.get("start", datetime(2015, 1, 1, tzinfo=timezone.utc))
    end = opts.get("end", datetime(2016, 1, 1, tzinfo=timezone.utc))
    recent_limit = opts.get("recentLimit", 10)

    return [
        {
            "$match": {
                "saleDate": {
                    "$gte": start,
                    "$lt": end,
                },
            },
        },
        {
            "$facet": {
                "kpis": [
                    {
                        "$group": {
                            "_id": None,
                            "sales": {"$sum": 1},
                            "coupons": {
                                "$sum": {"$cond": ["$couponUsed", 1, 0]},
                            },
                            "avgSatisfaction": {"$avg": "$customer.satisfaction"},
                        },
                    },
                    {"$project": {"_id": 0}},
                ],
                "byStore": [
                    {
                        "$group": {
                            "_id": "$storeLocation",
                            "sales": {"$sum": 1},
                        },
                    },
                    {
                        "$project": {
                            "_id": 0,
                            "store": "$_id",
                            "sales": 1,
                        },
                    },
                    {"$sort": {"sales": -1}},
                ],
                "recent": [
                    {"$sort": {"saleDate": -1}},
                    {"$limit": recent_limit},
                    {
                        "$project": {
                            "_id": 0,
                            "saleDate": 1,
                            "storeLocation": 1,
                            "purchaseMethod": 1,
                            "email": "$customer.email",
                        },
                    },
                ],
            },
        },
    ]
