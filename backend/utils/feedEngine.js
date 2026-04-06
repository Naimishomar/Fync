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
import { GoogleGenAI } from '@google/genai';

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
const USER_INTEREST_PROFILE_TTL = 24 * 60 * 60; // 24 hours — AI interest profile per user
const FEED_POOL_KEY = (college, type) => `fync:pool:${type}:${encodeURIComponent(college)}`;
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

/**
 * Returns a cached pool of posts for a college.
 * DB is hit at most once every 5 minutes per college.
 */
export async function getCandidatePool(college, PostModel, poolSize = 100) {
    const cacheKey = FEED_POOL_KEY(college, 'posts');

    // Try Redis first
    const cached = await rGet(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    // Cache miss — hit MongoDB (only happens once every 5 min per college)
    const posts = await PostModel
        .find({ college, isPrivate: { $ne: true } })
        .sort({ createdAt: -1 })
        .limit(poolSize)
        .populate('user', 'name username avatar user_access')
        .lean();   // .lean() = plain JS objects, much faster than Mongoose docs

    await rSet(cacheKey, JSON.stringify(posts), CANDIDATE_POOL_TTL);
    return posts;
}

/**
 * Returns a cached pool of shorts (not college-scoped — all shorts).
 * DB is hit at most once every 5 minutes.
 */
export async function getShortsPool(ShortsModel, poolSize = 80) {
    const cacheKey = FEED_POOL_KEY('global', 'shorts');

    const cached = await rGet(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

    const shorts = await ShortsModel
        .find()
        .sort({ createdAt: -1 })
        .limit(poolSize)
        .populate('user', 'name username avatar upiId user_access')
        .lean();

    await rSet(cacheKey, JSON.stringify(shorts), CANDIDATE_POOL_TTL);
    return shorts;
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
export async function getUserInterestProfile(user) {
    const cacheKey = USER_PROFILE_KEY(user._id || user.id);

    // Check cache first (24 hr)
    const cached = await rGet(cacheKey);
    if (cached) {
        return JSON.parse(cached);
    }

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
        const response = await getGenAI().models.generateContent({
            model: 'gemini-1.5-flash',
            contents: prompt
        });
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
    const comments = (item.comments?.length) || 0;
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
 * Fisher-Yates shuffle — randomizes items within same score tier
 * so feed looks different every session.
 */
function shuffleWithinTiers(scoredItems) {
    // Bin into 3 tiers: high (≥0.6), medium (0.3–0.6), low (<0.3)
    const high = scoredItems.filter(x => x.score >= 0.6);
    const mid = scoredItems.filter(x => x.score >= 0.3 && x.score < 0.6);
    const low = scoredItems.filter(x => x.score < 0.3);

    const shuffle = (arr) => {
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    return [...shuffle(high), ...shuffle(mid), ...shuffle(low)];
}

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
export function rankFeed({ candidates, seenIds = [], interestProfile, page = 1, limit = 10 }) {
    const seenSet = new Set(seenIds.map(String));
    const keywords = interestProfile?.keywords || [];

    // ── Filter unseen ─────────────────────────────────────────
    let pool = candidates.filter(item => !seenSet.has(item._id?.toString()));

    let mode = 'fresh';
    if (pool.length === 0) {
        // All seen — fall back to full candidate pool ranked by engagement
        pool = [...candidates];
        mode = 'recycled';
    }

    // ── Score all items ───────────────────────────────────────
    const authorSeenCounts = {};
    const scored = pool.map(item => {
        const score = scoreItem(item, keywords, authorSeenCounts);
        // Track author for diversity scoring of next items
        const authorId = item.user?._id?.toString() || item.user?.toString();
        authorSeenCounts[authorId] = (authorSeenCounts[authorId] || 0) + 1;
        return { item, score };
    });

    // ── Sort & shuffle within tiers ───────────────────────────
    scored.sort((a, b) => b.score - a.score);
    const shuffled = shuffleWithinTiers(scored);

    // ── Paginate ──────────────────────────────────────────────
    const skip = (page - 1) * limit;
    const page_items = shuffled.slice(skip, skip + limit).map(x => x.item);
    const hasMore = shuffled.length > skip + limit;

    return { items: page_items, hasMore, mode };
}

/**
 * Invalidate the Redis pool for a college when a new post is created.
 * Call this from createPost/createShorts controllers.
 */
export async function invalidatePool(college, type = 'posts') {
    try {
        await redisClient.del(FEED_POOL_KEY(college, type));
        if (type === 'shorts') await redisClient.del(FEED_POOL_KEY('global', 'shorts'));
    } catch { /* silent */ }
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
