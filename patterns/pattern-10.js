'use strict';

/**
 * Pattern 10 — Pagination-friendly report pages
 *
 * @param {object} [opts]
 * @param {number} [opts.pageSize=25]
 * @param {number} [opts.page=0]  zero-based
 * @param {Date}   [opts.start]
 * @param {Date}   [opts.end]
 * @returns {object[]}
 */
function getPipeline(opts = {}) {
  const pageSize = opts.pageSize ?? 25;
  const page = opts.page ?? 0;
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
    { $sort: { saleDate: -1, _id: -1 } },
    {
      $facet: {
        rows: [
          { $skip: pageSize * page },
          { $limit: pageSize },
          {
            $project: {
              _id: 1,
              saleDate: 1,
              storeLocation: 1,
              purchaseMethod: 1,
              email: '$customer.email',
              itemCount: { $size: { $ifNull: ['$items', []] } },
            },
          },
        ],
        meta: [{ $count: 'total' }],
      },
    },
    {
      $project: {
        rows: 1,
        total: {
          $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0],
        },
      },
    },
  ];
}

/**
 * Keyset pagination variation (deep pages).
 *
 * @param {object} opts
 * @param {number} [opts.pageSize=25]
 * @param {Date}   opts.lastSaleDate
 * @param {import('mongodb').ObjectId} opts.lastId
 * @returns {object[]}
 */
function getKeysetPipeline(opts = {}) {
  const pageSize = opts.pageSize ?? 25;
  const lastSaleDate = opts.lastSaleDate;
  const lastId = opts.lastId;

  return [
    {
      $match: {
        $or: [
          { saleDate: { $lt: lastSaleDate } },
          { saleDate: lastSaleDate, _id: { $lt: lastId } },
        ],
      },
    },
    { $sort: { saleDate: -1, _id: -1 } },
    { $limit: pageSize },
    {
      $project: {
        _id: 1,
        saleDate: 1,
        storeLocation: 1,
        purchaseMethod: 1,
        email: '$customer.email',
      },
    },
  ];
}

module.exports = {
  getPipeline,
  getKeysetPipeline,
  DEFAULT_DB: 'sample_supplies',
  DEFAULT_COLL: 'sales',
};
