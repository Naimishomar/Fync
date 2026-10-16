/**
 * ============================================================
 *  FYNC — Feed Session Manager
 * ============================================================
 *  Runs entirely on the client device (AsyncStorage).
 *  ZERO server/DB writes for session or seen tracking.
 *
 *  What it does:
 *  - Detects when the user opens the app fresh (15 min since last activity)
 *  - Maintains a durable list of seen post/short IDs across sessions
 *  - Sends a Bloom filter of seen ids so duplicates are skipped
 *  - When backend returns mode='recycled' (all content seen),
 *    automatically resets so the next fetch is fresh again
 *  - Two rotating generations of GEN_CAPACITY ids each: the filter remembers
 *    ~1,600 ids in a fixed 2 KB, forgetting the oldest half at a time
 * ============================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { BLOOM_BITS, BLOOM_K, addToBits, emptyBits, fromBase64, toBase64 } from './bloom';

// ─── Storage Keys ─────────────────────────────────────────────
const KEYS = {
    SESSION: 'fync:feed:session',
    SEEN_POSTS: 'fync:feed:seen_posts_bloom',
    SEEN_SHORTS: 'fync:feed:seen_shorts_bloom',
};

/** The id lists the previous version stored; imported once, then removed. */
const LEGACY_KEYS: Record<string, string> = {
    [KEYS.SEEN_POSTS]: 'fync:feed:seen_posts',
    [KEYS.SEEN_SHORTS]: 'fync:feed:seen_shorts',
};

// ─── Constants ────────────────────────────────────────────────
// 15 min is ideal for apps with limited content:
// users get a freshly re-ranked feed every 15 min of inactivity
const SESSION_EXPIRY_MS = 15 * 60 * 1000;
/** Ids per generation. Two generations OR'd together stay at ~1% false
 *  positives in BLOOM_BITS (n ≈ 1,600 for m = 16,384, k = 7). */
const GEN_CAPACITY = 800;

interface SeenState { cur: Uint8Array; prev: Uint8Array | null; n: number }
interface StoredSeen { cur: string; prev: string | null; n: number }

/** What the feed endpoints accept as `seenBloom` (see backend/utils/bloom.js). */
export interface SeenBloom { m: number; k: number; b: string }

interface FeedSession {
    id: string;
    startedAt: number;
    /** Optional so a session written by the previous version still parses. */
    lastActiveAt?: number;
}

// ─────────────────────────────────────────────────────────────
//  SESSION DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Call this on every app open (home screen mount / shorts mount).
 * Returns true if this is a brand-new session.
 *
 * A new session does NOT clear what has been seen.
 *
 * It used to. Opening the app after a 15-minute gap wiped both seen lists, so
 * the very next request had nothing to exclude and returned the same newest
 * posts again — which is the "same content every time I open the app" problem
 * this file exists to prevent. Exhaustion is already handled properly: the
 * server replies mode='recycled' and the caller resets then, at the point where
 * resetting is the right thing to do.
 *
 * The gap is also measured from last activity now, not from session start. The
 * old comparison used startedAt, so a user who simply kept scrolling for fifteen
 * minutes was declared "inactive" and had their history cleared mid-feed.
 */
export async function checkAndStartSession(): Promise<boolean> {
    try {
        const raw = await AsyncStorage.getItem(KEYS.SESSION);
        const now = Date.now();

        if (!raw) {
            await _saveSession(now);
            return true;
        }

        const session: FeedSession = JSON.parse(raw);
        const lastSeen = session.lastActiveAt ?? session.startedAt;
        const isNew = now - lastSeen > SESSION_EXPIRY_MS;

        // Always refresh the activity stamp; only the id changes on a new session.
        await _saveSession(isNew ? now : session.startedAt, now, isNew ? undefined : session.id);
        return isNew;
    } catch {
        return true; // safe default on error
    }
}

async function _saveSession(startedAt: number, lastActiveAt = startedAt, id?: string): Promise<void> {
    const session: FeedSession = {
        id: id ?? Math.random().toString(36).substring(2, 10),
        startedAt,
        lastActiveAt,
    };
    await AsyncStorage.setItem(KEYS.SESSION, JSON.stringify(session));
}

// ─────────────────────────────────────────────────────────────
//  SEEN ID READ
// ─────────────────────────────────────────────────────────────

async function _loadSeen(key: string): Promise<SeenState> {
    const size = BLOOM_BITS / 8;
    try {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
            const st: StoredSeen = JSON.parse(raw);
            return {
                cur: fromBase64(st.cur, size),
                prev: st.prev ? fromBase64(st.prev, size) : null,
                n: st.n || 0,
            };
        }
        // First run on this version: carry over the old id list so nobody's
        // feed starts repeating after the update.
        const legacy = await AsyncStorage.getItem(LEGACY_KEYS[key]);
        const state: SeenState = { cur: emptyBits(), prev: null, n: 0 };
        if (legacy) {
            const ids: string[] = JSON.parse(legacy);
            if (Array.isArray(ids)) ids.forEach((id) => addToBits(state.cur, String(id)));
            state.n = Array.isArray(ids) ? ids.length : 0;
            await _saveSeen(key, state);
            AsyncStorage.removeItem(LEGACY_KEYS[key]).catch(() => {});
        }
        return state;
    } catch {
        return { cur: emptyBits(), prev: null, n: 0 };
    }
}

async function _saveSeen(key: string, st: SeenState): Promise<void> {
    const stored: StoredSeen = { cur: toBase64(st.cur), prev: st.prev ? toBase64(st.prev) : null, n: st.n };
    await AsyncStorage.setItem(key, JSON.stringify(stored));
}

async function _seenBloom(key: string): Promise<SeenBloom> {
    const st = await _loadSeen(key);
    const bits = st.cur.slice();
    if (st.prev) for (let i = 0; i < bits.length; i++) bits[i] |= st.prev[i];
    return { m: BLOOM_BITS, k: BLOOM_K, b: toBase64(bits) };
}

/** Pass as `seenBloom` in the body of POST /post/smart-feed. */
export function getSeenPostsBloom(): Promise<SeenBloom> {
    return _seenBloom(KEYS.SEEN_POSTS);
}

/** Pass as `seenBloom` in the body of POST /shorts/smart. */
export function getSeenShortsBloom(): Promise<SeenBloom> {
    return _seenBloom(KEYS.SEEN_SHORTS);
}

// ─────────────────────────────────────────────────────────────
//  SEEN ID WRITE
// ─────────────────────────────────────────────────────────────

/**
 * Mark post IDs as seen in AsyncStorage (zero DB write).
 */
export async function markPostsAsSeen(ids: string[]): Promise<void> {
    await _appendSeen(KEYS.SEEN_POSTS, ids);
}

/**
 * Mark short IDs as seen in AsyncStorage (zero DB write).
 */
export async function markShortsAsSeen(ids: string[]): Promise<void> {
    await _appendSeen(KEYS.SEEN_SHORTS, ids);
}

// Serialised per key: two quick appends must not both load the same state and
// have the second write drop the first one's ids.
const writeChain: Record<string, Promise<void>> = {};

function _appendSeen(key: string, newIds: string[]): Promise<void> {
    const run = async () => {
        const st = await _loadSeen(key);
        for (const id of newIds) {
            if (st.n >= GEN_CAPACITY) {
                st.prev = st.cur;
                st.cur = emptyBits();
                st.n = 0;
            }
            addToBits(st.cur, String(id));
            st.n++;
        }
        await _saveSeen(key, st);
    };
    writeChain[key] = (writeChain[key] ?? Promise.resolve()).then(run).catch(() => { /* silent */ });
    return writeChain[key];
}

// ─────────────────────────────────────────────────────────────
//  RESET HELPERS
// ─────────────────────────────────────────────────────────────

/**
 * Reset ONLY the posts seen list.
 *
 * ★ KEY for limited-content apps ★
 * Call this automatically when the backend returns mode='recycled'
 * (meaning the user has seen all available posts).
 * This ensures the NEXT fetch gets a freshly ranked feed immediately —
 * the user never gets stuck staring at "recycled" content.
 */
export async function resetSeenPosts(): Promise<void> {
    try {
        await AsyncStorage.multiRemove([KEYS.SEEN_POSTS, LEGACY_KEYS[KEYS.SEEN_POSTS]]);
    } catch { /* silent */ }
}

/**
 * Reset ONLY the shorts seen list.
 * Same logic as resetSeenPosts — call on mode='recycled' from the shorts endpoint.
 */
export async function resetSeenShorts(): Promise<void> {
    try {
        await AsyncStorage.multiRemove([KEYS.SEEN_SHORTS, LEGACY_KEYS[KEYS.SEEN_SHORTS]]);
    } catch { /* silent */ }
}

/**
 * Full reset — use for a "Refresh Feed" button in Settings.
 * Clears session + all seen lists so next open is completely fresh.
 */
export async function resetSeenLists(): Promise<void> {
    await Promise.all([
        AsyncStorage.multiRemove([KEYS.SEEN_POSTS, LEGACY_KEYS[KEYS.SEEN_POSTS]]),
        AsyncStorage.multiRemove([KEYS.SEEN_SHORTS, LEGACY_KEYS[KEYS.SEEN_SHORTS]]),
        AsyncStorage.removeItem(KEYS.SESSION),
    ]);
}
