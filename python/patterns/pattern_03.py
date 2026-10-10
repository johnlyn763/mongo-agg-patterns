"""
Pattern 3 — Running totals / cumulative series
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_DB = "sample_supplies"
DEFAULT_COLL = "sales"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the running-totals pipeline.

    opts keys:
      timezone: str  (default 'America/New_York')
      unit: str      (default 'day')
      start: datetime
      end: datetime
    """
    opts = opts or {}
    tz_name = opts.get("timezone", "America/New_York")
    unit = opts.get("unit", "day")
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
                    "$dateTrunc": {
                        "date": "$saleDate",
                        "unit": unit,
                        "timezone": tz_name,
                    },
                },
                "revenue": {"$sum": "$lineRevenue"},
            },
        },
        {
            "$project": {
                "_id": 0,
                "bucketStart": "$_id",
                "revenue": 1,
            },
        },
        {
            "$setWindowFields": {
                "sortBy": {"bucketStart": 1},
                "output": {
                    "runningRevenue": {
                        "$sum": "$revenue",
                        "window": {"documents": ["unbounded", "current"]},
                    },
                },
            },
        },
        {"$sort": {"bucketStart": 1}},
    ]
