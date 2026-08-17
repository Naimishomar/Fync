import mongoose from 'mongoose';

/**
 * Atomically toggle a user's membership in an array field and keep its counter
 * exactly equal to the array's length.
 *
 * Seven handlers had hand-rolled this as: read the document, check membership,
 * then `$inc` the counter in a second write. Two taps arriving together — a
 * double-tap, or a retry after a flaky response — both read the same "not liked"
 * state, both incremented, while `$addToSet` added the user once. The counter
 * drifted above reality and never recovered, and un-liking a row that had
 * already drifted to zero pushed it negative.
 *
 * Here the filter carries the membership test, so the write only applies when
 * membership actually changes, and the counter is *derived* from the array
 * rather than tracked beside it — which also heals rows that already drifted.
 *
 * @returns {{doc: object, liked: boolean} | null}  null when the document is gone.
 */
export const toggleLike = async (
  Model,
  docId,
  userId,
  { arrayField = 'liked_by', countField = 'likes', alsoAdd = [], alsoRemove = [] } = {}
) => {
  const uid = new mongoose.Types.ObjectId(String(userId));
  const arr = (f) => ({ $ifNull: [`$${f}`, []] });
  const without = (f) => ({ $filter: { input: arr(f), cond: { $ne: ['$$this', uid] } } });

  const addStage = { [arrayField]: { $setUnion: [arr(arrayField), [uid]] } };
  for (const f of alsoAdd) addStage[f] = { $setUnion: [arr(f), [uid]] };
  for (const f of alsoRemove) addStage[f] = without(f);

  const added = await Model.findOneAndUpdate(
    { _id: docId, [arrayField]: { $ne: uid } },
    [{ $set: addStage }, { $set: { [countField]: { $size: `$${arrayField}` } } }],
    { new: true }
  );
  if (added) return { doc: added, liked: true };

  const removeStage = { [arrayField]: without(arrayField) };
  for (const f of alsoAdd) removeStage[f] = without(f);

  const removed = await Model.findOneAndUpdate(
    { _id: docId, [arrayField]: uid },
    [{ $set: removeStage }, { $set: { [countField]: { $size: `$${arrayField}` } } }],
    { new: true }
  );
  if (removed) return { doc: removed, liked: false };

  return null;
};

export default toggleLike;
