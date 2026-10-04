'use strict';

/**
 * Pattern 3 — Running totals / cumulative series
 *
 * @param {object} [opts]
 * @param {string} [opts.timezone='America/New_York']
 * @param {string} [opts.unit='day']
 * @param {Date}   [opts.start]
 * @param {Date}   [opts.end]
 * @returns {object[]}
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
      },
    },
    {
      $project: {
        _id: 0,
        bucketStart: '$_id',
        revenue: 1,
      },
    },
    {
      $setWindowFields: {
        sortBy: { bucketStart: 1 },
        output: {
          runningRevenue: {
            $sum: '$revenue',
            window: { documents: ['unbounded', 'current'] },
          },
        },
      },
    },
    { $sort: { bucketStart: 1 } },
  ];
}

module.exports = {
  getPipeline,
  DEFAULT_DB: 'sample_supplies',
  DEFAULT_COLL: 'sales',
};
