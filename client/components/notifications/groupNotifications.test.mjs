// Run: node components/notifications/groupNotifications.test.mjs
import assert from 'node:assert/strict';
import { groupNotifications } from './groupNotifications.ts';

const bucket = iso => (iso < '2026-11-08' ? 'Earlier' : 'Today');
const n = (_id, type, createdAt, sender, post, isRead = true) =>
  ({ _id, type, createdAt, isRead, sender: { _id: sender }, ...(post ? { post: { _id: post } } : {}) });

const rows = groupNotifications([
  n('1', 'like', '2026-11-08T10', 'rahul', 'p1', false),
  n('2', 'comment', '2026-11-08T09', 'asha', 'p1'),
  n('3', 'like', '2026-11-08T08', 'asha', 'p1'),
  n('4', 'like', '2026-11-08T07', 'rahul', 'p1'),   // same sender again: not counted twice
  n('5', 'follow', '2026-11-08T06', 'dev'),
  n('6', 'follow', '2026-11-08T05', 'mia'),
  n('7', 'like', '2026-11-08T04', 'mia', 'p2'),      // other post: own row
  n('8', 'tag', '2026-11-08T03', 'mia', 'p1'),       // not groupable
  n('9', 'like', '2026-11-07T10', 'zed', 'p1'),      // new section: new group
  n('10', 'like', '2026-11-07T09', 'kim'),           // no target: own row
  n('11', 'like', '2026-11-07T08', 'lee'),
], bucket);

const shape = rows.map(r => r.kind === 'header' ? `#${r.label}` : `${r._id}:${r.items.length}:${r.senders.map(s => s._id).join(',')}`);
assert.deepEqual(shape, ['#Today', '1:3:rahul,asha', '2:1:asha', '5:2:dev,mia', '7:1:mia', '8:1:mia', '#Earlier', '9:1:zed', '10:1:kim', '11:1:lee']);
assert.equal(rows[1].unread, true);
assert.equal(rows[3].unread, false);
assert.equal(rows[1].lead._id, '1');
console.log('groupNotifications ok');
