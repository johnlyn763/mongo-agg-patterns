#!/usr/bin/env python3
"""
Run a pattern pipeline and print documents (not a test).

Usage:
  python run_pattern.py 1 --table --limit 5
  python run_pattern.py 1 --limit 5

Nested array-of-object fields print as sub-tables (parity with Node run-pattern.cjs).

Env:
  MONGODB_URI  default mongodb://127.0.0.1:27017
"""

from __future__ import annotations

import argparse
import importlib
import json
import os
import sys
from datetime import datetime
from typing import Any

from bson import ObjectId
from bson.decimal128 import Decimal128
from pymongo import MongoClient

RUNNER_VERSION = "2026-09-17-nested-tables"
DEFAULT_URI = "mongodb://127.0.0.1:27017"


def get_uri() -> str:
    return os.environ.get("MONGODB_URI", DEFAULT_URI)


def load_pattern(n: int):
    id_ = f"{n:02d}"
    mod_name = f"pattern_{id_}"
    # Ensure patterns/ is importable when run from tests/
    patterns_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "patterns")
    if patterns_dir not in sys.path:
        sys.path.insert(0, patterns_dir)
    try:
        mod = importlib.import_module(mod_name)
    except ModuleNotFoundError as exc:
        raise SystemExit(
            f"Pattern {n} not implemented yet (expected patterns/{mod_name}.py). {exc}"
        ) from exc
    if not hasattr(mod, "get_pipeline") or not callable(mod.get_pipeline):
        raise SystemExit(f"{mod_name}.py does not export get_pipeline")
    return mod


def is_bson_leaf(value: Any) -> bool:
    return isinstance(value, (Decimal128, ObjectId))


def is_row_object(value: Any) -> bool:
    return (
        value is not None
        and isinstance(value, dict)
        and not isinstance(value, datetime)
    )


def is_array_of_row_objects(value: Any) -> bool:
    return (
        isinstance(value, list)
        and len(value) > 0
        and all(is_row_object(v) for v in value)
    )


def cell_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (str, int, float, bool)):
        return str(value)
    if isinstance(value, datetime):
        return value.isoformat().replace("+00:00", "Z") if value.tzinfo else value.isoformat() + "Z"
    if isinstance(value, Decimal128):
        return str(value)
    if isinstance(value, ObjectId):
        return str(value)
    return json.dumps(value, default=json_default)


def json_default(obj: Any):
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Decimal128):
        return str(obj)
    if isinstance(obj, ObjectId):
        return str(obj)
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


def split_row(row: dict) -> tuple[dict, dict, dict, dict]:
    scalars: dict = {}
    nested_arrays: dict = {}
    nested_objects: dict = {}
    other: dict = {}

    for key, value in row.items():
        if is_array_of_row_objects(value):
            nested_arrays[key] = value
        elif isinstance(value, list) and len(value) == 0:
            scalars[key] = "(empty)"
        elif is_row_object(value):
            nested_objects[key] = value
        elif (
            value is None
            or isinstance(value, (str, int, float, bool, datetime))
            or is_bson_leaf(value)
        ):
            scalars[key] = value
        else:
            other[key] = value
    return scalars, nested_arrays, nested_objects, other


def print_table(rows: list[dict], indent: str = "") -> None:
    if not rows:
        print(f"{indent}(no rows)")
        return

    columns: list[str] = []
    seen: set[str] = set()
    for row in rows:
        for key in row.keys():
            if key not in seen:
                seen.add(key)
                columns.append(key)

    matrix = [[cell_value(row.get(col)) for col in columns] for row in rows]
    widths = [
        max(len(col), max((min(len(r[i]), 60) for r in matrix), default=0))
        for i, col in enumerate(columns)
    ]

    def clip(s: str, w: int) -> str:
        return s if len(s) <= w else s[: max(0, w - 1)] + "…"

    sep = indent + "+" + "+".join("-" * (w + 2) for w in widths) + "+"

    def fmt(cells: list[str]) -> str:
        return (
            indent
            + "| "
            + " | ".join(clip(c, widths[i]).ljust(widths[i]) for i, c in enumerate(cells))
            + " |"
        )

    print(sep)
    print(fmt(columns))
    print(sep)
    for row in matrix:
        print(fmt(row))
    print(sep)


def print_expanded_rows(rows: list[dict]) -> None:
    if not rows:
        print("(no rows)")
        return

    for index, row in enumerate(rows):
        scalars, nested_arrays, nested_objects, other = split_row(row)
        print(f"\n=== row {index + 1} of {len(rows)} ===")

        if scalars:
            print_table([scalars])

        for key, obj in nested_objects.items():
            print(f"\n{key}:")
            print_table([obj], "  ")

        for key, arr in nested_arrays.items():
            plural = "" if len(arr) == 1 else "s"
            print(f"\n{key}:  ({len(arr)} nested row{plural})")
            print_table(arr, "  ")

        for key, value in other.items():
            print(f"\n{key}:")
            print("  " + cell_value(value))

        if not scalars and not nested_arrays and not nested_objects and not other:
            print("(empty row)")
    print()


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run a Pattern Pack pipeline and print results."
    )
    parser.add_argument("n", type=int, help="Pattern number 1–10")
    parser.add_argument("--limit", type=int, default=None, help="Max rows to return")
    parser.add_argument(
        "--table", "-t", action="store_true", help="Print nested tables instead of JSON"
    )
    args = parser.parse_args(argv)
    if args.n < 1 or args.n > 10:
        parser.error("pattern number must be 1–10")
    if args.limit is not None and args.limit < 0:
        parser.error("--limit must be a non-negative integer")
    return args


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv if argv is not None else sys.argv[1:])
    mod = load_pattern(args.n)
    pipeline = mod.get_pipeline()
    db_name = getattr(mod, "DEFAULT_DB", "sample_supplies")
    coll_name = getattr(mod, "DEFAULT_COLL", "sales")

    client = MongoClient(get_uri(), serverSelectionTimeoutMS=5000)
    try:
        coll = client[db_name][coll_name]
        run_pipeline = list(pipeline)
        if args.limit is not None:
            run_pipeline = run_pipeline + [{"$limit": args.limit}]
        rows = list(coll.aggregate(run_pipeline))

        limit_note = f"  (limit {args.limit})" if args.limit is not None else ""
        fmt = "table-nested" if args.table else "json"
        print(
            f"# run-pattern {RUNNER_VERSION}\n"
            f"# Pattern {args.n}  db={db_name}  collection={coll_name}  "
            f"rows={len(rows)}{limit_note}  format={fmt}",
            file=sys.stderr,
        )

        if args.table:
            print_expanded_rows(rows)
        else:
            print(json.dumps(rows, indent=2, default=json_default))
    finally:
        client.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
