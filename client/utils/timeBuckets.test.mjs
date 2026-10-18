// Run: node utils/timeBuckets.test.mjs
import assert from "node:assert/strict";
import { timeBucket, withTimeHeaders } from "./timeBuckets.ts";

// 2026-10-18 00:30 IST == 2026-10-17 19:00 UTC
const now = Date.parse("2026-10-17T19:00:00Z");
assert.equal(timeBucket("2026-10-17T18:45:00Z", now), "Today");      // 00:15 IST same day
assert.equal(timeBucket("2026-10-17T18:00:00Z", now), "This week");  // 23:30 IST yesterday (UTC same day!)
assert.equal(timeBucket("2026-10-11T19:00:00Z", now), "This week");  // 6 IST days ago
assert.equal(timeBucket("2026-10-10T19:00:00Z", now), "Earlier");    // 7 IST days ago
assert.equal(timeBucket("garbage", now), "Earlier");

const rows = withTimeHeaders([
  { _id: "a", createdAt: "2026-10-17T18:50:00Z" },
  { _id: "b", createdAt: "2026-10-17T18:10:00Z" },
  { _id: "c", createdAt: "2026-10-16T10:00:00Z" },
  { _id: "d", createdAt: "2026-09-01T10:00:00Z" },
], now);
assert.deepEqual(rows.map(r => r._id), ["header-Today", "a", "header-This week", "b", "c", "header-Earlier", "d"]);
assert.deepEqual(withTimeHeaders([], now), []);
console.log("ok");
