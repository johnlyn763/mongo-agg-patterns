# MongoDB Aggregation Pattern Pack, Vol. 1

Test harness for the 10 aggregation patterns presented in the Leanpub book [MongoDB Aggregation Pattern Pack, Vol. 1 (Node / mongosh)](https://leanpub.com/mongo-agg-patterns).

This repository is an optional companion to the book. The book contains the explanations, commentary, and walkthrough for each pattern. These tests let you run the pipelines against live data and verify the results.

## Requirements

- **Node.js 18+**
- **MongoDB** with the [Atlas sample datasets](https://www.mongodb.com/docs/atlas/sample-data/) loaded:
  - `sample_supplies.sales`
  - `sample_mflix.movies` and `sample_mflix.comments`

The sample data archive can be restored locally using `mongorestore`:

```bash
curl -L https://atlas-education.s3.amazonaws.com/sampledata.archive -o sampledata.archive
mongorestore --archive=sampledata.archive
```

## Setup

Install dependencies:

```bash
npm install
```

## Connection

By default, the tests connect to `mongodb://127.0.0.1:27017`. To use a different URI (such as an Atlas cluster), set the `MONGODB_URI` environment variable:

```bash
export MONGODB_URI="mongodb+srv://user@cluster.mongodb.net"
```

## Running the tests

Run all pattern tests:

```bash
npm test
```

## What's included

This repository contains tests for patterns 1-10:

| # | Pattern | Dataset | Focus |
|---|---------|---------|-------|
| 1 | Time-bucket totals | `sample_supplies.sales` | `$dateTrunc` for bucketing |
| 2 | Top-N per category | `sample_supplies.sales` | `$push` + `$slice` |
| 3 | Running totals | `sample_supplies.sales` | `$setWindowFields` |
| 4 | Period-over-period | `sample_supplies.sales` | `$shift` |
| 5 | Null-safe metrics | `sample_supplies.sales` | `$reduce`, rates |
| 6 | Multi-collection report | `sample_mflix.movies` | `$lookup` |
| 7 | Faceted dashboard | `sample_supplies.sales` | `$facet` |
| 8 | Histogram | `sample_supplies.sales` | `$bucket` |
| 9 | Active vs churned | `sample_supplies.sales` | Window analysis |
| 10 | Pagination | `sample_supplies.sales` | `$facet` + keyset |

Each pattern has a pipeline module (`patterns/pattern-0N.js`) and a test file (`patterns/pattern-0N-*.test.js`) that runs assertions against live data.

## Notes

- Tests check shapes, sorting, and invariants rather than exact totals.
- Pattern 6 benefits from an index on `sample_mflix.comments.movie_id` for faster `$lookup` performance.
