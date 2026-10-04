'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, ObjectId } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const {
  getPipeline,
  getKeysetPipeline,
  DEFAULT_DB,
  DEFAULT_COLL,
} = require('./pattern-10');

describe('Pattern 10 — Pagination', () => {
  const pageSize = 25;
  let client;
  let coll;
  let page0;

  before(async () => {
    client = new MongoClient(getUri());
    await client.connect();
    coll = client.db(DEFAULT_DB).collection(DEFAULT_COLL);
    const results = await coll.aggregate(getPipeline({ pageSize, page: 0 })).toArray();
    assert.equal(results.length, 1);
    page0 = results[0];
  });

  after(async () => {
    if (client) await client.close();
  });

  it('facet form returns rows and total', () => {
    assert.ok(Array.isArray(page0.rows));
    assert.equal(typeof page0.total, 'number');
    assert.ok(page0.total > pageSize);
    assert.equal(page0.rows.length, pageSize);
  });

  it('row shape: _id, saleDate, storeLocation, purchaseMethod, email, itemCount', () => {
    for (const row of page0.rows) {
      assert.ok(row._id instanceof ObjectId);
      assert.ok(row.saleDate instanceof Date);
      assert.equal(typeof row.storeLocation, 'string');
      assert.equal(typeof row.purchaseMethod, 'string');
      assert.equal(typeof row.email, 'string');
      assert.equal(typeof row.itemCount, 'number');
      assert.ok(row.itemCount >= 0);
    }
  });

  it('rows sorted saleDate desc, _id desc as tie-breaker', () => {
    for (let i = 1; i < page0.rows.length; i++) {
      const a = page0.rows[i - 1];
      const b = page0.rows[i];
      const ta = a.saleDate.getTime();
      const tb = b.saleDate.getTime();
      if (ta === tb) {
        assert.ok(a._id.toString() >= b._id.toString() || a._id > b._id);
        // ObjectId comparison via buffer
        assert.ok(Buffer.compare(a._id.id, b._id.id) >= 0);
      } else {
        assert.ok(ta > tb);
      }
    }
  });

  it('page 1 is disjoint from page 0 and same total', async () => {
    const [page1] = await coll.aggregate(getPipeline({ pageSize, page: 1 })).toArray();
    assert.equal(page1.total, page0.total);
    assert.equal(page1.rows.length, pageSize);
    const ids0 = new Set(page0.rows.map((r) => r._id.toString()));
    for (const r of page1.rows) {
      assert.ok(!ids0.has(r._id.toString()), 'pages should not overlap');
    }
    // page1 should continue after page0 chronologically
    const last0 = page0.rows[page0.rows.length - 1];
    const first1 = page1.rows[0];
    const t0 = last0.saleDate.getTime();
    const t1 = first1.saleDate.getTime();
    assert.ok(t0 > t1 || (t0 === t1 && Buffer.compare(last0._id.id, first1._id.id) > 0));
  });

  it('keyset pipeline continues after last row of page 0', async () => {
    const last = page0.rows[page0.rows.length - 1];
    const keyset = await coll
      .aggregate(
        getKeysetPipeline({
          pageSize,
          lastSaleDate: last.saleDate,
          lastId: last._id,
        })
      )
      .toArray();
    assert.ok(keyset.length > 0);
    assert.ok(keyset.length <= pageSize);
    const [page1] = await coll.aggregate(getPipeline({ pageSize, page: 1 })).toArray();
    assert.equal(keyset[0]._id.toString(), page1.rows[0]._id.toString());
  });
});
