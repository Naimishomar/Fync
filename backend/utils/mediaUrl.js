/**
 * Serve images through the API host's nginx cache instead of r2.dev.
 *
 * r2.dev is Cloudflare's development URL: no edge cache and rate limited, so
 * every feed photo paid 0.4-0.9s before its first byte. nginx on the Mumbai
 * box proxies /media/ to the bucket and keeps a disk copy, so a photo is slow
 * once per server and local after that.
 *
 * URLs stay stored as r2.dev; they are rewritten on the way out of res.json.
 * Videos are left alone (range requests, and they would flood the cache).
 * Off unless MEDIA_PUBLIC_URL is set, so this ships before nginx is ready.
 */

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const trim = (s) => s?.trim().replace(/\/$/, '');

export const makeMediaRewriter = (r2Base, mediaBase) => {
  r2Base = trim(r2Base);
  mediaBase = trim(mediaBase);
  if (!r2Base || !mediaBase) return null;
  const re = new RegExp(`${escape(r2Base)}/([^"\\s?#\\\\]+\\.(?:webp|jpe?g|png|gif|avif))`, 'gi');
  return (text) => (text.includes(r2Base) ? text.replace(re, `${mediaBase}/$1`) : text);
};

export const mediaUrlMiddleware = () => {
  const rewrite = makeMediaRewriter(process.env.R2_PUBLIC_URL, process.env.MEDIA_PUBLIC_URL);
  return (req, res, next) => {
    if (!rewrite) return next();
    const json = res.json.bind(res);
    res.json = (body) => {
      const text = JSON.stringify(body);
      if (typeof text !== 'string') return json(body);
      const out = rewrite(text);
      // Back through res.json as an object, never res.send(string): /batch
      // dispatches sub-requests with a stub response whose send() keeps the raw
      // value, so a string body reached the app as text and the screen saw no
      // `success` (profile posts vanished).
      return json(out === text ? body : JSON.parse(out));
    };
    next();
  };
};
