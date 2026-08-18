import { AppState } from 'react-native';
import axios from '../context/axiosConfig';

// View counting used to be one HTTP request per short, fired the moment a video
// became active. A user scrolling 100 shorts sent 100 requests, each paying a
// JWT verify, an auth lookup, the rate limiter and its own Mongo write.
//
// Views are a counter, not a transaction: nothing in the UI reads the result
// back, and being a few seconds late costs nothing. So they are queued and sent
// as one batch.

const FLUSH_AT_SIZE = 10;      // a batch is worth sending
const FLUSH_AFTER_MS = 5000;   // ...or the reader is lingering on one short
const MAX_PENDING = 200;       // ceiling while offline, so the queue cannot grow forever

const pending = new Set<string>();
// Counted once per app session. Previously scrolling back up re-fired the
// effect and re-counted the same short, inflating the number.
const counted = new Set<string>();
let timer: ReturnType<typeof setTimeout> | null = null;

export async function flushShortViews(): Promise<void> {
  if (timer) {
    clearTimeout(timer);
    timer = null;
  }
  if (!pending.size) return;

  const ids = Array.from(pending);
  pending.clear();

  try {
    await axios.post('/shorts/views', { ids });
  } catch {
    // Requeue so the next flush retries, but never past the ceiling — a long
    // offline stretch should drop old views, not accumulate unboundedly.
    for (const id of ids) {
      if (pending.size >= MAX_PENDING) break;
      pending.add(id);
    }
  }
}

export function queueShortView(id?: string | null): void {
  if (!id || counted.has(id)) return;
  counted.add(id);
  pending.add(id);

  if (pending.size >= FLUSH_AT_SIZE) {
    void flushShortViews();
  } else if (!timer) {
    timer = setTimeout(() => void flushShortViews(), FLUSH_AFTER_MS);
  }
}

// Leaving the app is the most common way a session ends, and a pending batch
// would otherwise be lost.
AppState.addEventListener('change', (state) => {
  if (state !== 'active') void flushShortViews();
});
