"""
Pattern 2 — Top-N per category
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_DB = "sample_supplies"
DEFAULT_COLL = "sales"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the top-N per category pipeline.

    opts keys:
      n: int         (default 5)
      start: datetime  inclusive lower bound on saleDate
      end: datetime    exclusive upper bound on saleDate
    """
    opts = opts or {}
    n = opts.get("n", 5)
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
        {"$unwind": "$items"},
        {
            "$set": {
                "lineRevenue": {"$multiply": ["$items.price", "$items.quantity"]},
            },
        },
        {
            "$group": {
                "_id": {
                    "store": "$storeLocation",
                    "product": "$items.name",
                },
                "revenue": {"$sum": "$lineRevenue"},
                "units": {"$sum": "$items.quantity"},
            },
        },
        {"$sort": {"_id.store": 1, "revenue": -1}},
        {
            "$group": {
                "_id": "$_id.store",
                "topProducts": {
                    "$push": {
                        "product": "$_id.product",
                        "revenue": "$revenue",
                        "units": "$units",
                    },
                },
            },
        },
        {
            "$project": {
                "_id": 0,
                "store": "$_id",
                "topProducts": {"$slice": ["$topProducts", n]},
            },
        },
        {"$sort": {"store": 1}},
    ]
