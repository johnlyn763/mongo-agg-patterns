"""
Pattern 9 — Active vs churned in a window
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_DB = "sample_supplies"
DEFAULT_COLL = "sales"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the active-vs-churned pipeline.

    opts keys:
      windowStart: datetime
      windowEnd: datetime
      historyStart: datetime
    """
    opts = opts or {}
    window_start = opts.get("windowStart", datetime(2015, 10, 1, tzinfo=timezone.utc))
    window_end = opts.get("windowEnd", datetime(2016, 1, 1, tzinfo=timezone.utc))
    history_start = opts.get("historyStart", datetime(2015, 1, 1, tzinfo=timezone.utc))

    return [
        {
            "$match": {
                "saleDate": {"$gte": history_start, "$lt": window_end},
                "customer.email": {"$exists": True, "$ne": None},
            },
        },
        {
            "$group": {
                "_id": "$customer.email",
                "firstSale": {"$min": "$saleDate"},
                "lastSale": {"$max": "$saleDate"},
                "sales": {"$sum": 1},
            },
        },
        {
            "$set": {
                "status": {
                    "$switch": {
                        "branches": [
                            {
                                "case": {
                                    "$and": [
                                        {"$gte": ["$lastSale", window_start]},
                                        {"$lt": ["$lastSale", window_end]},
                                    ],
                                },
                                "then": "active",
                            },
                            {
                                "case": {
                                    "$and": [
                                        {"$lt": ["$lastSale", window_start]},
                                        {"$gte": ["$firstSale", history_start]},
                                    ],
                                },
                                "then": "churned",
                            },
                        ],
                        "default": "other",
                    },
                },
            },
        },
        {
            "$group": {
                "_id": "$status",
                "customers": {"$sum": 1},
                "sales": {"$sum": "$sales"},
            },
        },
        {
            "$project": {
                "_id": 0,
                "status": "$_id",
                "customers": 1,
                "sales": 1,
            },
        },
        {"$sort": {"status": 1}},
    ]
