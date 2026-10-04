'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const { getPipeline, DEFAULT_DB, DEFAULT_COLL } = require('./pattern-07');

describe('Pattern 7 — Faceted dashboard', () => {
  let client;
  let payload;

  before(async () => {
    client = new MongoClient(getUri());
    await client.connect();
    const coll = client.db(DEFAULT_DB).collection(DEFAULT_COLL);
    const results = await coll.aggregate(getPipeline({ recentLimit: 10 })).toArray();
    assert.equal(results.length, 1);
    payload = results[0];
  });

  after(async () => {
    if (client) await client.close();
  });

  it('has facet keys kpis, byStore, recent', () => {
    assert.ok(Array.isArray(payload.kpis));
    assert.ok(Array.isArray(payload.byStore));
    assert.ok(Array.isArray(payload.recent));
  });

  it('kpis has one doc with sales, coupons, avgSatisfaction', () => {
    assert.equal(payload.kpis.length, 1);
    const k = payload.kpis[0];
    assert.equal(typeof k.sales, 'number');
    assert.ok(k.sales > 0);
    assert.equal(typeof k.coupons, 'number');
    assert.ok(k.coupons >= 0 && k.coupons <= k.sales);
    assert.equal(typeof k.avgSatisfaction, 'number');
  });

  it('byStore has store/sales, sorted by sales desc', () => {
    assert.ok(payload.byStore.length > 0);
    let sum = 0;
    for (let i = 0; i < payload.byStore.length; i++) {
      const row = payload.byStore[i];
      assert.equal(typeof row.store, 'string');
      assert.equal(typeof row.sales, 'number');
      assert.ok(row.sales > 0);
      sum += row.sales;
      if (i > 0) {
        assert.ok(payload.byStore[i - 1].sales >= row.sales);
      }
    }
    assert.equal(sum, payload.kpis[0].sales);
  });

  it('recent has at most 10 rows with expected fields, saleDate desc', () => {
    assert.ok(payload.recent.length > 0);
    assert.ok(payload.recent.length <= 10);
    for (let i = 0; i < payload.recent.length; i++) {
      const r = payload.recent[i];
      assert.ok(r.saleDate instanceof Date);
      assert.equal(typeof r.storeLocation, 'string');
      assert.equal(typeof r.purchaseMethod, 'string');
      assert.equal(typeof r.email, 'string');
      if (i > 0) {
        assert.ok(payload.recent[i - 1].saleDate.getTime() >= r.saleDate.getTime());
      }
    }
  });
});
