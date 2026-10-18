import assert from "node:assert/strict";
import { newGame, roll, move, botPick, absOf, HOME } from "./ludoRules.js";

const set = (g, fn) => { const c = JSON.parse(JSON.stringify(g)); fn(c); return c; };

// Base needs a 6; anything else passes the turn.
let g = newGame(2);
let r = roll(g, 3);
assert.equal(r.passed, true);
assert.equal(r.game.turn, 1);
r = roll(g, 6);
assert.deepEqual(r.movable, [0, 1, 2, 3]);
r = move(r.game, 0);
assert.equal(r.to, 0);
assert.equal(r.extra, true, "a 6 rolls again");
assert.equal(r.game.turn, 0);

// Third six in a row forfeits.
g = set(newGame(2), (x) => { x.sixes = 2; x.players[0].tokens = [0, -1, -1, -1]; });
r = roll(g, 6);
assert.equal(r.forfeit, true);
assert.equal(r.game.turn, 1);

// Capture on a plain square sends the victim home and grants another roll.
// Red rel 5 = abs 5; yellow (color 2) rel 31 = abs (26+31)%52 = 5.
g = set(newGame(2), (x) => { x.players[0].tokens = [2, -1, -1, -1]; x.players[1].tokens = [31, -1, -1, -1]; });
assert.equal(absOf(2, 31), 5);
r = move(roll(g, 3).game, 0);
assert.deepEqual(r.captured, [{ seat: 1, token: 0 }]);
assert.equal(r.game.players[1].tokens[0], -1);
assert.equal(r.extra, true);

// No capture on a star (abs 8) or start square.
g = set(newGame(2), (x) => { x.players[0].tokens = [5, -1, -1, -1]; x.players[1].tokens = [34, -1, -1, -1]; });
assert.equal(absOf(2, 34), 8);
r = move(roll(g, 3).game, 0);
assert.equal(r.captured.length, 0);
assert.equal(r.game.turn, 1);

// Exact roll to reach home; reaching home grants another roll.
g = set(newGame(2), (x) => { x.players[0].tokens = [54, -1, -1, -1]; });
assert.equal(roll(g, 3).passed, true, "overshoot is not a move");
r = move(roll(g, 2).game, 0);
assert.equal(r.to, HOME);
assert.equal(r.extra, true);

// Last token home wins.
g = set(newGame(4), (x) => { x.players[0].tokens = [HOME, HOME, HOME, 55]; });
r = move(roll(g, 1).game, 3);
assert.equal(r.game.winner, 0);
assert.equal(r.game.phase, "over");
assert.throws(() => roll(r.game, 4));

// Home column is not capturable: yellow at red's abs-equivalent can't touch red rel 52.
g = set(newGame(2), (x) => { x.players[0].tokens = [52, -1, -1, -1]; });
assert.equal(absOf(0, 52), null);

// Bot: capture beats leaving base beats advancing.
g = set(newGame(2), (x) => { x.players[0].tokens = [-1, 20, 2, -1]; x.players[1].tokens = [31, -1, -1, -1]; });
let rg = roll(g, 6).game; // token 2: 2->8 star (no capture); token 1: 20->26 yellow start (safe)
assert.equal(botPick(rg), 0, "leave base on a 6 when nothing to capture");
g = set(newGame(2), (x) => { x.players[0].tokens = [-1, 20, 3, -1]; x.players[1].tokens = [35, -1, -1, -1]; });
rg = roll(g, 6).game; // yellow rel 35 = abs 9; red 3+6 = 9: capture
assert.equal(botPick(rg), 2, "capture first");
// Avoid stepping right in front of an opponent: yellow rel 40 = abs 14; red 15+2 = 17 is 3 ahead of it.
g = set(newGame(2), (x) => { x.players[0].tokens = [10, 15, -1, -1]; x.players[1].tokens = [40, -1, -1, -1]; });
rg = roll(g, 2).game;
assert.equal(absOf(2, 40), 14);
assert.equal(botPick(rg), 0, "don't land within reach of an opponent");

console.log("ludoRules ok");
