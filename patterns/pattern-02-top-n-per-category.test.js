'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, Decimal128 } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const { getPipeline, DEFAULT_DB, DEFAULT_COLL } = require('./pattern-02');

function toNumber(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return value;
  if (value instanceof Decimal128) return Number(value.toString());
  if (typeof value.toString === 'function') return Number(value.toString());
  return Number(value);
}

describe('Pattern 2 — Top-N per category', () => {
  const n = 5;
  let client;
  let results;

  before(async () => {
    client = new MongoClient(getUri());
    await client.connect();
    const coll = client.db(DEFAULT_DB).collection(DEFAULT_COLL);
    results = await coll.aggregate(getPipeline({ n })).toArray();
  });

  after(async () => {
    if (client) await client.close();
  });

  it('returns non-empty array of stores', () => {
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0, 'expected at least one store');
  });

  it('each doc has store string and topProducts array', () => {
    for (const doc of results) {
      assert.equal(typeof doc.store, 'string');
      assert.ok(Array.isArray(doc.topProducts));
      assert.ok(doc.topProducts.length > 0);
      assert.ok(doc.topProducts.length <= n, `topProducts length ${doc.topProducts.length} > n=${n}`);
    }
  });

  it('stores sorted ascending', () => {
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].store <= results[i].store);
    }
  });

  it('no duplicate stores', () => {
    const stores = results.map((d) => d.store);
    assert.equal(new Set(stores).size, stores.length);
  });

  it('products have product, revenue, units; revenue descending within store', () => {
    for (const doc of results) {
      for (let i = 0; i < doc.topProducts.length; i++) {
        const p = doc.topProducts[i];
        assert.equal(typeof p.product, 'string');
        assert.ok(p.revenue != null);
        assert.equal(typeof p.units, 'number');
        assert.ok(p.units > 0);
        const rev = toNumber(p.revenue);
        assert.ok(Number.isFinite(rev) && rev > 0);
        if (i > 0) {
          const prev = toNumber(doc.topProducts[i - 1].revenue);
          assert.ok(prev >= rev, 'revenue should be descending within store');
        }
      }
    }
  });
});
