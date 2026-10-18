/** Instagram-style notification sections, on the IST calendar. */
export type TimeBucket = 'Today' | 'This week' | 'Earlier';

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const istDay = (ms: number) => Math.floor((ms + IST_OFFSET_MS) / DAY_MS);

export const timeBucket = (iso: string, now = Date.now()): TimeBucket => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'Earlier';
  const diff = istDay(now) - istDay(t);
  if (diff <= 0) return 'Today';
  if (diff < 7) return 'This week';
  return 'Earlier';
};

export type HeaderRow = { kind: 'header'; _id: string; label: TimeBucket };

/** Interleaves a header row before the first item of each bucket (input is newest first). */
export const withTimeHeaders = <T extends { createdAt: string }>(items: T[], now = Date.now()): (T | HeaderRow)[] => {
  const out: (T | HeaderRow)[] = [];
  let last: TimeBucket | null = null;
  for (const it of items) {
    const b = timeBucket(it.createdAt, now);
    if (b !== last) {
      out.push({ kind: 'header', _id: `header-${b}`, label: b });
      last = b;
    }
    out.push(it);
  }
  return out;
};
