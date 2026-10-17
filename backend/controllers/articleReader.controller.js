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
import http from 'node:http';
import https from 'node:https';

/** A message meant for the student; anything else is reported generically. */
class ReaderError extends Error {}

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

/** Resolve once and check; the caller connects to exactly this address. */
async function assertPublicUrl(raw) {
  let u;
  try { u = new URL(raw); } catch { throw new ReaderError('That is not a valid link.'); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new ReaderError('Unsupported link type.');

  const resolved = await dns.lookup(u.hostname).catch(() => null);
  if (!resolved?.address) throw new ReaderError('That site could not be reached.');
  if (isPrivateAddress(resolved.address)) throw new ReaderError('That link is not allowed.');
  return { url: u, ...resolved };
}

/**
 * GET pinned to the address assertPublicUrl checked. fetch() would resolve the
 * name again at connect time, and a rebinding DNS server can answer that second
 * lookup with 127.0.0.1. TLS still verifies against the hostname.
 */
const pinnedGet = ({ url, address, family }) =>
  new Promise((resolve, reject) => {
    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.get(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      lookup: (_host, opts, cb) =>
        opts?.all ? cb(null, [{ address, family }]) : cb(null, address, family),
      signal: AbortSignal.timeout(12000),
    }, resolve);
    req.on('error', reject);
  });

/** Follows redirects by hand so each hop can be re-checked before it is fetched. */
async function fetchArticleHtml(startUrl) {
  let target = await assertPublicUrl(startUrl);

  for (let hop = 0; hop < MAX_HOPS; hop++) {
    const res = await pinnedGet(target);
    const { url } = target;

    if (res.statusCode >= 300 && res.statusCode < 400) {
      res.resume();
      const next = res.headers.location;
      if (!next) throw new ReaderError('That article could not be opened.');
      target = await assertPublicUrl(new URL(next, url).href);
      continue;
    }
    if (res.statusCode < 200 || res.statusCode >= 300) {
      res.resume();
      throw new ReaderError(`The publisher returned ${res.statusCode}.`);
    }

    const type = res.headers['content-type'] || '';
    if (!type.includes('html')) { res.destroy(); throw new ReaderError('That link is not an article.'); }

    // Guard against a multi-hundred-megabyte body starving the box: refuse a
    // declared oversize body outright, and count bytes as they stream in for
    // one that does not say (or lies).
    const tooLarge = () => { res.destroy(); return new ReaderError('That article is too large to open here.'); };
    if (Number(res.headers['content-length']) > MAX_BYTES) throw tooLarge();
    const chunks = [];
    let size = 0;
    for await (const chunk of res) {
      size += chunk.length;
      if (size > MAX_BYTES) throw tooLarge();
      chunks.push(chunk);
    }
    return { html: Buffer.concat(chunks).toString('utf8'), finalUrl: url.href };
  }
  throw new ReaderError('That article redirected too many times.');
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
      message: timedOut ? 'The publisher timed out.'
        : error instanceof ReaderError ? error.message : 'Could not open that article.',
    });
  }
};
