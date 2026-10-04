'use strict';

const { MongoClient } = require('mongodb');

const DEFAULT_URI = 'mongodb://127.0.0.1:27017';

/**
 * @returns {string}
 */
function getUri() {
  return process.env.MONGODB_URI || DEFAULT_URI;
}

/**
 * Connect to the local (or env-configured) MongoDB.
 * Caller must close the client when done.
 *
 * @param {string} [uri]
 * @returns {Promise<{ client: import('mongodb').MongoClient, db: import('mongodb').Db }>}
 */
async function connect(uri = getUri()) {
  const client = new MongoClient(uri);
  await client.connect();
  return { client, db: client.db() };
}

/**
 * Open a client, run fn(client), then always close.
 *
 * @template T
 * @param {(client: import('mongodb').MongoClient) => Promise<T>} fn
 * @param {string} [uri]
 * @returns {Promise<T>}
 */
async function withClient(fn, uri = getUri()) {
  const client = new MongoClient(uri);
  try {
    await client.connect();
    return await fn(client);
  } finally {
    await client.close();
  }
}

module.exports = {
  DEFAULT_URI,
  getUri,
  connect,
  withClient,
};
