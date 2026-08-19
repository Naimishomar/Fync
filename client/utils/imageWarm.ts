import { Image as ExpoImage } from 'expo-image';
import { getFullUrl } from './imageUtils';

/**
 * Warms the image cache ahead of render.
 *
 * The feed's first page is restored from AsyncStorage so the rows paint
 * instantly, but the photos in those rows are remote URLs -- so the text
 * appeared immediately and the images arrived a second or two later, which is
 * the part users actually notice. Prefetching pulls them into expo-image's disk
 * cache while the list is still laying out, and again one page ahead as they
 * scroll, so by the time a row is on screen its image is already local.
 *
 * R2 already serves these with `public, max-age=2592000`, so a warmed image
 * stays warm across app launches.
 */

/** Neutral slate placeholder. Holds the layout so rows never jump. */
export const POST_PLACEHOLDER = 'L6PZfSjE.AyE_3t7t7R**0o#DgR4';

type PostLike = { image?: string[] | null };

/**
 * How many posts ahead to warm. Small on purpose: prefetching the whole page
 * would compete for bandwidth with the images actually on screen.
 */
const LOOKAHEAD_POSTS = 4;

/** Only the first photo of each post — the rest load when the carousel is swiped. */
export const prefetchPostImages = (posts: PostLike[], count = LOOKAHEAD_POSTS) => {
  const urls = posts
    .slice(0, count)
    .map((p) => getFullUrl(p?.image?.[0]))
    .filter((u): u is string => Boolean(u));

  if (urls.length === 0) return;

  // Fire and forget: a failed prefetch just means the normal load path runs.
  ExpoImage.prefetch(urls, { cachePolicy: 'disk' }).catch(() => {});
};
