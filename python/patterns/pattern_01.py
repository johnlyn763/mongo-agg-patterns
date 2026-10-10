"""
Pattern 1 — Time-bucket totals
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_DB = "sample_supplies"
DEFAULT_COLL = "sales"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the time-bucket totals pipeline.

    opts keys:
      timezone: str  (default 'America/New_York')
      unit: str      (default 'day')  # 'day' | 'week' | 'month'
      start: datetime  inclusive lower bound on saleDate
      end: datetime    exclusive upper bound on saleDate
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
                "lineItems": {"$sum": 1},
                "sales": {"$addToSet": "$_id"},
            },
        },
        {
            "$project": {
                "_id": 0,
                "bucketStart": "$_id",
                "revenue": 1,
                "lineItems": 1,
                "sales": {"$size": "$sales"},
            },
        },
        {"$sort": {"bucketStart": 1}},
    ]


def get_exploration_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Exploration path from the manuscript: early $match + $limit so later
    stages can be commented out while inspecting intermediates.
    """
    opts = opts or {}
    start = opts.get("start", datetime(2015, 1, 1, tzinfo=timezone.utc))
    end = opts.get("end", datetime(2016, 1, 1, tzinfo=timezone.utc))
    limit = opts.get("limit", 3)

    return [
        {
            "$match": {
                "saleDate": {
                    "$gte": start,
                    "$lt": end,
                },
            },
        },
        {"$limit": limit},
    ]
