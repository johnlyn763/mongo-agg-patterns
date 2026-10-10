"""
Pattern 5 — Null-safe metrics
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
    Build the null-safe metrics pipeline.

    opts keys:
      start: datetime
      end: datetime
    """
    opts = opts or {}
    start = opts.get("start", datetime(2015, 1, 1, tzinfo=timezone.utc))
    end = opts.get("end", datetime(2016, 1, 1, tzinfo=timezone.utc))
    zero = Decimal128("0")

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
            "$set": {
                "saleRevenue": {
                    "$reduce": {
                        "input": {"$ifNull": ["$items", []]},
                        "initialValue": zero,
                        "in": {
                            "$add": [
                                "$$value",
                                {
                                    "$multiply": [
                                        {"$ifNull": ["$$this.price", zero]},
                                        {"$ifNull": ["$$this.quantity", 0]},
                                    ],
                                },
                            ],
                        },
                    },
                },
            },
        },
        {
            "$group": {
                "_id": "$storeLocation",
                "sales": {"$sum": 1},
                "avgSatisfaction": {"$avg": "$customer.satisfaction"},
                "couponsUsed": {
                    "$sum": {"$cond": ["$couponUsed", 1, 0]},
                },
                "revenue": {"$sum": "$saleRevenue"},
            },
        },
        {
            "$set": {
                "couponRate": {
                    "$cond": [
                        {"$eq": ["$sales", 0]},
                        None,
                        {"$divide": ["$couponsUsed", "$sales"]},
                    ],
                },
                "revenuePerSale": {
                    "$cond": [
                        {"$eq": ["$sales", 0]},
                        None,
                        {"$divide": ["$revenue", "$sales"]},
                    ],
                },
            },
        },
        {
            "$project": {
                "_id": 0,
                "store": "$_id",
                "sales": 1,
                "avgSatisfaction": 1,
                "couponRate": 1,
                "revenue": 1,
                "revenuePerSale": 1,
            },
        },
        {"$sort": {"store": 1}},
    ]
