/**
 * The Gemini model every call site uses.
 *
 * This exists because `gemini-1.5-flash` was retired underneath us and every
 * call started returning 404. Both call sites caught the error and fell back
 * silently, so the feed's interest profiling degraded to raw keywords for
 * weeks without anything looking broken.
 *
 * Google retires Flash models roughly twice a year. Keeping the name in one
 * env-overridable place means the next retirement is a restart, not a redeploy
 * — and not another silent degradation.
 *
 * Check availability with:
 *   GET https://generativelanguage.googleapis.com/v1beta/models?key=$GEMINI_API_KEY
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";

/** Reasoning-grade work. Costs materially more; do not use it for keywords. */
export const GEMINI_MODEL_PRO = process.env.GEMINI_MODEL_PRO || "gemini-2.5-flash";
