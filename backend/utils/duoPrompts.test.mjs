import assert from "node:assert/strict";
import { DUO_GAMES, pickPrompts, isMatch, isDuoGame } from "./duoPrompts.js";

for (const game of Object.keys(DUO_GAMES)) {
    const picked = pickPrompts(game);
    assert.equal(picked.length, DUO_GAMES[game].rounds, `${game} round count`);
    assert.equal(new Set(picked.map(String)).size, picked.length, `${game} no repeats`);
    assert.ok(picked.every((p) => p.length === 2), `${game} two options each`);
}
assert.equal(isMatch({ a: 1, b: 1 }, ["a", "b"]), true);
assert.equal(isMatch({ a: 0, b: 1 }, ["a", "b"]), false);
assert.equal(isMatch({ a: 0 }, ["a", "b"]), false, "a missed pick is never a match");
assert.equal(isDuoGame("toString"), false);
console.log("duoPrompts ok");
