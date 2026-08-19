import axios from '../context/axiosConfig';

/**
 * Two ways to stop sending the same work to the server twice.
 *
 *   dedupedGet(path)   — collapses identical concurrent GETs into one request.
 *   batchGet(paths)    — sends several different GETs as one HTTP request.
 *
 * The screens here fan out hard on mount: home fires nine requests, the admin
 * portal twenty-three. Each one costs the server a full middleware pass — rate
 * limiter, JWT verify, auth cache lookup, routing, compression — before any
 * real work happens. On a small instance that fixed overhead is a meaningful
 * share of the budget.
 *
 * Deduping is the free half and needs no server support: two components asking
 * for the same URL in the same tick genuinely only need one answer.
 */

// ── Concurrent de-duplication ───────────────────────────────────────────────

const inflight = new Map<string, Promise<any>>();

/**
 * A GET that shares its promise with any identical GET already in flight.
 *
 * Deliberately not a cache: the entry is dropped the moment the request
 * settles, so this only merges genuinely simultaneous callers and never serves
 * a stale body. Screens that want caching across mounts use screenCache.
 */
export const dedupedGet = <T = any>(path: string, config?: any): Promise<T> => {
  const existing = inflight.get(path);
  if (existing) return existing;

  const promise = axios
    .get(path, config)
    .finally(() => {
      inflight.delete(path);
    });

  inflight.set(path, promise);
  return promise as Promise<T>;
};

// ── Batching ────────────────────────────────────────────────────────────────

/** Mirrors MAX_SUB_REQUESTS in backend/routes/batch.route.js. */
const MAX_BATCH = 12;

export type BatchResult<T = any> = {
  status: number;
  body: T;
};

/**
 * Sends several GET paths as one request.
 *
 * Returns a map keyed the same way you passed them in. A sub-request that fails
 * comes back with its own status rather than rejecting the whole call, so one
 * broken endpoint cannot blank a screen.
 *
 * Use it for the small, fast reads a screen needs to paint. Do NOT put a slow
 * endpoint in a batch: the response waits for the slowest member, so pairing a
 * 300ms feed query with three 10ms counters makes all four take 300ms.
 *
 * Falls back to parallel individual requests if the server has no /batch route
 * yet, so an app build can ship ahead of the backend deploy.
 */
export const batchGet = async <T extends Record<string, any> = Record<string, any>>(
  requests: Record<string, string>
): Promise<Record<keyof T, BatchResult>> => {
  const entries = Object.entries(requests);

  if (entries.length === 0) return {} as Record<keyof T, BatchResult>;

  if (entries.length > MAX_BATCH) {
    throw new Error(`batchGet accepts at most ${MAX_BATCH} requests, got ${entries.length}`);
  }

  try {
    const res = await axios.post('/batch', {
      requests: entries.map(([key, path]) => ({ key, path })),
    });
    if (res.data?.success && res.data.results) {
      return res.data.results;
    }
    throw new Error('Malformed batch response');
  } catch (error: any) {
    // 404 means this build is talking to a server without the batch route.
    // Anything else is a real failure, but the individual requests are still
    // worth trying — a degraded screen beats an empty one.
    const settled = await Promise.all(
      entries.map(async ([key, path]) => {
        try {
          const r = await axios.get(path);
          return [key, { status: r.status, body: r.data } as BatchResult];
        } catch (e: any) {
          return [
            key,
            { status: e?.response?.status ?? 0, body: e?.response?.data ?? null } as BatchResult,
          ];
        }
      })
    );
    return Object.fromEntries(settled) as Record<keyof T, BatchResult>;
  }
};

/** Convenience: the body of a batch entry, or null if that sub-request failed. */
export const bodyOf = <T = any>(result: BatchResult | undefined): T | null =>
  result && result.status >= 200 && result.status < 300 ? (result.body as T) : null;
