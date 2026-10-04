'use strict';

/**
 * Pattern 4 — Period-over-period
 *
 * @param {object} [opts]
 * @param {string} [opts.timezone='America/New_York']
 * @param {string} [opts.unit='month']
 * @param {Date}   [opts.start]
 * @param {Date}   [opts.end]
 * @returns {object[]}
 */
function getPipeline(opts = {}) {
  const timezone = opts.timezone ?? 'America/New_York';
  const unit = opts.unit ?? 'month';
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
        periodStart: '$_id',
        revenue: 1,
      },
    },
    {
      $setWindowFields: {
        sortBy: { periodStart: 1 },
        output: {
          priorRevenue: {
            $shift: {
              output: '$revenue',
              by: -1,
            },
          },
        },
      },
    },
    {
      $set: {
        delta: {
          $subtract: ['$revenue', { $ifNull: ['$priorRevenue', 0] }],
        },
        pctChange: {
          $cond: [
            {
              $or: [
                { $eq: ['$priorRevenue', null] },
                { $eq: ['$priorRevenue', 0] },
              ],
            },
            null,
            {
              $multiply: [
                {
                  $divide: [
                    { $subtract: ['$revenue', '$priorRevenue'] },
                    '$priorRevenue',
                  ],
                },
                100,
              ],
            },
          ],
        },
      },
    },
    { $sort: { periodStart: 1 } },
  ];
}

module.exports = {
  getPipeline,
  DEFAULT_DB: 'sample_supplies',
  DEFAULT_COLL: 'sales',
};
