/**
 * One-time repair: rebuild the `comments` array on posts and shorts from the
 * comment collection.
 *
 * Comments were written to their own collection but never pushed onto the
 * parent document, while deletes did $pull from it — so the arrays drifted
 * towards empty and anything reading them (the feed's comment preview and its
 * count) under-reported. Safe to re-run.
 *
 *   node backend/scripts/rebuildCommentArrays.mjs
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import Shorts from '../models/shorts.model.js';
import Comment from '../models/comment.model.js';

const SOURCES = [
  { Model: Post, postType: 'Post' },
  { Model: Shorts, postType: 'Shorts' },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  for (const { Model, postType } of SOURCES) {
    const grouped = await Comment.aggregate([
      { $match: { postType } },
      { $sort: { createdAt: 1 } },
      { $group: { _id: '$post', ids: { $push: '$_id' } } },
    ]);

    if (grouped.length === 0) {
      console.log(`${postType}: nothing to rebuild.`);
      continue;
    }

    const result = await Model.bulkWrite(
      grouped.map((row) => ({
        updateOne: { filter: { _id: row._id }, update: { $set: { comments: row.ids } } },
      })),
    );
    console.log(`${postType}: rebuilt ${result.modifiedCount} of ${grouped.length} documents.`);
  }

  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Rebuild failed:', error);
  process.exit(1);
});
