'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, Decimal128 } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const { getPipeline, DEFAULT_DB, DEFAULT_COLL } = require('./pattern-03');

function toNumber(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return value;
  if (value instanceof Decimal128) return Number(value.toString());
  if (typeof value.toString === 'function') return Number(value.toString());
  return Number(value);
}

describe('Pattern 3 — Running totals', () => {
  let client;
  let results;

  before(async () => {
    client = new MongoClient(getUri());
    await client.connect();
    const coll = client.db(DEFAULT_DB).collection(DEFAULT_COLL);
    results = await coll.aggregate(getPipeline()).toArray();
  });

  after(async () => {
    if (client) await client.close();
  });

  it('returns non-empty daily buckets', () => {
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  });

  it('each doc has bucketStart, revenue, runningRevenue', () => {
    for (const doc of results) {
      assert.ok(doc.bucketStart instanceof Date);
      assert.ok(doc.revenue != null);
      assert.ok(doc.runningRevenue != null);
    }
  });

  it('bucketStart sorted ascending, unique', () => {
    const keys = results.map((d) => d.bucketStart.getTime());
    for (let i = 1; i < keys.length; i++) {
      assert.ok(keys[i - 1] < keys[i], 'strictly ascending unique buckets');
    }
  });

  it('runningRevenue is non-decreasing and equals cumulative sum of revenue', () => {
    let cum = 0;
    for (const doc of results) {
      const rev = toNumber(doc.revenue);
      const run = toNumber(doc.runningRevenue);
      assert.ok(Number.isFinite(rev) && rev > 0);
      assert.ok(Number.isFinite(run));
      cum += rev;
      // Decimal128 float conversion may have tiny error; allow 1e-6 relative
      assert.ok(
        Math.abs(run - cum) < Math.max(1e-4, Math.abs(cum) * 1e-9),
        `runningRevenue ${run} vs cum ${cum}`
      );
    }
    assert.ok(toNumber(results[results.length - 1].runningRevenue) >= toNumber(results[0].runningRevenue));
  });
});
