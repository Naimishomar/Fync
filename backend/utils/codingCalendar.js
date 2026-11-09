import redisClient from './redis.js';
import { istDateKey } from './eventTime.js';

/**
 * Daily submission counts from LeetCode, GFG, Codeforces and CodeChef, merged
 * into one { "YYYY-MM-DD": n } map for the profile activity grid and streak.
 *
 * All four are public, unauthenticated endpoints. Any platform that fails or
 * changes shape contributes nothing rather than failing the whole calendar.
 */

const UA = 'Mozilla/5.0 (compatible; FyncBot/1.0; +https://fync-api.duckdns.org)';
const TIMEOUT = 10000;
const CACHE_SECONDS = 60 * 60;
const DAY_MS = 86400000;

const pad = (n) => String(n).padStart(2, '0');
const add = (map, key, n) => { if (key && n > 0) map[key] = (map[key] || 0) + n; };

// LeetCode buckets by UTC day and keys each bucket by its UTC midnight.
const leetcode = async (u) => {
  const res = await fetch('https://leetcode.com/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Referer: 'https://leetcode.com', 'User-Agent': UA },
    body: JSON.stringify({
      query: 'query($u:String!){matchedUser(username:$u){userCalendar{submissionCalendar}}}',
      variables: { u },
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const raw = (await res.json())?.data?.matchedUser?.userCalendar?.submissionCalendar;
  const out = {};
  for (const [ts, n] of Object.entries(JSON.parse(raw || '{}'))) {
    add(out, new Date(Number(ts) * 1000).toISOString().slice(0, 10), Number(n));
  }
  return out;
};

// GFG only answers per year, so ask for every year the window touches.
const gfg = async (u, years) => {
  const out = {};
  await Promise.all(years.map(async (year) => {
    const res = await fetch('https://practiceapi.geeksforgeeks.org/api/v1/user/problems/submissions/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': UA },
      body: JSON.stringify({ handle: u, requestType: 'getYearwiseUserSubmissions', year: String(year), month: '' }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    const result = (await res.json())?.result || {};
    for (const [day, n] of Object.entries(result)) add(out, day.slice(0, 10), Number(n));
  }));
  return out;
};

// ponytail: last 2000 submissions only; a user past that inside a year loses the oldest days.
const codeforces = async (u, since) => {
  const res = await fetch(
    `https://codeforces.com/api/user.status?handle=${encodeURIComponent(u)}&from=1&count=2000`,
    { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) },
  );
  const out = {};
  for (const s of (await res.json())?.result || []) {
    const at = s.creationTimeSeconds * 1000;
    if (at >= since) add(out, istDateKey(new Date(at)), 1);
  }
  return out;
};

// No API: the profile page embeds the heatmap as a JS array with unpadded dates.
const codechef = async (u) => {
  const res = await fetch(`https://www.codechef.com/users/${encodeURIComponent(u)}`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const m = (await res.text()).match(/userDailySubmissionsStats\s*=\s*(\[[^\]]*\])/);
  const out = {};
  for (const { date, value } of JSON.parse(m?.[1] || '[]')) {
    const [y, mo, d] = String(date).split('-');
    add(out, `${y}-${pad(mo)}-${pad(d)}`, Number(value));
  }
  return out;
};

/** Pure: merge per-platform maps. */
export const mergeCounts = (maps) => {
  const out = {};
  for (const m of maps) for (const [k, n] of Object.entries(m || {})) add(out, k, n);
  return out;
};

/**
 * Pure: current and best run of consecutive active days in `counts`.
 * Current counts back from today, or from yesterday if today has nothing yet,
 * so the streak does not read as broken before the student has had a chance.
 */
export const computeStreaks = (counts, todayKey = istDateKey()) => {
  const prevKey = (key) => new Date(new Date(`${key}T00:00:00Z`).getTime() - DAY_MS).toISOString().slice(0, 10);

  let current = 0;
  let day = counts[todayKey] ? todayKey : prevKey(todayKey);
  while (counts[day]) { current++; day = prevKey(day); }

  let best = 0;
  let run = 0;
  let last = null;
  for (const key of Object.keys(counts).filter((k) => counts[k] > 0).sort()) {
    run = last && prevKey(key) === last ? run + 1 : 1;
    best = Math.max(best, run);
    last = key;
  }
  return { current, best: Math.max(best, current) };
};

/**
 * Merged counts for the last year, cached per handle set.
 * Returns null when no platform is linked.
 */
export const getCodingCalendar = async (profiles = {}) => {
  const handles = {
    leetcode: profiles.leetcode, gfg: profiles.gfg,
    codeforces: profiles.codeforces, codechef: profiles.codechef,
  };
  const linked = Object.entries(handles).filter(([, h]) => typeof h === 'string' && h.trim());
  if (!linked.length) return null;

  const cacheKey = `coding_cal:${linked.map(([p, h]) => `${p}=${h.trim().toLowerCase()}`).join('|')}`;
  try {
    const hit = await redisClient.get(cacheKey);
    if (hit) return JSON.parse(hit);
  } catch { /* Redis down: fetch live. */ }

  const now = Date.now();
  const since = now - 365 * DAY_MS;
  const years = [...new Set([new Date(since).getUTCFullYear(), new Date(now).getUTCFullYear()])];
  const fetchers = {
    leetcode: (h) => leetcode(h),
    gfg: (h) => gfg(h, years),
    codeforces: (h) => codeforces(h, since),
    codechef: (h) => codechef(h),
  };

  const results = await Promise.allSettled(linked.map(([p, h]) => fetchers[p](h.trim())));
  const counts = mergeCounts(results.map((r) => (r.status === 'fulfilled' ? r.value : {})));

  // Do not cache a total outage for an hour; a later view retries.
  if (results.some((r) => r.status === 'fulfilled')) {
    redisClient.set(cacheKey, JSON.stringify(counts), { EX: CACHE_SECONDS }).catch(() => {});
  }
  return counts;
};
