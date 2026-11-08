/**
 * ============================================================
 *  FYNC FEED ENGINE — Industry-Grade Recommendation System
 * ============================================================
 *
 *  Architecture (same pattern used by Instagram / TikTok / LinkedIn):
 *
 *  1. CANDIDATE GENERATION (MongoDB → Redis)
 *     - Fetch a pool of candidate posts/shorts from MongoDB once
 *     - Cache the pool in Redis for 5 minutes (college-scoped)
 *     - All repeat requests within 5 min hit Redis only → ZERO extra DB load
 *
 *  2. AI INTEREST SCORING (Gemini → Redis)
 *     - Use Gemini to generate a "user interest profile" (keyword weights)
 *     - Cache the profile per user for 24 hours in Redis
 *     - Only re-computed once a day → minimal Gemini API usage
 *
 *  3. IN-MEMORY RANKING (Node.js)
 *     - Score every candidate post using:
 *         finalScore = interestScore(0.35) + engagementScore(0.35) + recencyScore(0.20) + diversityBonus(0.10)
 *     - Filter out client-supplied seenIds (NO DB write needed)
 *     - Shuffle within same score tier (prevents repetition)
 *     - Return top N results
 *
 *  DB LOAD IMPACT: Same as before. One query → cached 5 min.
 *  No extra user-document writes. No extra queries.
 * ============================================================
 */

import redisClient from './redis.js';
import mongoose from 'mongoose';
import { GoogleGenAI } from '@google/genai';
import { GEMINI_MODEL } from './geminiModel.js';

// ─── Lazy Gemini init ────────────────────────────────────────
// Matches the same SDK & pattern used in gemini.js (already working).
// Lazy so a missing env var at startup doesn't crash the module import.
let _genAI = null;
function getGenAI() {
    if (!_genAI) {
        _genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return _genAI;
}

// ─── Cache TTLs ──────────────────────────────────────────────
const CANDIDATE_POOL_TTL = 5 * 60;        // 5 minutes — post/shorts pool per college
// A user's interests do not change daily, but a 24h TTL billed one Gemini call
// per active user per day: at 5k DAU that is ~150k calls/month. Seven days cuts
// it by 7x for a profile that is about as accurate either way.
const USER_INTEREST_PROFILE_TTL = 7 * 24 * 60 * 60; // 7 days — AI interest profile per user
const GEMINI_TIMEOUT_MS = 5000;
const FEED_POOL_KEY = (type) => `fync:pool:${type}:global`;
// Bumped whenever the pool is invalidated, so a client paging through an old
// pool is told to restart rather than silently interleaving two orderings.
const FEED_POOL_VERSION_KEY = (type) => `fync:pool:${type}:version`;
const USER_PROFILE_KEY = (userId) => `fync:profile:${userId}`;

// ─── Safe Redis wrapper (never crashes the app if Redis is down) ──
async function rGet(key) {
    try { return await redisClient.get(key); }
    catch { return null; }
}
async function rSet(key, value, ttl) {
    try { await redisClient.setEx(key, ttl, value); }
    catch { /* silent fail */ }
}

// ─────────────────────────────────────────────────────────────
//  STEP 1 — Candidate Pool (Redis-first, MongoDB fallback)
// ─────────────────────────────────────────────────────────────

// Membership arrays grow with every like and were JSON-parsed whole on every
// page. The pool keeps counts only; freshenPage() adds back the viewer's own
// membership (and live counts) for the handful of items actually sent.
const POOL_SLIM = '-liked_by -upvoted_by -downvoted_by -repostedBy';
const POOL_LOCK_KEY = (type) => `fync:pool:${type}:lock`;
const POOL_LOCK_MS = 5000;
const POOL_WAIT_MS = 100;
const POOL_WAIT_TRIES = 8;

const toCommentCount = ({ comments, ...item }) => ({ ...item, commentCount: comments?.length ?? 0 });

/**
 * Redis-first pool read with a single rebuilder. Without the lock, every
 * request that landed between a pool drop and the first rebuild ran the same
 * 150-row populate. Losers wait briefly for the winner's copy; if it never
 * shows (winner crashed, Redis down) they build it themselves.
 */
async function loadPool(type, build) {
    const key = FEED_POOL_KEY(type);
    const cached = await rGet(key);
    if (cached) return JSON.parse(cached);

    let won = true;
    try {
        won = !!(await redisClient.set(POOL_LOCK_KEY(type), '1', { NX: true, PX: POOL_LOCK_MS }));
    } catch { /* Redis down: just build */ }

    if (!won) {
        for (let i = 0; i < POOL_WAIT_TRIES; i++) {
            await new Promise((r) => setTimeout(r, POOL_WAIT_MS));
            const retry = await rGet(key);
            if (retry) return JSON.parse(retry);
        }
    }

    try {
        const version = await getPoolVersion(type);
        const items = (await build()).map(toCommentCount);
        // A create/delete that landed mid-build would otherwise be overwritten
        // by this older snapshot for the full TTL.
        if (version === await getPoolVersion(type)) {
            await rSet(key, JSON.stringify(items), CANDIDATE_POOL_TTL);
        }
        return items;
    } finally {
        if (won) redisClient.del(POOL_LOCK_KEY(type)).catch(() => {});
    }
}

/**
 * Returns a cached pool of posts for a college.
 * DB is hit at most once every 5 minutes per college.
 */
export async function getCandidatePool(PostModel, poolSize = 150) {
    // No comments here: the pool lives in Redis for five minutes, and a comment
    // count that stale is what showed 0 on posts that already had replies. The
    // page that actually gets sent attaches them fresh instead.
    return loadPool('posts', () => PostModel
        .find({ isPrivate: { $ne: true } })
        .select(POOL_SLIM)
        .sort({ createdAt: -1 })
        .limit(poolSize)
        .populate('user', 'name username avatar user_access')
        .lean());
}

/**
 * Returns a cached pool of shorts (not college-scoped — all shorts).
 * DB is hit at most once every 5 minutes.
 */
export async function getShortsPool(ShortsModel, poolSize = 80) {
    return loadPool('shorts', () => ShortsModel
        .find()
        .select(POOL_SLIM)
        .sort({ createdAt: -1 })
        .limit(poolSize)
        .populate('user', 'name username avatar upiId user_access')
        .lean());
}

/**
 * One indexed _id lookup for the page being sent: live counters plus whether
 * the viewer is in liked_by / repostedBy ($elemMatch returns [me] or nothing,
 * never the whole array). Keeps the shape the client checks with
 * `liked_by.some(id => id === me)`.
 */
export async function freshenPage(Model, items, userId) {
    if (!items.length) return items;
    const me = new mongoose.Types.ObjectId(String(userId));
    const rows = await Model.find(
        { _id: { $in: items.map((i) => i._id) } },
        {
            likes: 1, reposts: 1, views: 1, isPrivate: 1,
            liked_by: { $elemMatch: { $eq: me } },
            repostedBy: { $elemMatch: { $eq: me } },
        }
    ).lean();
    return mergeFresh(items, rows);
}

/** Pure half of freshenPage. Items whose row is gone (deleted) or now private are dropped. */
export function mergeFresh(items, rows) {
    const byId = new Map(rows.map((r) => [String(r._id), r]));
    const out = [];
    for (const item of items) {
        const row = byId.get(String(item._id));
        if (!row || row.isPrivate === true) continue;
        const { _id, isPrivate, liked_by, repostedBy, ...counts } = row;
        out.push({ ...item, ...counts, liked_by: liked_by ?? [], repostedBy: repostedBy ?? [] });
    }
    return out;
}

// ─────────────────────────────────────────────────────────────
//  STEP 2 — AI User Interest Profile (Gemini → Redis)
// ─────────────────────────────────────────────────────────────

/**
 * Uses Gemini to analyze user's interests/hobbies/skills and returns
 * a list of weighted keywords for matching against post descriptions.
 * Result is cached in Redis for 24 hours per user.
 *
 * Example output:
 *   { keywords: ["machine learning", "coding", "python", "tech", "startup"] }
 */
export async function getUserInterestProfile(userId, loadUser) {
    const cacheKey = USER_PROFILE_KEY(userId);

    // Cache first: the user document is only needed to build a missing profile.
    const cached = await rGet(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }
    const user = (await loadUser()) || {};

    // Build user context for Gemini
    const userContext = [
        user.interest?.join(', '),
        user.hobbies?.join(', '),
        user.skills?.join(', '),
        user.major,
        user.about
    ].filter(Boolean).join('. ');

    if (!userContext.trim()) {
        // No user data yet — return empty profile (will use engagement-only scoring)
        const empty = { keywords: [] };
        await rSet(cacheKey, JSON.stringify(empty), USER_INTEREST_PROFILE_TTL);
        return empty;
    }

    try {
        const prompt = `
You are a content recommendation engine for a college social app called Fync.

Given this user profile:
"""
${userContext}
"""

Extract the 10 most relevant content keywords/topics this user would enjoy seeing in their feed.
Return ONLY a raw JSON object like: { "keywords": ["keyword1", "keyword2", ...] }
No explanation, no markdown, no extra text.
        `.trim();

        // Use the same SDK and model that already works in gemini.js
        // A hung Gemini call used to hold the feed request open indefinitely.
        let timer;
        const response = await Promise.race([
            getGenAI().models.generateContent({ model: GEMINI_MODEL, contents: prompt }),
            new Promise((_, reject) => {
                timer = setTimeout(() => reject(new Error('Gemini timeout')), GEMINI_TIMEOUT_MS);
            }),
        ]).finally(() => clearTimeout(timer));
        const text = response.text
            .replace(/```json/g, '')
            .replace(/```/g, '')
            .trim();

        const profile = JSON.parse(text);
        await rSet(cacheKey, JSON.stringify(profile), USER_INTEREST_PROFILE_TTL);
        return profile;
    } catch (err) {
        console.log('Gemini interest profile error (using fallback):', err.message);
        // Graceful fallback — use raw interests directly as keywords
        const fallback = {
            keywords: [
                ...(user.interest || []),
                ...(user.hobbies || []),
                ...(user.skills || [])
            ].slice(0, 10)
        };
        await rSet(cacheKey, JSON.stringify(fallback), USER_INTEREST_PROFILE_TTL);
        return fallback;
    }
}

// ─────────────────────────────────────────────────────────────
//  STEP 3 — In-Memory Scoring Engine
// ─────────────────────────────────────────────────────────────

/**
 * Scores a single post/short against the user's interest profile.
 *
 * Score components (mirrors Instagram/TikTok internal ranking):
 *   - Interest Match  (35%): keyword overlap between user profile and content
 *   - Engagement      (35%): likes, comments, views normalized
 *   - Recency         (20%): exponential decay — newer content ranked higher
 *   - Diversity Bonus (10%): penalizes multiple posts from same author
 */
function scoreItem(item, interestKeywords, authorSeenCounts) {
    // ── Interest Score (0–1) ──────────────────────────────────
    let interestScore = 0;
    if (interestKeywords.length > 0) {
        const text = [
            item.description || '',
            item.title || '',
        ].join(' ').toLowerCase();

        let matches = 0;
        for (const kw of interestKeywords) {
            if (text.includes(kw.toLowerCase())) matches++;
        }
        interestScore = matches / interestKeywords.length;
    }

    // ── Engagement Score (0–1) ────────────────────────────────
    const likes = item.likes || 0;
    const comments = item.commentCount ?? item.comments?.length ?? 0;
    const views = item.views || 0;
    // Normalize: cap at reasonable max values, log-scale for fairness
    const engagementRaw = (likes * 2) + (comments * 3) + (views * 0.1);
    const engagementScore = Math.min(1, engagementRaw / 500); // 500 = "very popular"

    // ── Recency Score (0–1) ───────────────────────────────────
    const ageHours = (Date.now() - new Date(item.createdAt).getTime()) / 3600000;
    // Exponential decay: half-life = 48 hours
    const recencyScore = Math.exp(-0.0144 * ageHours); // ln(2)/48 ≈ 0.0144

    // ── Diversity Penalty ─────────────────────────────────────
    // Penalize if we've already seen multiple posts from this author in this batch
    const authorId = item.user?._id?.toString() || item.user?.toString();
    const authorCount = authorSeenCounts[authorId] || 0;
    const diversityBonus = authorCount === 0 ? 1.0 : authorCount === 1 ? 0.6 : 0.2;

    // ── Final Weighted Score ──────────────────────────────────
    const finalScore =
        (interestScore * 0.35) +
        (engagementScore * 0.35) +
        (recencyScore * 0.20) +
        (diversityBonus * 0.10);

    return finalScore;
}

/**
 * Deterministic per-(user, pool) jitter, replacing a Math.random() shuffle.
 *
 * The old version re-shuffled the whole ranked list on EVERY request and then
 * sliced page N out of it. Page 1 and page 2 were therefore cut from two
 * different orderings, so scrolling showed some posts twice and skipped others
 * entirely -- the feed's most visible bug. Deriving the jitter from a hash of
 * (itemId, seed) keeps the ordering stable for a whole session while still
 * giving every user a different feed and reshuffling when the pool changes.
 */
function hashToUnit(str) {
    // FNV-1a, 32-bit. Cheap, no dependency, well-distributed enough for jitter.
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
    }
    return h / 0x100000000;
}

// Tier width. Items land in the same tier when their scores are close, and
// within a tier the stable hash decides the order.
const TIER_SIZE = 0.05;

// ─────────────────────────────────────────────────────────────
//  MAIN EXPORT — rankFeed
// ─────────────────────────────────────────────────────────────

/**
 * Full pipeline:
 *   candidates → filter seen → score → deduplicate authors → sort → paginate
 *
 * @param {Array}  candidates      - Pool of posts/shorts (from Redis or DB)
 * @param {Array}  seenIds         - Client-supplied list of already-seen IDs
 * @param {Object} interestProfile - { keywords: string[] } from Gemini
 * @param {number} page            - Page number (1-indexed)
 * @param {number} limit           - Items per page
 *
 * @returns {{ items: Array, hasMore: boolean, mode: string }}
 */
export function rankFeed({ candidates, seenIds = [], isSeen, interestProfile, page = 1, limit = 10, seed = '' }) {
    // `isSeen` (a Bloom filter from utils/bloom.js) wins over the legacy id list.
    if (!isSeen) {
        const seenSet = new Set(seenIds.map(String));
        isSeen = (id) => seenSet.has(id);
    }
    const keywords = interestProfile?.keywords || [];

    // ── Filter unseen ─────────────────────────────────────────
    let pool = candidates.filter(item => !isSeen(item._id?.toString()));

    let mode = 'fresh';
    if (pool.length === 0) {
        // All seen — fall back to full candidate pool ranked by engagement
        pool = [...candidates];
        mode = 'recycled';
    }

    // ── Score all items ───────────────────────────────────────
    // Diversity is computed against the pool in a fixed order (newest first, as
    // the pool arrives) rather than iteration order, so the penalty a post gets
    // does not depend on which page happens to be requested.
    const authorSeenCounts = {};
    const scored = pool.map(item => {
        const score = scoreItem(item, keywords, authorSeenCounts);
        const authorId = item.user?._id?.toString() || item.user?.toString();
        authorSeenCounts[authorId] = (authorSeenCounts[authorId] || 0) + 1;
        return { item, score };
    });

    // ── Sort: tier by score, then stable per-user jitter inside the tier ──
    for (const entry of scored) {
        entry.tier = Math.floor(entry.score / TIER_SIZE);
        entry.jitter = hashToUnit(`${seed}:${entry.item._id}`);
    }
    scored.sort((a, b) =>
        b.tier - a.tier ||
        b.jitter - a.jitter ||
        // Final tie-break on id so the order is fully determined even when two
        // items hash identically; without it Array.sort is free to differ.
        String(a.item._id).localeCompare(String(b.item._id))
    );

    // ── Paginate ──────────────────────────────────────────────
    const skip = (page - 1) * limit;
    const page_items = scored.slice(skip, skip + limit).map(x => x.item);
    const hasMore = scored.length > skip + limit;

    return { items: page_items, hasMore, mode };
}

/**
 * Drop the pool and bump its version. Only for changes to WHICH items are in
 * the pool (create, delete, edit, privacy). Not for likes/votes/comments:
 * freshenPage() already serves live counts, and bumping the version reseeds
 * every user's ordering, so page 2 repeated or skipped posts mid-scroll.
 */
export async function invalidatePool(type = 'posts') {
    try {
        await redisClient.del(FEED_POOL_KEY(type));
        // Advancing the version reshuffles the ordering for everyone, which is
        // what makes a brand-new post able to reach the top of page 1.
        await redisClient.incr(FEED_POOL_VERSION_KEY(type));
    } catch { /* silent */ }
}

/** Current pool generation; part of the ranking seed. */
export async function getPoolVersion(type = 'posts') {
    try {
        return (await redisClient.get(FEED_POOL_VERSION_KEY(type))) || '0';
    } catch {
        return '0';
    }
}

/**
 * Invalidate a user's AI interest profile cache.
 * Call this when user updates their profile/interests.
 */
export async function invalidateUserProfile(userId) {
    try {
        await redisClient.del(USER_PROFILE_KEY(userId));
    } catch { /* silent */ }
}
