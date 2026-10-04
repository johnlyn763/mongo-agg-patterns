'use strict';

/**
 * Pattern 7 — Faceted dashboard payload
 *
 * @param {object} [opts]
 * @param {Date}   [opts.start]
 * @param {Date}   [opts.end]
 * @param {number} [opts.recentLimit=10]
 * @returns {object[]}
 */
function getPipeline(opts = {}) {
  const start = opts.start ?? new Date('2015-01-01T00:00:00Z');
  const end = opts.end ?? new Date('2016-01-01T00:00:00Z');
  const recentLimit = opts.recentLimit ?? 10;

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
      $facet: {
        kpis: [
          {
            $group: {
              _id: null,
              sales: { $sum: 1 },
              coupons: {
                $sum: { $cond: ['$couponUsed', 1, 0] },
              },
              avgSatisfaction: { $avg: '$customer.satisfaction' },
            },
          },
          { $project: { _id: 0 } },
        ],
        byStore: [
          {
            $group: {
              _id: '$storeLocation',
              sales: { $sum: 1 },
            },
          },
          {
            $project: {
              _id: 0,
              store: '$_id',
              sales: 1,
            },
          },
          { $sort: { sales: -1 } },
        ],
        recent: [
          { $sort: { saleDate: -1 } },
          { $limit: recentLimit },
          {
            $project: {
              _id: 0,
              saleDate: 1,
              storeLocation: 1,
              purchaseMethod: 1,
              email: '$customer.email',
            },
          },
        ],
      },
    },
  ];
}

module.exports = {
  getPipeline,
  DEFAULT_DB: 'sample_supplies',
  DEFAULT_COLL: 'sales',
};
