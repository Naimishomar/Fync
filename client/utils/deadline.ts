// Pure deadline helper; no RN imports so utils/deadline.test.mjs runs under plain node.

const IST_OFFSET = 330 * 60000;
const DAY = 86400000;
const istDay = (ms: number) => Math.floor((ms + IST_OFFSET) / DAY);

/** "3 days left" / "Closes today" / "Closed", counted in IST calendar days. Null when there's no usable date. */
export function daysLeftLabel(
  date?: string | Date | null,
  now: number = Date.now()
): { label: string; urgent: boolean } | null {
  if (!date) return null;
  const t = new Date(date).getTime();
  if (Number.isNaN(t)) return null;
  const n = istDay(t) - istDay(now);
  if (n < 0) return { label: 'Closed', urgent: false };
  if (n === 0) return { label: 'Closes today', urgent: true };
  return { label: `${n} ${n === 1 ? 'day' : 'days'} left`, urgent: n <= 3 };
}
