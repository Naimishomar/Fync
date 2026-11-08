/**
 * Public share surfaces, no auth (link-preview crawlers can't log in):
 *   GET /card/post/<id>.png|.jpg   GET /card/u/<id>.png|.jpg   share-card images
 *   GET /u/<id>   GET /view?postId=|shortId=                   app-open bridges + og tags
 * Only what is already public: private posts and banned users 404.
 * .png is what the app shares; .jpg is the og:image (WhatsApp drops previews over ~600KB).
 */
import { Router } from 'express';
import mongoose from 'mongoose';
import Post from '../models/post.model.js';
import User from '../models/user.model.js';
import { renderPostCard, renderProfileCard, esc, truncate } from '../utils/shareCard.js';

const router = Router();
// Fixed, not req.host: the rendered QR is cached, a spoofed Host must not end up in it.
export const BASE = (process.env.PUBLIC_BASE_URL || 'https://fync-api.duckdns.org').replace(/\/$/, '');
export const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.naimishomar.fync';
const ID = /^[a-f0-9]{24}$/i;
const FILE = /^([a-f0-9]{24})\.(png|jpg)$/i;

export const postLink = (id) => `${BASE}/view?postId=${id}`;
export const profileLink = (id) => `${BASE}/u/${id}`;

// ponytail: per-process LRU of 100 rendered cards (~150KB each, ~15MB worst case);
// not shared across instances. Move to nginx proxy_cache if card traffic grows.
const cache = new Map();
const MAX = 100;
export const cached = async (key, make) => {
  if (cache.has(key)) {
    const v = cache.get(key);
    cache.delete(key); cache.set(key, v); // refresh recency
    return v;
  }
  const v = await make();
  cache.set(key, v);
  if (cache.size > MAX) cache.delete(cache.keys().next().value);
  return v;
};

// Only our own media hosts: avatar/image URLs come from user data, fetching
// arbitrary ones would be an SSRF. Anything else falls back to a placeholder.
const MEDIA_HOSTS = new Set([process.env.R2_PUBLIC_URL, process.env.MEDIA_PUBLIC_URL]
  .filter(Boolean).map((u) => { try { return new URL(u.trim()).host; } catch { return null; } }).filter(Boolean));
const fetchMedia = async (url) => {
  try {
    if (!url) return null;
    const u = new URL(url, process.env.R2_PUBLIC_URL?.trim().replace(/\/?$/, '/') || undefined);
    if (u.protocol !== 'https:' || !MEDIA_HOSTS.has(u.host)) return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(5000) });
    if (!res.ok || Number(res.headers.get('content-length')) > 10e6) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf.length > 10e6 ? null : buf;
  } catch { return null; }
};

const loadPost = (id) => Post.findById(id)
  .select('description image isPrivate likes comments user updatedAt')
  .populate('user', 'name username avatar isBanned')
  .lean()
  .then((p) => (p && !p.isPrivate && p.user && !p.user.isBanned ? p : null));

const loadUser = async (id) => {
  const [u] = await User.aggregate([
    { $match: { _id: new mongoose.Types.ObjectId(id), isBanned: { $ne: true } } },
    { $project: { name: 1, username: 1, avatar: 1, college: 1, updatedAt: 1,
      followers: { $size: { $ifNull: ['$followers', []] } }, following: { $size: { $ifNull: ['$following', []] } } } },
  ]);
  return u || null;
};

const sendCard = (res, format, buf) => res
  .type(format === 'jpg' ? 'image/jpeg' : 'image/png')
  .set('Cache-Control', 'public, max-age=600')
  .send(buf);

router.get('/card/post/:file', async (req, res, next) => {
  try {
    const m = FILE.exec(req.params.file);
    const post = m && await loadPost(m[1]);
    if (!post) return res.status(404).end();
    const fmt = m[2].toLowerCase();
    const buf = await cached(`p:${post._id}:${fmt}:${+new Date(post.updatedAt)}`, async () => {
      const [photo, avatar] = await Promise.all([fetchMedia(post.image?.[0]), fetchMedia(post.user.avatar)]);
      return renderPostCard({
        name: post.user.name, username: post.user.username, caption: post.description,
        likes: post.likes, comments: post.comments?.length, photo, avatar,
      }, postLink(post._id), fmt);
    });
    sendCard(res, fmt, buf);
  } catch (e) { next(e); }
});

router.get('/card/u/:file', async (req, res, next) => {
  try {
    const m = FILE.exec(req.params.file);
    const user = m && await loadUser(m[1]);
    if (!user) return res.status(404).end();
    const fmt = m[2].toLowerCase();
    const buf = await cached(`u:${user._id}:${fmt}:${+new Date(user.updatedAt)}`, async () => {
      const [avatar, posts] = await Promise.all([
        fetchMedia(user.avatar), Post.countDocuments({ user: user._id, isPrivate: { $ne: true } }),
      ]);
      return renderProfileCard({ ...user, posts, avatar }, profileLink(user._id), fmt);
    });
    sendCard(res, fmt, buf);
  } catch (e) { next(e); }
});

// Android only opens the app from an https link when App Links are verified
// (assetlinks.json still has a placeholder fingerprint), so a tap or camera scan
// usually lands here in the browser. Hand off through an intent:// URL (Chrome)
// / fync:// scheme, falling back to the Play Store when the app is not installed.
const bridge = (res, { deepPath, label, og }) => {
  const intent = `intent://${deepPath}#Intent;scheme=fync;package=com.naimishomar.fync;S.browser_fallback_url=${encodeURIComponent(PLAY_URL)};end`;
  const meta = og ? `
<meta property="og:site_name" content="Fync"><meta property="og:type" content="website">
<meta property="og:title" content="${esc(og.title)}"><meta property="og:description" content="${esc(og.description)}">
<meta property="og:url" content="${esc(og.url)}"><meta property="og:image" content="${esc(og.image)}">
<meta property="og:image:type" content="image/jpeg"><meta property="og:image:width" content="1080"><meta property="og:image:height" content="${og.height}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${esc(og.image)}">` : '';
  // helmet's default CSP (script-src 'self') blocked the auto-open script; every value here is id-validated or escaped.
  res.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'");
  res.type('html').send(`<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(og?.title || 'Open in Fync')}</title>${meta}
<style>body{font-family:system-ui,sans-serif;background:#F5F2EC;color:#12100E;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0}
main{text-align:center;padding:24px}a{display:inline-block;margin-top:16px;padding:14px 28px;border-radius:999px;background:#F97316;color:#12100E;font-weight:600;text-decoration:none}</style>
</head><body><main><h2>Opening Fync…</h2><p>If nothing happens, tap below.</p>
<a id="open" href="fync://${deepPath}">${label}</a>
<p><a href="${PLAY_URL}" style="background:none;color:#57534E;padding:0">Get the app</a></p></main>
<script>var a=/android/i.test(navigator.userAgent);var u=a?${JSON.stringify(intent)}:${JSON.stringify(`fync://${deepPath}`)};document.getElementById('open').href=u;location.href=u;</script>
</body></html>`);
};

// Profile QR codes (client components/ui/ProfileQR.tsx) encode this URL.
router.get('/u/:id', async (req, res, next) => {
  try {
    const id = String(req.params.id);
    if (!ID.test(id)) return res.status(404).type('html').send('Profile not found');
    const u = await loadUser(id);
    bridge(res, {
      deepPath: `u/${id}`, label: 'Open profile in Fync',
      og: u && {
        title: `${truncate(u.name || u.username, 60)} (@${u.username}) on Fync`,
        description: [u.college, `${u.followers} followers`].filter(Boolean).join(' · '),
        url: profileLink(id), image: `${BASE}/card/u/${id}.jpg?v=${+new Date(u.updatedAt)}`, height: 1080,
      },
    });
  } catch (e) { next(e); }
});

// Shared post/short links (client home-screen / IndividualPostOrShort). The app
// routes `view` to IndividualPostOrShort with the same query.
router.get('/view', async (req, res, next) => {
  try {
    const { postId, shortId } = req.query;
    const id = typeof postId === 'string' ? postId : typeof shortId === 'string' ? shortId : '';
    if (!ID.test(id)) return res.redirect(PLAY_URL);
    const post = postId && await loadPost(id);
    bridge(res, {
      deepPath: `view?${postId ? 'postId' : 'shortId'}=${id}`, label: 'Open in Fync',
      og: post && {
        title: `${truncate(post.user.name || post.user.username, 60)} on Fync`,
        description: truncate(post.description, 160),
        url: postLink(id), image: `${BASE}/card/post/${id}.jpg?v=${+new Date(post.updatedAt)}`, height: 1350,
      },
    });
  } catch (e) { next(e); }
});

export default router;
