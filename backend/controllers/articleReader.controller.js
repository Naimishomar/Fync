/**
 * Server-side reader: fetches an article and returns it as plain blocks the app
 * renders natively. No WebView, no redirect out of the app.
 *
 * Mozilla's Readability is the same algorithm behind Firefox Reader View, so
 * this is the extraction people already trust rather than hand-rolled scraping.
 */
import { Readability } from '@mozilla/readability';
// linkedom, not jsdom: jsdom bundles a build of undici that calls
// webidl.util.markAsUncloneable, which only exists on Node 22+. CI runs Node 20,
// so importing jsdom crashed the smoke suite outright. linkedom has no undici
// dependency, is a tenth of the size, and Readability produces identical output.
import { parseHTML } from 'linkedom';
import dns from 'node:dns/promises';
import net from 'node:net';

const UA = 'Mozilla/5.0 (compatible; FyncBot/1.0; +https://fync-api.duckdns.org)';
const MAX_BYTES = 3_000_000;
const MAX_BLOCKS = 400;
const MAX_HOPS = 4;

/**
 * The URL comes from the client, so this endpoint could otherwise be pointed at
 * the machine's own network — link-local metadata, Redis, Mongo. Every hop of
 * the redirect chain is resolved and checked, not just the first.
 */
const isPrivateAddress = (ip) => {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return (
      a === 0 || a === 10 || a === 127 ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 100 && b >= 64 && b <= 127) ||
      a >= 224
    );
  }
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') ||
         v.startsWith('fe80') || v.startsWith('::ffff:');
};

async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new Error('That is not a valid link.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('Unsupported link type.');

  const { address } = await dns.lookup(u.hostname).catch(() => ({ address: null }));
  if (!address) throw new Error('That site could not be reached.');
  if (isPrivateAddress(address)) throw new Error('That link is not allowed.');
  return u;
}

/** Follows redirects by hand so each hop can be re-checked before it is fetched. */
async function fetchArticleHtml(startUrl) {
  let url = await assertPublicUrl(startUrl);

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'manual',
      signal: AbortSignal.timeout(12000),
    });

    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get('location');
      if (!next) throw new Error('That article could not be opened.');
      url = await assertPublicUrl(new URL(next, url).href);
      continue;
    }
    if (!res.ok) throw new Error(`The publisher returned ${res.status}.`);

    const type = res.headers.get('content-type') || '';
    if (!type.includes('html')) throw new Error('That link is not an article.');

    // Guard against a multi-hundred-megabyte body starving the box.
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) throw new Error('That article is too large to open here.');
    return { html: Buffer.from(buf).toString('utf8'), finalUrl: res.url || url.href };
  }
  throw new Error('That article redirected too many times.');
}

/** Readability returns HTML; the app renders native views, so it becomes blocks. */
function toBlocks(contentHtml, baseUrl) {
  // A bare fragment, or one wrapped in only <body>, leaves document.body with no
  // children in linkedom — the walker found nothing and every image disappeared.
  // A complete document is what populates the tree.
  const { document } = parseHTML(
    `<!DOCTYPE html><html><body>${contentHtml}</body></html>`,
  );
  const blocks = [];

  // linkedom has no base-URL notion, so a relative src stays relative. Resolve
  // it here or every such image renders as a broken box in the app.
  const absolute = (src) => {
    if (!src) return null;
    try { return new URL(src, baseUrl).href; } catch { return null; }
  };
  const push = (b) => { if (blocks.length < MAX_BLOCKS) blocks.push(b); };

  // Recurse into ANY unrecognised element rather than a fixed list of containers:
  // an earlier version only descended into div/section/figure/ul/ol and returned
  // nothing at all for pages that wrap their body in <article> or <main>.
  const walk = (node) => {
    for (const el of node.children) {
      if (blocks.length >= MAX_BLOCKS) return;
      const tag = el.tagName.toLowerCase();

      if (tag === 'img') {
        const src = absolute(el.getAttribute('src'));
        if (src && /^https?:/i.test(src)) push({ type: 'image', src });
      } else if (/^h[1-6]$/.test(tag)) {
        const text = el.textContent.trim();
        if (text) push({ type: 'heading', text });
      } else if (tag === 'blockquote') {
        const text = el.textContent.trim();
        if (text) push({ type: 'quote', text });
      } else if (tag === 'li') {
        const text = el.textContent.trim();
        if (text) push({ type: 'bullet', text });
      } else if (tag === 'pre' || tag === 'code') {
        const text = el.textContent.replace(/\s+$/, '');
        if (text.trim()) push({ type: 'code', text });
      } else if (tag === 'p') {
        const src = absolute(el.querySelector('img')?.getAttribute('src'));
        if (src && /^https?:/i.test(src)) push({ type: 'image', src });
        const text = el.textContent.trim();
        if (text.length > 1) push({ type: 'paragraph', text });
      } else if (el.children.length) {
        walk(el);
      } else {
        const text = el.textContent.trim();
        if (text.length > 40) push({ type: 'paragraph', text });
      }
    }
  };
  walk(document.body);
  return blocks;
}

/** Last resort when the markup defeats the walker: split the plain text. */
function blocksFromText(text) {
  return text
    .split(/\n{2,}/)
    .map((t) => t.trim())
    .filter((t) => t.length > 40)
    .slice(0, MAX_BLOCKS)
    .map((t) => ({ type: 'paragraph', text: t }));
}

export const getArticle = async (req, res) => {
  const target = req.query.url;
  if (!target) return res.status(400).json({ success: false, message: 'No article link given.' });

  try {
    const { html, finalUrl } = await fetchArticleHtml(target);
    const { document } = parseHTML(html);

    // Readability mutates the document it is given, so the lead image is read first.
    const meta = (p) =>
      document.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.getAttribute('content') || null;
    const rawLead = meta('og:image') || meta('twitter:image');
    let leadImage = null;
    try { leadImage = rawLead ? new URL(rawLead, finalUrl).href : null; } catch { leadImage = null; }

    const article = new Readability(document).parse();
    let blocks = article ? toBlocks(article.content, finalUrl) : [];
    const text = article?.textContent?.trim() ?? '';
    if (!blocks.length && text) blocks = blocksFromText(text);

    if (text.length < 400) {
      // Client-rendered pages parse to almost nothing. Say so plainly instead of
      // showing an article that is three words long.
      return res.status(422).json({
        success: false,
        message: 'This article cannot be shown in the app.',
        url: finalUrl,
      });
    }

    return res.status(200).json({
      success: true,
      article: {
        title: article.title,
        byline: article.byline || null,
        siteName: article.siteName || new URL(finalUrl).hostname.replace(/^www\./, ''),
        leadImage,
        readingMinutes: Math.max(1, Math.round(text.split(/\s+/).length / 200)),
        blocks,
        url: finalUrl,
      },
    });
  } catch (error) {
    console.error('Article read failed:', error?.message);
    const timedOut = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return res.status(502).json({
      success: false,
      message: timedOut ? 'The publisher timed out.' : (error?.message ?? 'Could not open that article.'),
    });
  }
};
