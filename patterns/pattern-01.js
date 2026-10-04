'use strict';

/**
 * Pattern 1 — Time-bucket totals
 * Shared pipeline builder so manuscript examples and tests stay aligned.
 *
 * @param {object} [opts]
 * @param {string} [opts.timezone='America/New_York']
 * @param {string} [opts.unit='day']  // 'day' | 'week' | 'month'
 * @param {Date}   [opts.start]       // inclusive lower bound on saleDate
 * @param {Date}   [opts.end]         // exclusive upper bound on saleDate
 * @returns {object[]} aggregation pipeline stages
 */
function getPipeline(opts = {}) {
  const timezone = opts.timezone ?? 'America/New_York';
  const unit = opts.unit ?? 'day';
  const start = opts.start ?? new Date('2015-01-01T00:00:00Z');
  const end = opts.end ?? new Date('2016-01-01T00:00:00Z');

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
      $set: {
        lineRevenue: { $multiply: ['$items.price', '$items.quantity'] },
      },
    },
    {
      $group: {
        _id: {
          $dateTrunc: {
            date: '$saleDate',
            unit,
            timezone,
          },
        },
        revenue: { $sum: '$lineRevenue' },
        lineItems: { $sum: 1 },
        sales: { $addToSet: '$_id' },
      },
    },
    {
      $project: {
        _id: 0,
        bucketStart: '$_id',
        revenue: 1,
        lineItems: 1,
        sales: { $size: '$sales' },
      },
    },
    { $sort: { bucketStart: 1 } },
  ];
}

/**
 * Exploration path from the manuscript: early $match + $limit so later
 * stages can be commented out while inspecting intermediates.
 *
 * @param {object} [opts]
 * @param {Date}   [opts.start]
 * @param {Date}   [opts.end]
 * @param {number} [opts.limit=3]
 * @returns {object[]}
 */
function getExplorationPipeline(opts = {}) {
  const start = opts.start ?? new Date('2015-01-01T00:00:00Z');
  const end = opts.end ?? new Date('2016-01-01T00:00:00Z');
  const limit = opts.limit ?? 3;

  return [
    {
      $match: {
        saleDate: {
          $gte: start,
          $lt: end,
        },
      },
    },
    { $limit: limit },
  ];
}

module.exports = {
  getPipeline,
  getExplorationPipeline,
  DEFAULT_DB: 'sample_supplies',
  DEFAULT_COLL: 'sales',
};
