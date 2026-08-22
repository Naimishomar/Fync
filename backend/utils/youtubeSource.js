/**
 * Technical video from YouTube.
 *
 * Playback goes through YouTube's own IFrame player, so nothing is downloaded,
 * proxied or stored here — this module only finds videos and hands back ids.
 * Embedding through that player is the sanctioned path: the uploader opts in
 * via the embeddable flag, views and ad revenue still count for them, so the
 * catalogue is not restricted to Creative Commons.
 *
 * Quota is the real constraint: the free Data API tier is 10,000 units a day
 * and a single search costs 100, so the results are cached for hours rather
 * than fetched per request. See collectYouTubeCandidates.
 */
import crypto from "crypto";

const API = "https://www.googleapis.com/youtube/v3";

export const youtubeConfigured = () => !!process.env.YOUTUBE_API_KEY;

/**
 * The API returns titles HTML-escaped, so a title reaches the phone as
 * "DON&#39;T Make This Robot Arm". React Native renders that literally — it has
 * no HTML parser — so it has to be decoded here.
 */
const decodeEntities = (str = "") =>
  str
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    // Ampersand last: decoding it first would corrupt the entities above.
    .replace(/&amp;/g, "&");

const stableId = (videoId) =>
  crypto.createHash("sha1").update(`yt:${videoId}`).digest("hex").slice(0, 24);

/**
 * Terms kept deliberately short. Every one costs 100 quota units, so this list
 * is the main lever on daily spend: 12 terms across 4 refreshes is 4,800 units,
 * comfortably inside the free tier with room for the rest of the app.
 */
const YT_TERMS = [
  "programming tutorial", "web development", "python", "javascript",
  "linux", "devops", "react", "data structures",
  "system design", "machine learning", "cybersecurity", "computer science",
];

/**
 * Hindi is searched separately, because an English-biased query surfaces almost
 * no Hindi video: only 4 of 150 sampled results came back Hindi.
 *
 * These are transliterated on purpose. Devanagari queries were measured and do
 * not work — "कोडिंग" returned 0 Hindi videos out of 50 and "प्रोग्रामिंग"
 * returned 1, because Hindi tech channels title and tag their videos in Latin
 * script. "computer science hindi" returns 34.
 */
const YT_TERMS_HI = [
  "computer science hindi", "javascript hindi", "programming hindi",
  "coding tutorial hindi", "web development hindi", "python hindi",
];

async function searchTerm(term, key, relevanceLanguage = "en") {
  const url =
    `${API}/search?part=snippet&type=video` +
    `&q=${encodeURIComponent(term)}` +
    // videoEmbeddable is the one filter that must stay. Without it the feed
    // fills with videos that load and then refuse to play, which is
    // indistinguishable from a broken player.
    `&videoEmbeddable=true` +
    // "short" is under four minutes — the right shape for a shorts feed.
    // maxResults is free: a search costs 100 quota units whether it returns 1
    // result or the maximum 50, so asking for fewer than 50 just buys a smaller
    // pool for the same price.
    //
    // relevanceLanguage only biases ranking, it does not filter — the hard
    // guarantee comes from filterToHindiAndEnglish below.
    `&videoDuration=short&order=viewCount&relevanceLanguage=${relevanceLanguage}&maxResults=50&key=${key}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`YouTube ${res.status}: ${body.error?.message ?? "search failed"}`);
  }
  const data = await res.json();

  return (data.items ?? [])
    .filter((i) => i.id?.videoId)
    .map((i) => ({
      id: stableId(i.id.videoId),
      provider: "youtube",
      videoId: i.id.videoId,
      title: decodeEntities(i.snippet.title),
      description: decodeEntities(i.snippet.description ?? "").slice(0, 300),
      url: `https://www.youtube.com/watch?v=${i.id.videoId}`,
      source: decodeEntities(i.snippet.channelTitle),
      account: decodeEntities(i.snippet.channelTitle),
      thumbnail:
        i.snippet.thumbnails?.high?.url ??
        i.snippet.thumbnails?.medium?.url ??
        i.snippet.thumbnails?.default?.url ??
        null,
      publishedAt: i.snippet.publishedAt,
      // The search endpoint does not return view counts, and asking for them
      // costs another quota call per batch. Ordering by viewCount already put
      // these in a sensible order, so rank on recency alone.
      score: 0,
      duration: 0,
    }));
}

/**
 * Keep only Hindi and English.
 *
 * The search endpoint does not report language, so this costs one extra call
 * per 50 videos — 1 quota unit each, against 100 for a search, so verifying the
 * whole pool is cheaper than a single extra search term.
 *
 * Every video sampled had defaultLanguage set even when defaultAudioLanguage
 * was missing, so between the two the coverage is complete; anything that
 * somehow reports neither is dropped rather than guessed at.
 */
async function filterToHindiAndEnglish(candidates, key) {
  if (!candidates.length) return [];

  const byVideoId = new Map(candidates.map((c) => [c.videoId, c]));
  const ids = [...byVideoId.keys()];
  const batches = [];
  for (let i = 0; i < ids.length; i += 50) batches.push(ids.slice(i, i + 50));

  const settled = await Promise.allSettled(
    batches.map(async (batch) => {
      const url = `${API}/videos?part=snippet&id=${batch.join(",")}&key=${key}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!res.ok) throw new Error(`videos.list ${res.status}`);
      return (await res.json()).items ?? [];
    }),
  );

  // A failed batch drops those videos rather than letting them through
  // unchecked: an unwanted language on screen is worse than a shorter feed.
  const kept = [];
  for (const r of settled) {
    if (r.status !== "fulfilled") continue;
    for (const v of r.value) {
      const lang = v.snippet?.defaultAudioLanguage || v.snippet?.defaultLanguage;
      if (!lang) continue;
      // Region variants count: en-IN, en-GB and hi-IN are all wanted. "zxx"
      // means no spoken language at all and is excluded, since it is neither.
      const base = lang.toLowerCase().split("-")[0];
      if (base !== "en" && base !== "hi") continue;

      const candidate = byVideoId.get(v.id);
      if (candidate) kept.push({ ...candidate, language: base });
    }
  }
  return kept;
}

/**
 * Spread the Hindi videos through the feed instead of leaving them at the end.
 *
 * The two languages are searched separately, so concatenating them puts every
 * Hindi video behind all 550-odd English ones — far past where anyone scrolls,
 * which makes them effectively invisible. Spacing them by the ratio of the two
 * pools puts roughly one Hindi video every five without starving either list.
 */
function interleaveByLanguage(items) {
  const hi = items.filter((v) => v.language === "hi");
  const en = items.filter((v) => v.language === "en");
  if (!hi.length || !en.length) return items;

  const stride = Math.max(1, Math.round(en.length / hi.length));
  const out = [];
  let next = 0;

  en.forEach((v, i) => {
    out.push(v);
    if ((i + 1) % stride === 0 && next < hi.length) out.push(hi[next++]);
  });

  // Whatever did not fit the stride still belongs in the feed.
  return out.concat(hi.slice(next));
}

/**
 * One dead term must not empty the batch, and a quota error on term three must
 * not discard terms one and two.
 */
export async function collectYouTubeCandidates({
  terms = YT_TERMS,
  hindiTerms = YT_TERMS_HI,
} = {}) {
  const key = process.env.YOUTUBE_API_KEY;
  if (!key) return [];

  const settled = await Promise.allSettled([
    ...terms.map((t) => searchTerm(t, key, "en")),
    ...hindiTerms.map((t) => searchTerm(t, key, "hi")),
  ]);

  const failures = settled.filter((r) => r.status === "rejected");
  if (failures.length === settled.length) {
    // Surfaced rather than swallowed: a wrong key or a disabled API looks
    // exactly like "no results" otherwise, and that is a miserable thing to debug.
    console.error("YouTube search failed entirely:", failures[0].reason?.message);
    return { items: [], degraded: true };
  }
  if (failures.length) {
    console.warn(
      `YouTube: ${failures.length}/${settled.length} searches failed —`,
      failures[0].reason?.message,
    );
  }

  const all = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  const seen = new Set();
  const unique = all.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  const items = interleaveByLanguage(await filterToHindiAndEnglish(unique, key));

  // Partial results are reported so the caller can decline to cache them for
  // hours. Running out of daily quota mid-collection yields a pool a third
  // short, and pinning that until tomorrow would turn a temporary limit into a
  // day-long outage.
  return { items, degraded: failures.length > 0 };
}
