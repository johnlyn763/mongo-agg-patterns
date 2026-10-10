"""
Pattern 4 — Period-over-period
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

DEFAULT_DB = "sample_supplies"
DEFAULT_COLL = "sales"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the period-over-period pipeline.

    opts keys:
      timezone: str  (default 'America/New_York')
      unit: str      (default 'month')
      start: datetime
      end: datetime
    """
    opts = opts or {}
    tz_name = opts.get("timezone", "America/New_York")
    unit = opts.get("unit", "month")
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
                "periodStart": "$_id",
                "revenue": 1,
            },
        },
        {
            "$setWindowFields": {
                "sortBy": {"periodStart": 1},
                "output": {
                    "priorRevenue": {
                        "$shift": {
                            "output": "$revenue",
                            "by": -1,
                        },
                    },
                },
            },
        },
        {
            "$set": {
                "delta": {
                    "$subtract": ["$revenue", {"$ifNull": ["$priorRevenue", 0]}],
                },
                "pctChange": {
                    "$cond": [
                        {
                            "$or": [
                                {"$eq": ["$priorRevenue", None]},
                                {"$eq": ["$priorRevenue", 0]},
                            ],
                        },
                        None,
                        {
                            "$multiply": [
                                {
                                    "$divide": [
                                        {"$subtract": ["$revenue", "$priorRevenue"]},
                                        "$priorRevenue",
                                    ],
                                },
                                100,
                            ],
                        },
                    ],
                },
            },
        },
        {"$sort": {"periodStart": 1}},
    ]
