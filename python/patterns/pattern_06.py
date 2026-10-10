"""
Pattern 6 — Multi-collection report via $lookup (sample_mflix)
Shared pipeline builder so manuscript examples and tests stay aligned.
"""

from __future__ import annotations

from typing import Any

DEFAULT_DB = "sample_mflix"
DEFAULT_COLL = "movies"


def get_pipeline(opts: dict[str, Any] | None = None) -> list[dict[str, Any]]:
    """
    Build the lookup report pipeline.

    opts keys:
      yearGte: int   (default 2000)
      type: str      (default 'movie')
      limit: int     (default 50)
    """
    opts = opts or {}
    year_gte = opts.get("yearGte", 2000)
    type_ = opts.get("type", "movie")
    limit = opts.get("limit", 50)

    return [
        {
            "$match": {
                "year": {"$gte": year_gte},
                "type": type_,
            },
        },
        {"$limit": limit},
        {
            "$lookup": {
                "from": "comments",
                "let": {"movieId": "$_id"},
                "pipeline": [
                    {
                        "$match": {
                            "$expr": {"$eq": ["$movie_id", "$$movieId"]},
                        },
                    },
                    {
                        "$project": {
                            "_id": 0,
                            "date": 1,
                            "name": 1,
                        },
                    },
                ],
                "as": "commentDocs",
            },
        },
        {
            "$project": {
                "_id": 0,
                "title": 1,
                "year": 1,
                "imdbRating": "$imdb.rating",
                "commentCount": {"$size": "$commentDocs"},
                "latestCommentAt": {"$max": "$commentDocs.date"},
            },
        },
        {"$sort": {"commentCount": -1, "title": 1}},
    ]
