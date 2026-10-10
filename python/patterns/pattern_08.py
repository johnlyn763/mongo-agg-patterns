"""
Pattern 8 — Histogram / distribution
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from bson.decimal128 import Decimal128

DEFAULT_DB = "sample_supplies"
DEFAULT_COLL = "sales"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the histogram pipeline.

    opts keys:
      start: datetime
      end: datetime
      boundaries: list[Decimal128]
      defaultBucket: Any  (default 'other')
    """
    opts = opts or {}
    start = opts.get("start", datetime(2015, 1, 1, tzinfo=timezone.utc))
    end = opts.get("end", datetime(2016, 1, 1, tzinfo=timezone.utc))
    boundaries = opts.get(
        "boundaries",
        [
            Decimal128("0"),
            Decimal128("10"),
            Decimal128("25"),
            Decimal128("50"),
            Decimal128("100"),
            Decimal128("500"),
        ],
    )
    default_bucket = opts.get("defaultBucket", "other")

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
            "$bucket": {
                "groupBy": "$items.price",
                "boundaries": boundaries,
                "default": default_bucket,
                "output": {
                    "count": {"$sum": 1},
                    "units": {"$sum": "$items.quantity"},
                },
            },
        },
    ]
