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
 *  - Sends seenIds to the backend so duplicates are skipped
 *  - When backend returns mode='recycled' (all content seen),
 *    automatically resets so the next fetch is fresh again
 *  - Caps the seenIds list at 200 to keep payloads small
 * ============================================================
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// ─── Storage Keys ─────────────────────────────────────────────
const KEYS = {
    SESSION: 'fync:feed:session',
    SEEN_POSTS: 'fync:feed:seen_posts',
    SEEN_SHORTS: 'fync:feed:seen_shorts',
};

// ─── Constants ────────────────────────────────────────────────
// 15 min is ideal for apps with limited content:
// users get a freshly re-ranked feed every 15 min of inactivity
const SESSION_EXPIRY_MS = 15 * 60 * 1000;
const MAX_SEEN_IDS = 200; // keeps server payload small

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

/**
 * Returns the list of already-seen post IDs for this session.
 * Pass this as `seenIds` in the body of POST /post/smart-feed.
 */
export async function getSeenPostIds(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(KEYS.SEEN_POSTS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * Returns the list of already-seen short IDs for this session.
 * Pass this as `seenIds` in the body of POST /shorts/smart.
 */
export async function getSeenShortIds(): Promise<string[]> {
    try {
        const raw = await AsyncStorage.getItem(KEYS.SEEN_SHORTS);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

// ─────────────────────────────────────────────────────────────
//  SEEN ID WRITE
// ─────────────────────────────────────────────────────────────

/**
 * Mark post IDs as seen in AsyncStorage (zero DB write).
 */
export async function markPostsAsSeen(ids: string[]): Promise<void> {
    _appendSeen(KEYS.SEEN_POSTS, ids);
}

/**
 * Mark short IDs as seen in AsyncStorage (zero DB write).
 */
export async function markShortsAsSeen(ids: string[]): Promise<void> {
    _appendSeen(KEYS.SEEN_SHORTS, ids);
}

async function _appendSeen(key: string, newIds: string[]): Promise<void> {
    try {
        const raw = await AsyncStorage.getItem(key);
        const existing: string[] = raw ? JSON.parse(raw) : [];
        const capped = [...existing, ...newIds].slice(-MAX_SEEN_IDS);
        await AsyncStorage.setItem(key, JSON.stringify(capped));
    } catch { /* silent */ }
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
        await AsyncStorage.removeItem(KEYS.SEEN_POSTS);
    } catch { /* silent */ }
}

/**
 * Reset ONLY the shorts seen list.
 * Same logic as resetSeenPosts — call on mode='recycled' from the shorts endpoint.
 */
export async function resetSeenShorts(): Promise<void> {
    try {
        await AsyncStorage.removeItem(KEYS.SEEN_SHORTS);
    } catch { /* silent */ }
}

/**
 * Full reset — use for a "Refresh Feed" button in Settings.
 * Clears session + all seen lists so next open is completely fresh.
 */
export async function resetSeenLists(): Promise<void> {
    await Promise.all([
        AsyncStorage.removeItem(KEYS.SEEN_POSTS),
        AsyncStorage.removeItem(KEYS.SEEN_SHORTS),
        AsyncStorage.removeItem(KEYS.SESSION),
    ]);
}
