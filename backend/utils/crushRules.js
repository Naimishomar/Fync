/** Rules for "Dil Se" (crush match). Pure, so they can be tested without a DB. */
export const MAX_PICKS = 3;
// A pick can't be removed for a week. Without the lock, picking and dropping
// people one after another would reveal who picked you (a match fires instantly).
export const LOCK_DAYS = 7;
const DAY = 86400000;

export const unlockAt = (createdAt) => new Date(new Date(createdAt).getTime() + LOCK_DAYS * DAY);
export const canRemove = (createdAt, now = new Date()) => now >= unlockAt(createdAt);

/** Why a pick is refused, or null when it is allowed. */
export const pickError = ({ me, target, myPickCount, alreadyPicked, blocked }) => {
    if (!target) return "User not found";
    if (String(target._id) === String(me._id)) return "You can't pick yourself";
    if (!me.college || target.college !== me.college) return "You can only pick someone from your college";
    if (blocked) return "You can't pick this person";
    if (alreadyPicked) return "Already in your picks";
    if (myPickCount >= MAX_PICKS) return `You can pick up to ${MAX_PICKS} people`;
    return null;
};
