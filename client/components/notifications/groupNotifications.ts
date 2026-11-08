/**
 * Instagram-style collapsing: within one time section, notifications of the
 * same groupable type on the same target fold into one row. Pure, no imports,
 * so `node groupNotifications.test.mjs` runs it directly (Node strips types).
 */
type Base = {
  _id: string;
  type: string;
  createdAt: string;
  isRead: boolean;
  sender?: { _id: string } | null;
  post?: { _id: string } | null;
  shorts?: { _id: string } | null;
};

export type NotifGroup<T extends Base> = {
  kind: 'group';
  _id: string;
  /** Newest member; drives text, time, thumbnail and tap target. */
  lead: T;
  items: T[];
  /** Distinct senders, newest first. */
  senders: NonNullable<T['sender']>[];
  unread: boolean;
};

export type SectionHeader<L> = { kind: 'header'; _id: string; label: L };

// Comments fold too ("and 2 others commented"); tags/splits/broadcasts stay single.
const GROUPABLE = new Set(['like', 'story_like', 'comment', 'story_comment', 'follow']);

const groupKey = (n: Base): string | null => {
  if (!GROUPABLE.has(n.type)) return null;
  if (n.type === 'follow') return 'follow';
  const target = n.post?._id || n.shorts?._id;
  return target ? `${n.type}:${target}` : null;
};

/** Input newest first. A group sits where its newest member was. */
export const groupNotifications = <T extends Base, L extends string>(
  items: T[],
  bucketOf: (iso: string) => L,
): (NotifGroup<T> | SectionHeader<L>)[] => {
  const out: (NotifGroup<T> | SectionHeader<L>)[] = [];
  let label: L | null = null;
  let open = new Map<string, NotifGroup<T>>();
  for (const n of items) {
    const b = bucketOf(n.createdAt);
    if (b !== label) {
      out.push({ kind: 'header', _id: `header-${b}`, label: b });
      label = b;
      open = new Map();
    }
    const key = groupKey(n);
    const g = key ? open.get(key) : undefined;
    if (g) {
      g.items.push(n);
      g.unread = g.unread || !n.isRead;
      if (n.sender && !g.senders.some(s => s._id === n.sender!._id)) g.senders.push(n.sender as any);
      continue;
    }
    const fresh: NotifGroup<T> = {
      kind: 'group', _id: n._id, lead: n, items: [n],
      senders: n.sender ? [n.sender as any] : [], unread: !n.isRead,
    };
    if (key) open.set(key, fresh);
    out.push(fresh);
  }
  return out;
};
