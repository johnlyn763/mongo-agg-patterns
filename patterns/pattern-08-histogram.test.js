'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, Decimal128 } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const { getPipeline, DEFAULT_DB, DEFAULT_COLL } = require('./pattern-08');

function bucketIdKey(id) {
  if (id instanceof Decimal128) return id.toString();
  return String(id);
}

describe('Pattern 8 — Histogram', () => {
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

  it('returns non-empty buckets', () => {
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  });

  it('each bucket has _id, count, units; count and units positive', () => {
    for (const doc of results) {
      assert.ok('_id' in doc);
      assert.equal(typeof doc.count, 'number');
      assert.ok(doc.count > 0);
      assert.equal(typeof doc.units, 'number');
      assert.ok(doc.units >= doc.count, 'units should be >= count (quantity per line)');
    }
  });

  it('bucket _ids are known boundaries or default "other"', () => {
    const allowed = new Set(['0', '10', '25', '50', '100', 'other']);
    // boundary 500 is upper exclusive edge — appears only as upper bound, not as _id of a populated bin
    // unless something has price exactly labeling — actually $bucket labels with lower bound:
    // bins: [0,10), [10,25), [25,50), [50,100), [100,500), default other
    for (const doc of results) {
      const key = bucketIdKey(doc._id);
      assert.ok(allowed.has(key), `unexpected bucket _id ${key}`);
    }
  });

  it('total count across buckets is substantial', () => {
    const total = results.reduce((s, d) => s + d.count, 0);
    assert.ok(total > 100);
  });
});
