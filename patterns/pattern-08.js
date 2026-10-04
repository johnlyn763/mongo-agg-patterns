'use strict';

const { Decimal128 } = require('mongodb');

/**
 * Pattern 8 — Histogram / distribution
 *
 * @param {object} [opts]
 * @param {Date}   [opts.start]
 * @param {Date}   [opts.end]
 * @param {import('mongodb').Decimal128[]} [opts.boundaries]
 * @param {*}      [opts.defaultBucket='other']
 * @returns {object[]}
 */
function getPipeline(opts = {}) {
  const start = opts.start ?? new Date('2015-01-01T00:00:00Z');
  const end = opts.end ?? new Date('2016-01-01T00:00:00Z');
  const boundaries = opts.boundaries ?? [
    Decimal128.fromString('0'),
    Decimal128.fromString('10'),
    Decimal128.fromString('25'),
    Decimal128.fromString('50'),
    Decimal128.fromString('100'),
    Decimal128.fromString('500'),
  ];
  const defaultBucket = opts.defaultBucket ?? 'other';

  return [
    {
      $match: {
        saleDate: {
          $gte: start,
          $lt: end,
        },
      },
    },
    { $unwind: '$items' },
    {
      $bucket: {
        groupBy: '$items.price',
        boundaries,
        default: defaultBucket,
        output: {
          count: { $sum: 1 },
          units: { $sum: '$items.quantity' },
        },
      },
    },
  ];
}

module.exports = {
  getPipeline,
  DEFAULT_DB: 'sample_supplies',
  DEFAULT_COLL: 'sales',
};
