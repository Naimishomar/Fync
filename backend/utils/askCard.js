/**
 * "Ask me anything" story card, 1080x1920: the anonymous question in a white card
 * on the brand gradient, the answer under it, and the sender's own link.
 * Same SVG -> sharp approach and text helpers as utils/shareCard.js.
 */
import sharp from 'sharp';
import { esc, wrap } from './shareCard.js';

const FONT = 'font-family="sans-serif"';
const lines = (ls, x, y, lh, anchor = 'start') =>
  ls.map((l, i) => `<tspan x="${x}" y="${y + i * lh}" text-anchor="${anchor}">${esc(l)}</tspan>`).join('');

/** { question, answer, link } -> PNG buffer. */
export const renderAskCard = async ({ question, answer, link }) => {
  // ~0.6em glyph width (DejaVu Sans), as in shareCard.js.
  const q = wrap(question, Math.floor(820 / (52 * 0.6)), 6);
  const cardTop = 380, cardH = 150 + q.length * 70 + 40;
  const ansTop = cardTop + cardH + 130;
  // Answer fills what's left above the footer pill (y 1640).
  const a = wrap(answer, Math.floor(900 / (56 * 0.6)), Math.floor((1570 - ansTop) / 76) + 1);
  const shortLink = String(link).replace(/^https?:\/\//, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
<defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="#F97316"/><stop offset="1" stop-color="#FDBA74"/></linearGradient></defs>
<rect width="1080" height="1920" fill="url(#g)"/>
<text x="540" y="230" ${FONT} font-size="84" font-weight="800" fill="#FFFFFF" text-anchor="middle">Fync</text>
<rect x="90" y="${cardTop}" width="900" height="${cardH}" rx="48" fill="#FFFFFF"/>
<rect x="90" y="${cardTop}" width="900" height="110" rx="48" fill="#12100E"/>
<rect x="90" y="${cardTop + 60}" width="900" height="50" fill="#12100E"/>
<text x="540" y="${cardTop + 72}" ${FONT} font-size="36" font-weight="700" fill="#FFFFFF" text-anchor="middle">anonymous question</text>
<text ${FONT} font-size="52" font-weight="700" fill="#12100E">${lines(q, 540, cardTop + 200, 70, 'middle')}</text>
<text ${FONT} font-size="56" font-weight="700" fill="#12100E">${lines(a, 540, ansTop, 76, 'middle')}</text>
<rect x="190" y="1640" width="700" height="96" rx="48" fill="#FFFFFF"/>
<text x="540" y="1702" ${FONT} font-size="36" font-weight="700" fill="#F97316" text-anchor="middle">send me anonymous messages →</text>
<text x="540" y="1810" ${FONT} font-size="32" fill="#12100E" text-anchor="middle">${esc(shortLink)}</text>
</svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
};
