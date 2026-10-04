'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient, Decimal128 } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const {
  getPipeline,
  getExplorationPipeline,
  DEFAULT_DB,
  DEFAULT_COLL,
} = require('./pattern-01');

/** Convert Decimal128 / number / Long-ish values to a finite JS number. */
function toNumber(value) {
  if (value == null) return NaN;
  if (typeof value === 'number') return value;
  if (value instanceof Decimal128) return Number(value.toString());
  if (typeof value.toString === 'function') return Number(value.toString());
  return Number(value);
}

describe('Pattern 1 — Time-bucket totals', () => {
  let client;
  let coll;
  let results;

  before(async () => {
    client = new MongoClient(getUri());
    await client.connect();
    coll = client.db(DEFAULT_DB).collection(DEFAULT_COLL);
    results = await coll.aggregate(getPipeline()).toArray();
  });

  after(async () => {
    if (client) await client.close();
  });

  it('returns an array', () => {
    assert.ok(Array.isArray(results), 'aggregate should return an array');
    assert.ok(results.length > 0, '2015 window should yield at least one bucket');
  });

  it('each doc has bucketStart (Date), revenue, lineItems, sales', () => {
    for (const doc of results) {
      assert.ok(doc.bucketStart instanceof Date, 'bucketStart must be Date');
      assert.ok('revenue' in doc, 'revenue field present');
      assert.ok('lineItems' in doc, 'lineItems field present');
      assert.ok('sales' in doc, 'sales field present');
    }
  });

  it('bucketStart sorted ascending', () => {
    for (let i = 1; i < results.length; i++) {
      assert.ok(
        results[i - 1].bucketStart.getTime() <= results[i].bucketStart.getTime(),
        `bucketStart not sorted at index ${i}`
      );
    }
  });

  it('no duplicate bucketStart values', () => {
    const keys = results.map((d) => d.bucketStart.getTime());
    assert.equal(new Set(keys).size, keys.length, 'duplicate bucketStart found');
  });

  it('lineItems and sales are positive; sales <= lineItems', () => {
    for (const doc of results) {
      assert.equal(typeof doc.lineItems, 'number');
      assert.equal(typeof doc.sales, 'number');
      assert.ok(doc.lineItems > 0, 'lineItems should be positive');
      assert.ok(doc.sales > 0, 'sales should be positive');
      assert.ok(
        doc.sales <= doc.lineItems,
        `sales (${doc.sales}) should be <= lineItems (${doc.lineItems})`
      );
    }
  });

  it('revenue is Decimal128 or convertible; sum of revenues > 0', () => {
    let sum = 0;
    for (const doc of results) {
      const isDecimal = doc.revenue instanceof Decimal128;
      const n = toNumber(doc.revenue);
      assert.ok(
        isDecimal || Number.isFinite(n),
        `revenue should be Decimal128 or convertible number, got ${typeof doc.revenue}`
      );
      assert.ok(Number.isFinite(n), 'revenue converts to finite number');
      assert.ok(n > 0, 'each bucket revenue should be > 0');
      sum += n;
    }
    assert.ok(sum > 0, 'sum of revenues for 2015 window should be > 0');
  });

  it('exploration $match+$limit:3 path does not throw', async () => {
    const docs = await coll.aggregate(getExplorationPipeline({ limit: 3 })).toArray();
    assert.ok(Array.isArray(docs));
    assert.ok(docs.length <= 3);
    assert.ok(docs.length >= 1, 'exploration should find at least one 2015 sale');
  });

  it('sample first-row shape (types) for reporting', () => {
    const first = results[0];
    assert.ok(first);
    assert.equal(Object.prototype.toString.call(first.bucketStart), '[object Date]');
    assert.ok(
      first.revenue instanceof Decimal128 || typeof first.revenue === 'number'
    );
    assert.equal(typeof first.lineItems, 'number');
    assert.equal(typeof first.sales, 'number');
  });
});
