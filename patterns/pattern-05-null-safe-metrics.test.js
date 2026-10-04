'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, Decimal128 } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const { getPipeline, DEFAULT_DB, DEFAULT_COLL } = require('./pattern-05');

function toNumber(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return value;
  if (value instanceof Decimal128) return Number(value.toString());
  if (typeof value.toString === 'function') return Number(value.toString());
  return Number(value);
}

describe('Pattern 5 — Null-safe metrics', () => {
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

  it('returns non-empty store metrics', () => {
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  });

  it('shape: store, sales, avgSatisfaction, couponRate, revenue, revenuePerSale', () => {
    for (const doc of results) {
      assert.equal(typeof doc.store, 'string');
      assert.equal(typeof doc.sales, 'number');
      assert.ok(doc.sales > 0);
      assert.equal(typeof doc.avgSatisfaction, 'number');
      assert.ok(doc.avgSatisfaction >= 1 && doc.avgSatisfaction <= 5);
      assert.equal(typeof doc.couponRate, 'number');
      assert.ok(doc.couponRate >= 0 && doc.couponRate <= 1);
      assert.ok(doc.revenue != null);
      assert.ok(toNumber(doc.revenue) > 0);
      assert.ok(doc.revenuePerSale != null);
      assert.ok(toNumber(doc.revenuePerSale) > 0);
    }
  });

  it('stores sorted ascending, unique', () => {
    const stores = results.map((d) => d.store);
    assert.equal(new Set(stores).size, stores.length);
    for (let i = 1; i < stores.length; i++) {
      assert.ok(stores[i - 1] <= stores[i]);
    }
  });

  it('couponRate and revenuePerSale consistent with sales when sales > 0', () => {
    for (const doc of results) {
      // couponRate = couponsUsed/sales; we only know rate is in [0,1]
      // revenuePerSale ≈ revenue/sales
      const rps = toNumber(doc.revenuePerSale);
      const rev = toNumber(doc.revenue);
      const expected = rev / doc.sales;
      assert.ok(Math.abs(rps - expected) / Math.max(1, expected) < 1e-6 || Math.abs(rps - expected) < 0.01);
    }
  });
});
