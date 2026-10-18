// node backend/utils/coupleRules.test.mjs
import assert from "node:assert/strict";
import { isDateKey, dayDiff, addDays, nextStreak, liveStreak, nextDates, togetherStats, questionIndex } from "./coupleRules.js";
import { COUPLE_QUESTIONS } from "./coupleQuestions.js";

assert.ok(isDateKey("2026-02-28"));
assert.ok(!isDateKey("2026-02-30"));
assert.ok(!isDateKey("26-1-1"));
assert.equal(dayDiff("2026-02-28", "2026-03-01"), 1);
assert.equal(addDays("2026-12-31", 1), "2027-01-01");

// Streaks
assert.equal(nextStreak(0, null, "2026-10-18"), 1);
assert.equal(nextStreak(4, "2026-10-17", "2026-10-18"), 5);
assert.equal(nextStreak(4, "2026-10-18", "2026-10-18"), 4);
assert.equal(nextStreak(4, "2026-10-15", "2026-10-18"), 1);
assert.equal(liveStreak(4, "2026-10-17", "2026-10-18"), 4); // still alive until today ends
assert.equal(liveStreak(4, "2026-10-18", "2026-10-18"), 4);
assert.equal(liveStreak(4, "2026-10-16", "2026-10-18"), 0);
assert.equal(liveStreak(0, null, "2026-10-18"), 0);

// Monthiversary clamps to month end; anniversary is the next yearly date.
let n = nextDates("2026-01-31", "2026-02-10");
assert.deepEqual(n.monthiversary, { date: "2026-02-28", months: 1, inDays: 18 });
assert.deepEqual(n.anniversary, { date: "2027-01-31", years: 1, inDays: 355 });
n = nextDates("2025-10-18", "2026-10-18"); // on the anniversary itself -> next ones
assert.equal(n.monthiversary.date, "2026-11-18");
assert.equal(n.anniversary.date, "2027-10-18");
assert.equal(n.anniversary.years, 2);
n = nextDates("2024-02-29", "2025-02-27");
assert.equal(n.anniversary.date, "2025-02-28");

const t = togetherStats("2026-07-10", "2026-10-18");
assert.equal(t.days, 100);
assert.deepEqual(t.milestones.map((m) => m.days), [7, 30, 50, 100]);
assert.equal(t.nextMilestone.days, 200);
assert.equal(togetherStats("2026-10-20", "2026-10-18").days, 0); // future since never goes negative

// Questions: deterministic, in range, varied day to day, bank big and unique.
const N = COUPLE_QUESTIONS.length;
assert.ok(N >= 150, `only ${N} questions`);
assert.equal(new Set(COUPLE_QUESTIONS).size, N);
assert.equal(questionIndex("2026-10-18", N), questionIndex("2026-10-18", N));
assert.notEqual(questionIndex("2026-10-18", N), questionIndex("2026-10-19", N));
for (let i = 0; i < 400; i++) {
    const q = questionIndex(addDays("2026-01-01", i), N);
    assert.ok(q >= 0 && q < N);
}

console.log("coupleRules tests passed");
