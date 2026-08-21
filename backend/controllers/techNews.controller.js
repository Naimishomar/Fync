/**
 * What the tech industry is talking about, in three feeds:
 *
 *   global     Hacker News via the Algolia index, ranked by points over 24h.
 *   india      Google News RSS, India locale, tech and startup coverage.
 *   placement  Google News RSS, India locale, fresher hiring and campus news.
 *
 * Both sources are free and keyless. Google News RSS is used rather than a news
 * API because every free news API tier is rate-limited per key and would have to
 * be shared across all users; an RSS endpoint has no such ceiling.
 */
import { XMLParser } from 'fast-xml-parser';

const HN_ENDPOINT = 'https://hn.algolia.com/api/v1/search';
const WINDOW_SECONDS = 24 * 60 * 60;
const UA = 'Mozilla/5.0 (compatible; FyncBot/1.0)';

// India and placement used to come from Google News RSS. Its links are
// news.google.com redirect tokens, not publisher URLs — the target is an opaque
// id that cannot be decoded, and the page behind it is a 590KB JavaScript
// redirect. Nothing can be extracted from that, so in-app reading was
// impossible. Publisher feeds give real article URLs instead.
//
// YourStory is deliberately absent: its feed is fine but its articles are
// client-rendered, so extraction returns an empty document.
const FEEDS = {
  india: [
    { source: 'Inc42', url: 'https://inc42.com/feed/' },
    { source: 'ET Tech', url: 'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms' },
    { source: 'Mint', url: 'https://www.livemint.com/rss/technology' },
  ],
  placement: [
    { source: 'ETHRWorld', url: 'https://hr.economictimes.indiatimes.com/rss/topstories' },
    { source: 'ET Tech', url: 'https://economictimes.indiatimes.com/tech/rssfeeds/13357270.cms' },
  ],
};

// Placement is a subset of a broader HR/tech feed, so it is filtered rather than
// queried — these feeds take no search parameter.
const PLACEMENT_TERMS = /fresher|campus|placement|hiring|recruit|onboard|graduate|intern|job|layoff|salary|package/i;

const parser = new XMLParser({ ignoreAttributes: false });

const hnDiscussionUrl = (id) => `https://news.ycombinator.com/item?id=${id}`;

const hostOf = (url) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
};

async function fetchHackerNews(limit) {
  const since = Math.floor(Date.now() / 1000) - WINDOW_SECONDS;
  // `>` has to be percent-encoded — Algolia answers 400 for the raw character.
  const url =
    `${HN_ENDPOINT}?tags=story` +
    `&numericFilters=${encodeURIComponent(`created_at_i>${since}`)}` +
    `&hitsPerPage=${limit * 2}`;

  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Hacker News responded ${res.status}`);
  const data = await res.json();

  // The same story gets submitted more than once, often pointing at different
  // mirrors, so the URL is not a reliable key. Normalised title, highest score.
  const byKey = new Map();
  for (const hit of data.hits ?? []) {
    if (!hit.title) continue;
    const key = hit.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const seen = byKey.get(key);
    if (!seen || (hit.points ?? 0) > (seen.points ?? 0)) byKey.set(key, hit);
  }

  return [...byKey.values()]
    .sort((a, b) => (b.points ?? 0) - (a.points ?? 0))
    .slice(0, limit)
    .map((h) => ({
      id: String(h.objectID),
      title: h.title,
      url: h.url || hnDiscussionUrl(h.objectID),
      source: hostOf(h.url) || 'news.ycombinator.com',
      points: h.points ?? 0,
      comments: h.num_comments ?? 0,
      createdAt: h.created_at,
      discussionUrl: hnDiscussionUrl(h.objectID),
    }));
}

async function fetchRss(source, url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(9000),
  });
  if (!res.ok) throw new Error(`${source} responded ${res.status}`);

  const doc = parser.parse(await res.text());
  const raw = doc?.rss?.channel?.item ?? [];
  const items = Array.isArray(raw) ? raw : [raw];

  return items
    .filter((it) => it?.title && it?.link)
    .map((it) => ({
      id: String(it.guid?.['#text'] ?? it.guid ?? it.link),
      title: String(it.title).trim(),
      url: String(it.link).trim(),
      source,
      points: 0,
      comments: 0,
      createdAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      discussionUrl: String(it.link).trim(),
    }));
}

async function fetchPublishers(feed, limit) {
  // One slow or dead publisher must not empty the whole tab.
  const settled = await Promise.allSettled(
    FEEDS[feed].map((f) => fetchRss(f.source, f.url)),
  );
  const failures = settled.filter((r) => r.status === 'rejected');
  if (failures.length === FEEDS[feed].length) {
    throw new Error(failures[0].reason?.message ?? 'every source failed');
  }

  let all = settled.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));
  if (feed === 'placement') all = all.filter((s) => PLACEMENT_TERMS.test(s.title));

  const seen = new Set();
  return all
    .filter((s) => {
      const key = s.title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      if (seen.has(key)) return false;   // the same wire story runs on several sites
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

export const getTrendingTechNews = async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit ?? '25', 10) || 25, 50);
  const feed = ['global', 'india', 'placement'].includes(req.query.feed)
    ? req.query.feed
    : 'global';

  try {
    const stories =
      feed === 'global'
        ? await fetchHackerNews(limit)
        : await fetchPublishers(feed, limit);

    return res.status(200).json({ success: true, feed, count: stories.length, stories });
  } catch (error) {
    // A timeout or DNS failure upstream is not a fault in this service, so it
    // reports 502 rather than 500 and names which side failed.
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    console.error(`Tech news (${feed}) fetch failed:`, error?.message);
    return res.status(502).json({
      success: false,
      message: timedOut ? 'The news source timed out.' : 'Could not load news right now.',
    });
  }
};
