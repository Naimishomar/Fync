/**
 * Video sources for the Discover feed.
 *
 * Nothing here is persisted. Videos are found live, ranked, and held in Redis —
 * so the feed can grow indefinitely without a single database row, and the
 * bytes stream from the source host rather than our storage.
 *
 * Deliberately not an LLM: ranking is a formula, so serving a million items
 * costs nothing per item.
 */
import crypto from "crypto";

const UA = "FyncApp/1.0 (+https://fync-api.duckdns.org)";

/**
 * The ID must be derived from the content, never generated.
 *
 * The client remembers what it has seen and sends those ids back so items do
 * not repeat. With no database there is no primary key, so a random id would
 * make every refetch look like brand-new content and the feed would repeat
 * forever — the exact failure this feed exists to avoid. A hash of the URL is
 * stable across refetches, restarts and cache expiry.
 */
export const stableId = (url) =>
  crypto.createHash("sha1").update(String(url)).digest("hex").slice(0, 24);

const host = (url) => {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return ""; }
};

/**
 * Creative Commons and public domain only.
 *
 * PeerTube licence ids 4, 5 and 6 are the NonCommercial variants. We show these
 * videos inside an app that carries our own commerce, so NonCommercial is not
 * ours to use — the filter is a legal boundary, not a quality one.
 */
const PERMISSIVE_LICENCES = new Set([1, 2, 3, 7]);

/**
 * SepiaSearch indexes videos across every public PeerTube instance, so one
 * query reaches the whole federated network instead of a single server.
 */
const SEARCH = "https://sepiasearch.org/api/v1/search/videos";

/**
 * Broad enough that the pool never dries up, specific enough to stay technical.
 * Each term is a separate query, so a term returning nothing costs only itself.
 */
const VIDEO_TERMS = [
  "programming", "linux", "web development", "coding tutorial",
  "javascript", "python", "devops", "docker", "kubernetes", "rust",
  "react", "database", "computer science", "open source", "self hosting",
  "electronics", "networking", "cybersecurity", "machine learning", "git",
];

/**
 * Search one term. Returns candidates only — no playable URL yet.
 *
 * Resolving a stream costs one HTTP call per video, so discovery stays cheap
 * and resolution happens later for just the handful actually being served.
 */
async function searchTerm(term, { page = 0, count = 100 } = {}) {
  const url =
    `${SEARCH}?search=${encodeURIComponent(term)}` +
    `&count=${count}&start=${page * count}` +
    // Shorts are short. Anything past ~8 minutes is a lecture, not a reel.
    `&durationMax=480&nsfw=false&sort=-publishedAt`;

  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(12000) });
  if (!res.ok) throw new Error(`SepiaSearch ${res.status}`);
  const data = await res.json();

  return (data.data ?? [])
    .filter((v) => !v.isLive && v.duration > 5 && PERMISSIVE_LICENCES.has(v.licence?.id))
    .map((v) => ({
      id: stableId(v.url),
      kind: "video",
      title: v.name,
      description: (v.description ?? "").slice(0, 300),
      url: v.url,
      uuid: v.uuid,
      // The host that actually serves the video, needed to resolve the stream.
      instance: host(v.url),
      source: v.channel?.displayName || host(v.url),
      thumbnail: v.thumbnailUrl || null,
      duration: v.duration,
      publishedAt: v.publishedAt,
      score: v.views ?? 0,
      // Attribution is a licence condition, not decoration — it ships with the item.
      licence: v.licence?.label ?? "Unknown",
      account: v.account?.displayName ?? null,
    }));
}

/**
 * The candidate pool, ranked. This is what gets cached.
 *
 * Pages deeper than the first are pulled for the broadest terms only: those are
 * the ones with thousands of results, and paging a term with eleven hits just
 * buys empty responses.
 */
export async function collectVideoCandidates({ terms = VIDEO_TERMS, deepPages = 2 } = {}) {
  const queries = terms.map((t) => searchTerm(t, { page: 0 }));
  for (let p = 1; p < deepPages; p++) {
    for (const t of ["open source", "linux", "programming", "web development", "security"]) {
      queries.push(searchTerm(t, { page: p }));
    }
  }

  const settled = await Promise.allSettled(queries);
  const failures = settled.filter((r) => r.status === "rejected");
  if (failures.length === settled.length) {
    throw new Error(failures[0].reason?.message ?? "every video source failed");
  }

  const all = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // The same video surfaces under several search terms; dedupe on the stable id.
  const seen = new Set();
  const unique = all.filter((v) => {
    if (seen.has(v.id)) return false;
    seen.add(v.id);
    return true;
  });

  return rankVideos(unique);
}

/**
 * Views with a recency lift. Deliberately simple: an LLM ranker would cost
 * money per item and this feed's whole premise is that it does not.
 */
export function rankVideos(videos) {
  const now = Date.now();
  return [...videos].sort((a, b) => {
    const rank = (v) => {
      const ageDays = Math.max(1, (now - new Date(v.publishedAt).getTime()) / 86_400_000);
      const popularity = Math.log10((v.score || 0) + 10);
      return popularity / Math.pow(ageDays, 0.25);
    };
    return rank(b) - rank(a);
  });
}

/**
 * Turn candidates into playable items.
 *
 * Called for one page at a time, never the whole pool — this is the only
 * expensive step, and a video whose stream will not resolve is dropped rather
 * than shipped as a card that plays nothing.
 */
export async function resolvePlayable(candidates) {
  const settled = await Promise.allSettled(
    candidates.map(async (v) => {
      const r = await fetch(`https://${v.instance}/api/v1/videos/${v.uuid}`, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) throw new Error(`detail ${r.status}`);
      const d = await r.json();

      // HLS first: it adapts to the phone's bandwidth. A progressive MP4 is the
      // fallback for instances that have not transcoded to HLS.
      const hls = (d.streamingPlaylists ?? [])[0]?.playlistUrl;
      const file = (d.files ?? [])[0]?.fileUrl
        ?? (d.streamingPlaylists ?? [])[0]?.files?.[0]?.fileUrl;
      const streamUrl = hls || file;
      if (!streamUrl) throw new Error("no playable stream");

      const { uuid, instance, ...rest } = v;
      return { ...rest, streamUrl };
    }),
  );

  return settled.filter((r) => r.status === "fulfilled").map((r) => r.value);
}
