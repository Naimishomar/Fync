/**
 * ============================================================
 *  FYNC — Feed Session Manager
 * ============================================================
 *  Runs entirely on the client device (AsyncStorage).
 *  ZERO server/DB writes for session or seen tracking.
 *
 *  What it does:
 *  - Detects when the user opens the app fresh (after 15 min gap)
 *  - Maintains a per-session list of seen post/short IDs
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
}

// ─────────────────────────────────────────────────────────────
//  SESSION DETECTION
// ─────────────────────────────────────────────────────────────

/**
 * Call this on every app open (home screen mount / shorts mount).
 * Returns true if this is a brand-new session (app was closed 15+ min ago).
 * On new session: seenIds are cleared → user gets a fresh feed.
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
        const elapsed = now - session.startedAt;

        if (elapsed > SESSION_EXPIRY_MS) {
            // App was inactive for >15 min — start fresh
            await Promise.all([
                _saveSession(now),
                AsyncStorage.removeItem(KEYS.SEEN_POSTS),
                AsyncStorage.removeItem(KEYS.SEEN_SHORTS),
            ]);
            return true;
        }

        return false; // same session still active
    } catch {
        return true; // safe default on error
    }
}

async function _saveSession(timestamp: number): Promise<void> {
    const session: FeedSession = {
        id: Math.random().toString(36).substring(2, 10),
        startedAt: timestamp,
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
