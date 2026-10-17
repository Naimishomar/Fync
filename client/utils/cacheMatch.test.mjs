// Run: node utils/cacheMatch.test.mjs
import assert from "node:assert/strict";
import { cachedPathOf, isCacheBusted, isReadPost, pathMatches, relatedPrefixes } from "./cacheMatch.ts";

const P = "fync_cache_";
const base = "https://api.example.com/api/";
const key = (rel) => P + base.replace(/\/$/, "") + rel; // what axios.getUri produces

assert.equal(cachedPathOf(key("/post/feed?page=1"), P, base), "/post/feed?page=1");
assert.equal(cachedPathOf(P + "/user/profile", P, undefined), "/user/profile");

const stale = (rel, mutated) => pathMatches(cachedPathOf(key(rel), P, base), relatedPrefixes(mutated));
assert.ok(stale("/post/feed?page=1", "/post/like/123"));
assert.ok(stale("/user/profile", "/post/create"));
assert.ok(stale("/shorts?page=2", "/user/update?x=1"));
assert.ok(stale("/marketplace", "/marketplace/item/9"));
assert.ok(!stale("/marketplace", "/post/like/1"));
assert.ok(!stale("/postal", "/post/like/1"));

assert.ok(isReadPost("/post/smart-feed?page=1&limit=10"));
assert.ok(isReadPost("/batch"));
assert.ok(!isReadPost("/post/create"));

assert.ok(isCacheBusted(`/comments/1?t=${Date.now()}`));
assert.ok(isCacheBusted(`/x?a=1&t=${Date.now()}`));
assert.ok(!isCacheBusted("/x?type=1"));
console.log("cacheMatch ok");
