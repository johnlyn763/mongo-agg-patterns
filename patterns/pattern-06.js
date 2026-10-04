'use strict';

/**
 * Pattern 6 — Multi-collection report via $lookup (sample_mflix)
 *
 * @param {object} [opts]
 * @param {number} [opts.yearGte=2000]
 * @param {string} [opts.type='movie']
 * @param {number} [opts.limit=50]
 * @returns {object[]}
 */
function getPipeline(opts = {}) {
  const yearGte = opts.yearGte ?? 2000;
  const type = opts.type ?? 'movie';
  const limit = opts.limit ?? 50;

  return [
    {
      $match: {
        year: { $gte: yearGte },
        type,
      },
    },
    { $limit: limit },
    {
      $lookup: {
        from: 'comments',
        let: { movieId: '$_id' },
        pipeline: [
          {
            $match: {
              $expr: { $eq: ['$movie_id', '$$movieId'] },
            },
          },
          {
            $project: {
              _id: 0,
              date: 1,
              name: 1,
            },
          },
        ],
        as: 'commentDocs',
      },
    },
    {
      $project: {
        _id: 0,
        title: 1,
        year: 1,
        imdbRating: '$imdb.rating',
        commentCount: { $size: '$commentDocs' },
        latestCommentAt: { $max: '$commentDocs.date' },
      },
    },
    { $sort: { commentCount: -1, title: 1 } },
  ];
}

module.exports = {
  getPipeline,
  DEFAULT_DB: 'sample_mflix',
  DEFAULT_COLL: 'movies',
};
