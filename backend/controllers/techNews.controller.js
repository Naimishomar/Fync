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
const GNEWS = 'https://news.google.com/rss/search';
const WINDOW_SECONDS = 24 * 60 * 60;
const UA = 'Mozilla/5.0 (compatible; FyncBot/1.0)';

// Tuned by hand against live results. Broad "campus placement" wording returned
// police recruitment and fresher welcome parties; naming the IT employers is what
// makes this feed about tech placements.
const QUERIES = {
  india:
    '(startup OR "deep tech" OR funding OR AI OR IT) India technology when:2d',
  placement:
    '(hiring OR onboarding OR "campus placement" OR recruitment) ' +
    '(freshers OR graduates OR campus) ' +
    '(TCS OR Infosys OR Wipro OR Accenture OR Cognizant OR HCL OR Capgemini OR "IT sector") when:7d',
};

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

async function fetchGoogleNews(query, limit) {
  const url = `${GNEWS}?q=${encodeURIComponent(query)}&hl=en-IN&gl=IN&ceid=IN:en`;
  const res = await fetch(url, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google News responded ${res.status}`);

  const doc = parser.parse(await res.text());
  const raw = doc?.rss?.channel?.item ?? [];
  const items = Array.isArray(raw) ? raw : [raw];

  const seen = new Set();
  const out = [];
  for (const it of items) {
    if (!it?.title || !it?.link) continue;
    // Google appends " - Publisher" to every headline; the publisher is already
    // carried separately in <source>, so the suffix is duplicate noise.
    const publisher = typeof it.source === 'object' ? it.source['#text'] : it.source;
    const title = String(it.title).replace(new RegExp(`\\s*-\\s*${publisher}$`), '').trim();

    const key = title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key || seen.has(key)) continue;   // syndicated copies share a headline
    seen.add(key);

    out.push({
      id: String(it.guid?.['#text'] ?? it.guid ?? it.link),
      title,
      url: String(it.link),
      source: publisher || hostOf(String(it.link)),
      points: 0,
      comments: 0,
      createdAt: it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString(),
      discussionUrl: String(it.link),
    });
    if (out.length >= limit) break;
  }
  return out;
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
        : await fetchGoogleNews(QUERIES[feed], limit);

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
