/**
 * Share cards: the image a user shares for a post or their profile, and the
 * og:image WhatsApp/Instagram show for the link. SVG built here, rasterised by
 * sharp (librsvg). Pure: callers pass already-fetched image buffers.
 *
 * Fonts: the server has DejaVu Sans only, so everything is generic sans-serif
 * and text width is estimated per character (no font metrics in librsvg-land).
 * Emoji are stripped: no colour emoji font on the box, they would render as tofu.
 */
import sharp from 'sharp';
import QRCode from 'qrcode';

const PAPER = '#F5F2EC', CARD = '#FFFFFF', INK = '#12100E', INK2 = '#57534E', INK3 = '#8A847C';
const LINE = '#E7E2D9', BRAND = '#F97316', PEACH = '#FDBA74';
const FONT = 'font-family="sans-serif"';

// XML 1.0 forbids most C0 controls even escaped; drop them with the emoji.
const STRIP = /[\u0000-\u0008\u000B\u000C\u000E-\u001F‍️\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}]/gu;

export const esc = (s) => String(s ?? '')
  .replace(STRIP, '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&apos;');

const clean = (s) => String(s ?? '').replace(STRIP, '').replace(/\s+/g, ' ').trim();

export const truncate = (s, max) => {
  const t = clean(s);
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Greedy word wrap to `maxChars` per line, at most `maxLines`, ellipsis when cut. */
export const wrap = (s, maxChars, maxLines) => {
  const words = clean(s).split(' ').filter(Boolean)
    .flatMap((w) => w.match(new RegExp(`.{1,${maxChars}}`, 'gu')) ?? []);
  const lines = [];
  let cur = '';
  for (let i = 0; i < words.length; i++) {
    const next = cur ? `${cur} ${words[i]}` : words[i];
    if (next.length <= maxChars) { cur = next; continue; }
    lines.push(cur);
    cur = words[i];
    if (lines.length === maxLines) {
      lines[maxLines - 1] = truncate(`${lines[maxLines - 1]} ${words.slice(i).join(' ')}`, maxChars);
      return lines;
    }
  }
  if (cur) lines.push(cur);
  return lines;
};

export const formatCount = (n) => {
  n = Math.max(0, Number(n) || 0);
  const f = (v, u) => `${v >= 10 ? Math.floor(v) : Math.floor(v * 10) / 10}${u}`;
  if (n >= 1e6) return f(n / 1e6, 'M');
  if (n >= 1e3) return f(n / 1e3, 'K');
  return String(Math.floor(n));
};

// ~0.6em average glyph width for DejaVu Sans (wider than mac Helvetica); good enough to wrap without overflow.
const charsFor = (width, size) => Math.floor(width / (size * 0.6));

const dataUri = (buf, mime) => `data:${mime};base64,${buf.toString('base64')}`;

const photoUri = async (buf, w, h) => {
  if (!buf) return null;
  try {
    const out = await sharp(buf).rotate().resize(w, h, { fit: 'cover' }).jpeg({ quality: 86 }).toBuffer();
    return dataUri(out, 'image/jpeg');
  } catch { return null; } // corrupt / unsupported (HEIC) -> placeholder
};

const qrUri = async (url, size) =>
  dataUri(await QRCode.toBuffer(url, { margin: 1, width: size, color: { dark: INK, light: '#FFFFFF' } }), 'image/png');

const tspans = (lines, x, y, lh) =>
  lines.map((l, i) => `<tspan x="${x}" y="${y + i * lh}">${esc(l)}</tspan>`).join('');

const avatarSvg = (uri, cx, cy, r, name, id) => uri
  ? `<clipPath id="${id}"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath>
     <image x="${cx - r}" y="${cy - r}" width="${2 * r}" height="${2 * r}" xlink:href="${uri}" clip-path="url(#${id})" preserveAspectRatio="xMidYMid slice"/>`
  : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#brandGrad)"/>
     <text x="${cx}" y="${cy + r * 0.36}" ${FONT} font-size="${r}" font-weight="700" fill="${CARD}" text-anchor="middle">${esc((clean(name)[0] || 'F').toUpperCase())}</text>`;

const svgOpen = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
<defs><linearGradient id="brandGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${BRAND}"/><stop offset="1" stop-color="${PEACH}"/></linearGradient></defs>
<rect width="${w}" height="${h}" fill="${PAPER}"/>
<rect x="40" y="40" width="${w - 80}" height="${h - 80}" rx="48" fill="${CARD}" stroke="${LINE}" stroke-width="2"/>`;

const toImage = (svg, format) => {
  const img = sharp(Buffer.from(svg));
  return format === 'jpg' ? img.jpeg({ quality: 82, mozjpeg: true }).toBuffer() : img.png({ compressionLevel: 9 }).toBuffer();
};

/** 1080x1350. post: { name, username, caption, likes, comments, photo?: Buffer, avatar?: Buffer }. */
export const renderPostCard = async (post, url, format = 'png') => {
  const [photo, avatar, qr] = await Promise.all([
    photoUri(post.photo, 920, 760), photoUri(post.avatar, 176, 176), qrUri(url, 300),
  ]);
  const caption = clean(post.caption);
  const media = photo
    ? `<clipPath id="ph"><rect x="80" y="210" width="920" height="760" rx="32"/></clipPath>
       <image x="80" y="210" width="920" height="760" xlink:href="${photo}" clip-path="url(#ph)"/>
       <text ${FONT} font-size="34" fill="${INK}">${tspans(wrap(caption, charsFor(920, 34), 3), 80, 1026, 46)}</text>`
    // Text-only post (or the photo failed): the caption is the picture.
    : `<rect x="80" y="210" width="920" height="900" rx="32" fill="url(#brandGrad)"/>
       <text ${FONT} font-size="54" font-weight="700" fill="${INK}">${tspans(wrap(caption || 'A post on Fync', charsFor(800, 54), 7), 140, 340, 76)}</text>`;
  const svg = `${svgOpen(1080, 1350)}
${avatarSvg(avatar, 132, 134, 44, post.name || post.username, 'av')}
<text x="196" y="126" ${FONT} font-size="36" font-weight="700" fill="${INK}">${esc(truncate(post.name || post.username, 26))}</text>
<text x="196" y="166" ${FONT} font-size="28" fill="${INK3}">@${esc(truncate(post.username, 30))}</text>
<text x="1000" y="150" ${FONT} font-size="48" font-weight="800" fill="${BRAND}" text-anchor="end">Fync</text>
${media}
<text x="80" y="1222" ${FONT} font-size="32" font-weight="700" fill="${INK}">${formatCount(post.likes)} likes  ·  ${formatCount(post.comments)} comments</text>
<text x="80" y="1266" ${FONT} font-size="26" fill="${INK3}">Scan to view on Fync</text>
<rect x="842" y="1140" width="158" height="158" rx="16" fill="#FFFFFF" stroke="${LINE}" stroke-width="2"/>
<image x="846" y="1144" width="150" height="150" xlink:href="${qr}"/>
</svg>`;
  return toImage(svg, format);
};

/** 1080x1080. user: { name, username, college, followers, following, posts, avatar?: Buffer }. */
export const renderProfileCard = async (user, url, format = 'png') => {
  const [avatar, qr] = await Promise.all([photoUri(user.avatar, 520, 520), qrUri(url, 320)]);
  const stat = (x, n, label) => `<text x="${x}" y="736" ${FONT} font-size="48" font-weight="700" fill="${INK}" text-anchor="middle">${formatCount(n)}</text>
<text x="${x}" y="776" ${FONT} font-size="24" fill="${INK3}" text-anchor="middle">${label}</text>`;
  const svg = `${svgOpen(1080, 1080)}
<clipPath id="card"><rect x="40" y="40" width="1000" height="1000" rx="48"/></clipPath>
<rect x="40" y="40" width="1000" height="300" fill="url(#brandGrad)" clip-path="url(#card)"/>
<text x="96" y="124" ${FONT} font-size="48" font-weight="800" fill="${CARD}">Fync</text>
<circle cx="540" cy="340" r="142" fill="${CARD}"/>
${avatarSvg(avatar, 540, 340, 130, user.name || user.username, 'av')}
<text x="540" y="540" ${FONT} font-size="56" font-weight="700" fill="${INK}" text-anchor="middle">${esc(truncate(user.name || user.username, 24))}</text>
<text x="540" y="590" ${FONT} font-size="32" fill="${INK3}" text-anchor="middle">@${esc(truncate(user.username, 30))}</text>
${user.college ? `<text x="540" y="638" ${FONT} font-size="28" fill="${INK2}" text-anchor="middle">${esc(truncate(user.college, 44))}</text>` : ''}
${stat(300, user.followers, 'followers')}${stat(540, user.following, 'following')}${stat(780, user.posts, 'posts')}
<line x1="96" y1="830" x2="984" y2="830" stroke="${LINE}" stroke-width="2"/>
<text x="96" y="914" ${FONT} font-size="34" font-weight="700" fill="${INK}">Scan to see my profile</text>
<text x="96" y="958" ${FONT} font-size="26" fill="${INK3}">Find me on Fync</text>
<rect x="824" y="848" width="168" height="168" rx="16" fill="#FFFFFF" stroke="${LINE}" stroke-width="2"/>
<image x="828" y="852" width="160" height="160" xlink:href="${qr}"/>
</svg>`;
  return toImage(svg, format);
};
