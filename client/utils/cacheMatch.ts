// Pure helpers for the axios read-through cache (context/axiosConfig.ts).
// Kept free of RN imports so utils/cacheMatch.test.mjs can run under plain node.

/** POSTs that are really reads: they must not wipe the cache. */
const READ_POSTS = ["/post/smart-feed", "/shorts/smart", "/batch", "/user/refresh-token"];

export function isReadPost(url: string): boolean {
  return READ_POSTS.includes(url.split("?")[0]);
}

/** Cache keys are `prefix + axios.getUri(config)`, i.e. they include baseURL.
 *  Return the relative path (+query) so it can be compared with config.url. */
export function cachedPathOf(key: string, prefix: string, baseURL?: string): string {
  let path = key.startsWith(prefix) ? key.slice(prefix.length) : key;
  const base = (baseURL || "").replace(/\/+$/, "");
  if (base && path.startsWith(base)) path = path.slice(base.length);
  return path;
}

/** Path prefixes whose cached GETs a write to `mutatedUrl` makes stale. */
export function relatedPrefixes(mutatedUrl: string): string[] {
  const parts = mutatedUrl.split("?")[0].split("/").filter(Boolean);
  const segment = parts.length > 0 ? `/${parts[0]}` : mutatedUrl;
  // Cross-cutting relationships: a change under one section invalidates feeds
  // and the cached profile too (e.g. liking a post changes feed + score).
  const related = new Set<string>([segment]);
  if (segment === "/post" || segment === "/shorts") {
    related.add("/post/feed");
    related.add("/shorts");
    related.add("/user");
  }
  if (segment === "/user") {
    related.add("/post/feed");
    related.add("/shorts");
  }
  return Array.from(related);
}

export function pathMatches(path: string, prefixes: string[]): boolean {
  return prefixes.some(
    (p) => path === p || path.startsWith(`${p}/`) || path.startsWith(`${p}?`)
  );
}

/** A `t=<epoch ms>` query param means the caller wanted to bypass the cache;
 *  storing it would only fill the cache with keys nobody reads again. */
export function isCacheBusted(url: string): boolean {
  return /[?&]_?t=\d{10,}/.test(url);
}
