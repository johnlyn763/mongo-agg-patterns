'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const { getPipeline, DEFAULT_DB, DEFAULT_COLL } = require('./pattern-09');

describe('Pattern 9 — Active vs churned', () => {
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

  it('returns status rows', () => {
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  });

  it('status values are active|churned|other with positive customers/sales', () => {
    const allowed = new Set(['active', 'churned', 'other']);
    const seen = new Set();
    for (const doc of results) {
      assert.ok(allowed.has(doc.status), `unexpected status ${doc.status}`);
      seen.add(doc.status);
      assert.equal(typeof doc.customers, 'number');
      assert.ok(doc.customers > 0);
      assert.equal(typeof doc.sales, 'number');
      assert.ok(doc.sales >= doc.customers);
    }
    assert.ok(seen.has('active'), 'expected active customers');
    assert.ok(seen.has('churned'), 'expected churned customers');
  });

  it('statuses sorted ascending', () => {
    for (let i = 1; i < results.length; i++) {
      assert.ok(results[i - 1].status <= results[i].status);
    }
  });

  it('no duplicate status keys', () => {
    const keys = results.map((d) => d.status);
    assert.equal(new Set(keys).size, keys.length);
  });
});
