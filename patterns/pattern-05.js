'use strict';

const { Decimal128 } = require('mongodb');

/**
 * Pattern 5 — Null-safe metrics
 *
 * @param {object} [opts]
 * @param {Date}   [opts.start]
 * @param {Date}   [opts.end]
 * @returns {object[]}
 */
function getPipeline(opts = {}) {
  const start = opts.start ?? new Date('2015-01-01T00:00:00Z');
  const end = opts.end ?? new Date('2016-01-01T00:00:00Z');
  const zero = Decimal128.fromString('0');

  return [
    {
      $match: {
        saleDate: {
          $gte: start,
          $lt: end,
        },
      },
    },
    {
      $set: {
        saleRevenue: {
          $reduce: {
            input: { $ifNull: ['$items', []] },
            initialValue: zero,
            in: {
              $add: [
                '$$value',
                {
                  $multiply: [
                    { $ifNull: ['$$this.price', zero] },
                    { $ifNull: ['$$this.quantity', 0] },
                  ],
                },
              ],
            },
          },
        },
      },
    },
    {
      $group: {
        _id: '$storeLocation',
        sales: { $sum: 1 },
        avgSatisfaction: { $avg: '$customer.satisfaction' },
        couponsUsed: {
          $sum: { $cond: ['$couponUsed', 1, 0] },
        },
        revenue: { $sum: '$saleRevenue' },
      },
    },
    {
      $set: {
        couponRate: {
          $cond: [
            { $eq: ['$sales', 0] },
            null,
            { $divide: ['$couponsUsed', '$sales'] },
          ],
        },
        revenuePerSale: {
          $cond: [
            { $eq: ['$sales', 0] },
            null,
            { $divide: ['$revenue', '$sales'] },
          ],
        },
      },
    },
    {
      $project: {
        _id: 0,
        store: '$_id',
        sales: 1,
        avgSatisfaction: 1,
        couponRate: 1,
        revenue: 1,
        revenuePerSale: 1,
      },
    },
    { $sort: { store: 1 } },
  ];
}

module.exports = {
  getPipeline,
  DEFAULT_DB: 'sample_supplies',
  DEFAULT_COLL: 'sales',
};
