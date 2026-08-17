// Run: node middlewares/mongoSanitize.test.js
// Verifies the injection vectors are actually closed, including req.query, which
// Express 5 exposes as a getter-only property.
import assert from 'node:assert/strict';
import http from 'node:http';
import express from 'express';
import { mongoSanitize } from './mongoSanitize.js';

const app = express();
app.use(express.json());
app.use(mongoSanitize());
app.post('/echo', (req, res) => res.json({ query: req.query, body: req.body }));

const server = http.createServer(app).listen(0);
await new Promise((r) => server.once('listening', r));
const base = `http://127.0.0.1:${server.address().port}`;

const res = await fetch(`${base}/echo?email[$ne]=x&name=ok&$where=evil`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    password: { $gt: '' },
    nested: [{ $function: 'evil' }],
    keep: 'me',
    __proto__: { polluted: true },
  }),
});
const { query, body } = await res.json();

// Express 5's default "simple" query parser does not build nested objects, so
// `email[$ne]=x` arrives as the literal key "email[$ne]" — harmless as a value.
// What matters is that a top-level operator key is removed from req.query at all,
// which is what the old middleware skipped entirely.
assert.equal(query.name, 'ok', 'benign query keys survive');
assert.equal(query.$where, undefined, 'top-level query operator must be stripped');

assert.deepEqual(body.password, {}, 'operator inside a body object must be stripped');
assert.deepEqual(body.nested, [{}], 'operators inside arrays must be stripped');
assert.equal(body.keep, 'me', 'benign body keys survive');
assert.equal({}.polluted, undefined, 'prototype must not be polluted');

server.close();
console.log('mongoSanitize: all checks passed ✅');
