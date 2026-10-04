'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, Decimal128 } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const { getPipeline, DEFAULT_DB, DEFAULT_COLL } = require('./pattern-04');

function toNumber(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return value;
  if (value instanceof Decimal128) return Number(value.toString());
  if (typeof value.toString === 'function') return Number(value.toString());
  return Number(value);
}

describe('Pattern 4 — Period-over-period', () => {
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

  it('returns non-empty monthly periods', () => {
    assert.ok(Array.isArray(results));
    assert.ok(results.length >= 2, 'need at least two periods for prior/delta');
  });

  it('each doc has periodStart, revenue, delta, pctChange; priorRevenue null on first', () => {
    assert.equal(results[0].priorRevenue, null);
    assert.equal(results[0].pctChange, null);

    for (let i = 0; i < results.length; i++) {
      const doc = results[i];
      assert.ok(doc.periodStart instanceof Date);
      assert.ok(doc.revenue != null);
      assert.ok('delta' in doc);
      assert.ok('pctChange' in doc);
      if (i === 0) {
        assert.equal(doc.priorRevenue, null);
      } else {
        assert.ok(doc.priorRevenue != null);
        const prior = toNumber(doc.priorRevenue);
        const rev = toNumber(doc.revenue);
        const delta = toNumber(doc.delta);
        assert.ok(Math.abs(delta - (rev - prior)) < 1e-4 || Math.abs(delta - (rev - prior)) / Math.max(1, Math.abs(rev)) < 1e-9);
      }
    }
  });

  it('periodStart sorted ascending, unique', () => {
    const keys = results.map((d) => d.periodStart.getTime());
    assert.equal(new Set(keys).size, keys.length);
    for (let i = 1; i < keys.length; i++) {
      assert.ok(keys[i - 1] < keys[i]);
    }
  });

  it('priorRevenue of row i equals revenue of row i-1', () => {
    for (let i = 1; i < results.length; i++) {
      assert.equal(
        String(results[i].priorRevenue),
        String(results[i - 1].revenue)
      );
    }
  });
});
