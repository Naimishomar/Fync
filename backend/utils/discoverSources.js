/**
 * Sources for the Discover feed.
 *
 * Nothing here is persisted. Items are fetched live, merged, and held in Redis
 * by the route's cache middleware — so the feed can grow indefinitely without a
 * single database row.
 *
 * This is a deterministic fetcher, not an LLM: ranking is a formula, so serving
 * a million items costs nothing per item.
 */
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";

const UA = "FyncApp/1.0 (+https://fync-api.duckdns.org)";
const parser = new XMLParser({ ignoreAttributes: false });

/**
 * The ID must be derived from the content, never generated.
 *
 * The client remembers what it has seen and sends those ids back so items do not
 * repeat. With no database there is no primary key, so a random id would make
 * every refetch look like brand-new content and the feed would repeat forever —
 * the exact failure this feed exists to avoid. A hash of the URL is stable
 * across refetches, restarts and cache expiry.
 */
export const stableId = (url) =>
  crypto.createHash("sha1").update(String(url)).digest("hex").slice(0, 24);

const host = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

// ── Hacker News ─────────────────────────────────────────────────────────────
async function hackerNews(limit) {
  const since = Math.floor(Date.now() / 1000) - 3 * 24 * 60 * 60;
  const url =
    "https://hn.algolia.com/api/v1/search?tags=story" +
    `&numericFilters=${encodeURIComponent(`created_at_i>${since}`)}&hitsPerPage=${limit}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Hacker News ${res.status}`);
  const data = await res.json();

  return (data.hits ?? [])
    .filter((h) => h.title)
    .map((h) => {
      const link = h.url || `https://news.ycombinator.com/item?id=${h.objectID}`;
      return {
        id: stableId(link),
        kind: "article",
        title: h.title,
        url: link,
        source: host(h.url) || "news.ycombinator.com",
        image: null,
        publishedAt: h.created_at,
        score: h.points ?? 0,
        comments: h.num_comments ?? 0,
        discussionUrl: `https://news.ycombinator.com/item?id=${h.objectID}`,
      };
    });
}

// ── Publisher RSS ───────────────────────────────────────────────────────────
const RSS = [
  { source: "Inc42", url: "https://inc42.com/feed/" },
  { source: "ET Tech", url: "https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms" },
  { source: "Mint", url: "https://www.livemint.com/rss/technology" },
];

async function rssFeed({ source, url }) {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`${source} ${res.status}`);
  const doc = parser.parse(await res.text());
  const raw = doc?.rss?.channel?.item ?? [];
  const items = Array.isArray(raw) ? raw : [raw];

  return items
    .filter((it) => it?.title && it?.link)
    .map((it) => {
      const link = String(it.link).trim();
      return {
        id: stableId(link),
        kind: "article",
        title: String(it.title).trim(),
        url: link,
        source,
        image: it["media:content"]?.["@_url"] ?? it.enclosure?.["@_url"] ?? null,
        publishedAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
        score: 0,
        comments: 0,
        discussionUrl: link,
      };
    });
}

// ── PeerTube (native video) ─────────────────────────────────────────────────
// Licence ids: 1 Attribution, 2 BY-SA, 3 BY-ND, 7 Public Domain.
// 4/5/6 are the Non-Commercial variants and are excluded — this app may carry
// affiliate revenue, and NC would not permit that.
const PERMISSIVE_LICENCES = new Set([1, 2, 3, 7]);

async function peerTube(term, limit) {
  const url =
    "https://sepiasearch.org/api/v1/search/videos" +
    `?search=${encodeURIComponent(term)}&count=${limit}&durationMax=180&nsfw=false&sort=-publishedAt`;
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`PeerTube ${res.status}`);
  const data = await res.json();

  const candidates = (data.data ?? []).filter(
    (v) => !v.isLive && v.duration > 5 && PERMISSIVE_LICENCES.has(v.licence?.id),
  );

  // The search result has no playable URL, so each survivor costs one detail
  // call. Capped and run in parallel: this is the expensive source, and it must
  // not hold up a feed that is mostly text.
  const detailed = await Promise.allSettled(
    candidates.slice(0, 8).map(async (v) => {
      const h = new URL(v.url).host;
      const r = await fetch(`https://${h}/api/v1/videos/${v.uuid}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(7000),
      });
      if (!r.ok) throw new Error(`detail ${r.status}`);
      const d = await r.json();

      const hls = (d.streamingPlaylists ?? [])[0]?.playlistUrl;
      const file = (d.files ?? [])[0]?.fileUrl;
      const playable = hls || file;
      if (!playable) throw new Error("no playable stream");

      return {
        id: stableId(v.url),
        kind: "video",
        title: v.name,
        url: v.url,
        source: v.channel?.displayName || host(v.url),
        image: v.thumbnailUrl || null,
        publishedAt: v.publishedAt,
        score: v.views ?? 0,
        comments: 0,
        // Attribution is a licence condition, not decoration — it ships with the item.
        licence: v.licence?.label ?? "Unknown",
        durationSeconds: v.duration,
        streamUrl: playable,
        discussionUrl: v.url,
      };
    }),
  );
  return detailed.filter((r) => r.status === "fulfilled").map((r) => r.value);
}

/**
 * Everything, merged. One dead source must never empty the feed, so each is
 * settled independently rather than awaited in series.
 */
const VIDEO_TERMS = ["programming", "linux", "web development", "coding tutorial"];

export async function collectDiscoverItems({ videoTerms = VIDEO_TERMS } = {}) {
  const settled = await Promise.allSettled([
    hackerNews(40),
    ...RSS.map(rssFeed),
    ...videoTerms.map((t) => peerTube(t, 20)),
  ]);

  const failures = settled.filter((r) => r.status === "rejected");
  if (failures.length === settled.length) {
    throw new Error(failures[0].reason?.message ?? "every source failed");
  }

  const all = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // Same story syndicated across outlets shares a headline, not a URL.
  const seen = new Set();
  return all.filter((item) => {
    const key = item.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Recency with a gentle popularity nudge. Deliberately simple: an LLM ranker
 * would cost money per item and this feed's whole premise is that it does not.
 */
export function rankItems(items) {
  const now = Date.now();
  return [...items].sort((a, b) => {
    const rank = (i) => {
      // Days, not hours. With an hours divisor a zero-score item published ten
      // minutes ago beat a 1000-point story from this morning, so RSS — which is
      // always the freshest — buried everything else.
      const ageDays = Math.max(0.5, (now - new Date(i.publishedAt).getTime()) / 86_400_000);
      const popularity = Math.log10((i.score || 0) + 10);
      // Video is scarcer and more engaging, so it is nudged up rather than
      // buried under a hundred fresher headlines.
      const kindBoost = i.kind === "video" ? 1.35 : 1;
      return (popularity * kindBoost) / Math.pow(ageDays, 0.45);
    };
    return rank(b) - rank(a);
  });
}
