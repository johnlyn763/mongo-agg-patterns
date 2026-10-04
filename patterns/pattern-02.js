'use strict';

/**
 * Pattern 2 — Top-N per category
 *
 * @param {object} [opts]
 * @param {number} [opts.n=5]
 * @param {Date}   [opts.start]
 * @param {Date}   [opts.end]
 * @returns {object[]}
 */
function getPipeline(opts = {}) {
  const n = opts.n ?? 5;
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
          store: '$storeLocation',
          product: '$items.name',
        },
        revenue: { $sum: '$lineRevenue' },
        units: { $sum: '$items.quantity' },
      },
    },
    { $sort: { '_id.store': 1, revenue: -1 } },
    {
      $group: {
        _id: '$_id.store',
        topProducts: {
          $push: {
            product: '$_id.product',
            revenue: '$revenue',
            units: '$units',
          },
        },
      },
    },
    {
      $project: {
        _id: 0,
        store: '$_id',
        topProducts: { $slice: ['$topProducts', n] },
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
