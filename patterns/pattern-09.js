'use strict';

/**
 * Pattern 9 — Active vs churned in a window
 *
 * @param {object} [opts]
 * @param {Date}   [opts.windowStart]
 * @param {Date}   [opts.windowEnd]
 * @param {Date}   [opts.historyStart]
 * @returns {object[]}
 */
function getPipeline(opts = {}) {
  const windowStart = opts.windowStart ?? new Date('2015-10-01T00:00:00Z');
  const windowEnd = opts.windowEnd ?? new Date('2016-01-01T00:00:00Z');
  const historyStart = opts.historyStart ?? new Date('2015-01-01T00:00:00Z');

  return [
    {
      $match: {
        saleDate: { $gte: historyStart, $lt: windowEnd },
        'customer.email': { $exists: true, $ne: null },
      },
    },
    {
      $group: {
        _id: '$customer.email',
        firstSale: { $min: '$saleDate' },
        lastSale: { $max: '$saleDate' },
        sales: { $sum: 1 },
      },
    },
    {
      $set: {
        status: {
          $switch: {
            branches: [
              {
                case: {
                  $and: [
                    { $gte: ['$lastSale', windowStart] },
                    { $lt: ['$lastSale', windowEnd] },
                  ],
                },
                then: 'active',
              },
              {
                case: {
                  $and: [
                    { $lt: ['$lastSale', windowStart] },
                    { $gte: ['$firstSale', historyStart] },
                  ],
                },
                then: 'churned',
              },
            ],
            default: 'other',
          },
        },
      },
    },
    {
      $group: {
        _id: '$status',
        customers: { $sum: 1 },
        sales: { $sum: '$sales' },
      },
    },
    {
      $project: {
        _id: 0,
        status: '$_id',
        customers: 1,
        sales: 1,
      },
    },
    { $sort: { status: 1 } },
  ];
}

module.exports = {
  getPipeline,
  DEFAULT_DB: 'sample_supplies',
  DEFAULT_COLL: 'sales',
};
