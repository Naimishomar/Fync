import assert from "node:assert/strict";
import { WORD_PAIRS, spyCount, deal, checkClue, tally, winner, guessMatches } from "./spyRules.js";

assert.ok(WORD_PAIRS.length >= 100);
assert.equal(new Set(WORD_PAIRS.map((p) => p.join("|").toLowerCase())).size, WORD_PAIRS.length, "duplicate pair");
assert.equal(spyCount(4), 1); assert.equal(spyCount(6), 1); assert.equal(spyCount(7), 2); assert.equal(spyCount(8), 2);

for (const n of [4, 6, 7, 8]) {
    const ids = Array.from({ length: n }, (_, i) => `u${i}`);
    const d = deal(ids);
    assert.equal(d.spies.length, spyCount(n));
    assert.equal(new Set(d.spies).size, d.spies.length);
    assert.ok(d.spies.every((s) => ids.includes(s)));
    assert.notEqual(d.civWord, d.spyWord);
}

assert.deepEqual(checkClue("  hot ", "Chai"), { ok: true, clue: "Hot" });
assert.equal(checkClue("masalachai", "Chai").ok, false);
assert.equal(checkClue("two words", "Chai").ok, false);
assert.equal(checkClue("abc1", "Chai").ok, false);
assert.equal(checkClue("", "Chai").ok, false);
assert.equal(checkClue("a".repeat(21), "Chai").ok, false);
assert.equal(checkClue("trains", "Local train").ok, false);
assert.equal(checkClue("localtrain", "Local train").ok, false);
assert.equal(checkClue("crowded", "Local train").ok, true);

const alive = ["a", "b", "c", "d"];
assert.equal(tally({ a: "b", c: "b", d: "a" }, alive), "b");
assert.equal(tally({ a: "b", b: "a" }, alive), null, "tie = nobody");
assert.equal(tally({}, alive), null);
assert.equal(tally({ a: "x", x: "b", b: "a" }, alive), "a", "dead target/voter ignored");

assert.equal(winner(["a", "b", "c"], ["d"]), "civilians");
assert.equal(winner(["a", "b", "c"], ["a"]), null);
assert.equal(winner(["a", "b"], ["a"]), "spies");
assert.equal(winner(["a", "b", "c", "d"], ["a", "b"]), "spies");
assert.equal(winner(["a", "b", "c", "d", "e"], ["a", "b"]), null);
assert.equal(winner(["c", "d", "e"], ["a", "b"]), "civilians");

assert.ok(guessMatches(" local train ", "Local train"));
assert.ok(guessMatches("LocalTrain", "Local train"));
assert.ok(!guessMatches("metro", "Local train"));
assert.ok(!guessMatches("", ""));
console.log("spyRules ok");
