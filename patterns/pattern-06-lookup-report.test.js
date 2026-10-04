'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { MongoClient } = require('mongodb');
const { getUri } = require('../helpers/mongo');
const { getPipeline, DEFAULT_DB, DEFAULT_COLL } = require('./pattern-06');

describe('Pattern 6 — Lookup report (sample_mflix)', () => {
  const limit = 50;
  let client;
  let results;

  before(async () => {
    client = new MongoClient(getUri());
    await client.connect();
    const coll = client.db(DEFAULT_DB).collection(DEFAULT_COLL);
    results = await coll.aggregate(getPipeline({ limit })).toArray();
  });

  after(async () => {
    if (client) await client.close();
  });

  it('returns at most limit movies', () => {
    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
    assert.ok(results.length <= limit);
  });

  it('shape: title, year, imdbRating, commentCount, latestCommentAt', () => {
    for (const doc of results) {
      assert.equal(typeof doc.title, 'string');
      assert.ok(doc.title.length > 0);
      assert.equal(typeof doc.year, 'number');
      assert.ok(doc.year >= 2000);
      assert.ok('imdbRating' in doc);
      assert.equal(typeof doc.commentCount, 'number');
      assert.ok(doc.commentCount >= 0);
      if (doc.commentCount > 0) {
        assert.ok(doc.latestCommentAt instanceof Date);
      } else {
        assert.equal(doc.latestCommentAt, null);
      }
    }
  });

  it('sorted by commentCount desc then title asc', () => {
    for (let i = 1; i < results.length; i++) {
      const a = results[i - 1];
      const b = results[i];
      if (a.commentCount === b.commentCount) {
        assert.ok(a.title <= b.title);
      } else {
        assert.ok(a.commentCount >= b.commentCount);
      }
    }
  });

  it('at least one movie has comments in the limited set', () => {
    const withComments = results.filter((d) => d.commentCount > 0);
    assert.ok(withComments.length > 0, 'expected some movies with comments');
  });
});
