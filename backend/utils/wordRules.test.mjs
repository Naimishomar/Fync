import assert from "node:assert/strict";
import { scoreGuess, isSolved, roundWinner, matchStatus, isAllowed, dailyAnswer, ANSWER_LIST } from "./wordRules.js";

const s = (g, a) => scoreGuess(g, a).join("");
// Duplicate letters: only as many marks as the answer holds, greens claim first.
assert.equal(s("speed", "abide"), "00101");
assert.equal(s("geese", "those"), "00022");
assert.equal(s("llama", "hello"), "11000");
assert.equal(s("hello", "llama"), "00110");
assert.equal(s("eerie", "there"), "10102");
assert.equal(s("crane", "crane"), "22222");
assert.equal(s("Allee", "eagle"), "11012");
assert.ok(isSolved([2, 2, 2, 2, 2]) && !isSolved([2, 2, 2, 2, 1]));

assert.ok(isAllowed("crane") && isAllowed("BOOKS") && !isAllowed("zzzzz") && !isAllowed("cran") && !isAllowed(null));
assert.ok(ANSWER_LIST.length > 1000 && ANSWER_LIST.every((w) => /^[a-z]{5}$/.test(w)));

const row = (m) => ({ marks: m.split("").map(Number) });
const p = (rows, solvedAt = null) => ({ guesses: rows.map(row), solvedAt });
assert.equal(roundWinner(p(["22222"], 5), p(["22220"])), "a");
assert.equal(roundWinner(p(["00000"]), p(["10000", "22222"], 9)), "b");
assert.equal(roundWinner(p(["1", "22222"].map((x) => x.padEnd(5, "0")), 3), p(["22222"], 9)), "b"); // fewer guesses
assert.equal(roundWinner(p(["22222"], 3), p(["22222"], 9)), "a"); // same count, earlier
// Nobody solved: one green beats any number of yellows; equal is a draw.
assert.equal(roundWinner(p(["11110"]), p(["20000"])), "b");
assert.equal(roundWinner(p(["22100"]), p(["22010", "00000"])), null);
assert.equal(roundWinner(p([]), p([])), null);
assert.equal(roundWinner(p(["10000"]), p([])), "a");

assert.deepEqual(matchStatus(2, 0, 2), { over: true, winner: "a" });
assert.deepEqual(matchStatus(1, 1, 2), { over: false, winner: null });
assert.deepEqual(matchStatus(1, 2, 3), { over: true, winner: "b" });
assert.deepEqual(matchStatus(1, 1, 3), { over: true, winner: null });
assert.deepEqual(matchStatus(1, 0, 3), { over: true, winner: "a" });

// Daily: same all IST day, changes at IST midnight (18:30 UTC), no repeats for a year.
const d = Date.UTC(2026, 9, 18, 18, 29);
assert.equal(dailyAnswer(d), dailyAnswer(Date.UTC(2026, 9, 17, 18, 31)));
assert.notEqual(dailyAnswer(d), dailyAnswer(d + 2 * 60000));
const year = new Set(Array.from({ length: 365 }, (_, i) => dailyAnswer(d + i * 86400000)));
assert.equal(year.size, 365);
console.log("wordRules ok");
