/**
 * One-time backfill: turn the ObjectIds already sitting in `repostedBy` into
 * Repost rows, so reposts made before the collection existed keep showing up
 * on profiles. Safe to re-run — the rows are upserted.
 *
 *   node backend/scripts/backfillReposts.mjs
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import Shorts from '../models/shorts.model.js';
import Repost from '../models/repost.model.js';

const SOURCES = [
  { Model: Post, postType: 'Post' },
  { Model: Shorts, postType: 'Shorts' },
];

const run = async () => {
  await mongoose.connect(process.env.MONGO_URI);

  let written = 0;
  for (const { Model, postType } of SOURCES) {
    const docs = await Model.find({ 'repostedBy.0': { $exists: true } })
      .select('repostedBy createdAt')
      .lean();

    for (const doc of docs) {
      for (const user of doc.repostedBy ?? []) {
        // The original repost time is gone, so the post's own date is the
        // closest honest stand-in.
        const result = await Repost.updateOne(
          { post: doc._id, user },
          { $setOnInsert: { post: doc._id, user, postType, text: '', createdAt: doc.createdAt, updatedAt: doc.createdAt } },
          { upsert: true },
        );
        if (result.upsertedCount) written += 1;
      }
    }
  }

  console.log(`Backfilled ${written} repost rows.`);
  await mongoose.disconnect();
};

run().catch((error) => {
  console.error('Backfill failed:', error);
  process.exit(1);
});
