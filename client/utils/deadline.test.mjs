// Run: node utils/deadline.test.mjs
import assert from "node:assert/strict";
import { daysLeftLabel } from "./deadline.ts";

// 2026-10-18 23:00 IST == 17:30Z
const now = Date.parse("2026-10-18T17:30:00Z");
const lbl = (d) => daysLeftLabel(d, now)?.label;

assert.equal(daysLeftLabel(undefined, now), null);
assert.equal(daysLeftLabel("garbage", now), null);
assert.equal(lbl("2026-10-18T18:00:00Z"), "Closes today"); // 23:30 IST
assert.equal(lbl("2026-10-18T19:00:00Z"), "1 day left"); // still 18 Oct in UTC, 19 Oct 00:30 in IST
assert.equal(lbl("2026-10-18T10:00:00Z"), "Closes today"); // earlier today IST, still today
assert.equal(lbl("2026-10-17T18:29:00Z"), "Closed"); // 17 Oct 23:59 IST
assert.equal(lbl(new Date("2026-10-22T06:00:00Z")), "4 days left");
assert.equal(daysLeftLabel("2026-10-21T06:00:00Z", now).urgent, true);
assert.equal(daysLeftLabel("2026-10-25T06:00:00Z", now).urgent, false);
console.log("deadline ok");
