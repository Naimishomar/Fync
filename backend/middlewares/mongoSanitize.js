// Custom MongoDB sanitization middleware for Express 5 compatibility.
// express-mongo-sanitize is incompatible with Express 5 (req.query is getter-only).
//
// Two things the previous version got wrong:
//  1. It skipped req.query entirely, which is *the* NoSQL injection vector
//     (`?$where=...`). Express 5 defines req.query as a re-parsing getter on the
//     prototype, so neither assignment nor in-place deletion sticks — we shadow
//     it with an own data property holding the scrubbed object.
//  2. It used a hand-maintained allow/deny list of operators, so anything not on
//     it ($function, $lookup, $accumulator, $geoWithin, ...) sailed through.
//     Any key starting with `$` is an operator; test the prefix instead.
//
// Mutating in place also drops the per-request deep clone of every body.

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isForbidden = (key) => key.charCodeAt(0) === 36 /* $ */ || FORBIDDEN_KEYS.has(key);

function scrub(obj, depth = 0) {
  // Bound the walk: a deeply nested body should not be able to blow the stack.
  if (depth > 20 || obj === null || typeof obj !== 'object') return;

  if (Array.isArray(obj)) {
    for (const item of obj) scrub(item, depth + 1);
    return;
  }

  for (const key of Object.keys(obj)) {
    if (isForbidden(key)) {
      delete obj[key];
      continue;
    }
    scrub(obj[key], depth + 1);
  }
}

export const mongoSanitize = () => (req, res, next) => {
  try {
    scrub(req.body);
    scrub(req.params);

    // req.query is a getter that re-parses on every read, so scrubbing the value
    // it hands back changes nothing. Take one snapshot, scrub it, and pin it to
    // the request as an own property that shadows the getter.
    const query = req.query;
    if (query && typeof query === 'object') {
      scrub(query);
      Object.defineProperty(req, 'query', {
        value: query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
  } catch (err) {
    console.warn('Mongo sanitize error:', err.message);
  }
  next();
};

export default mongoSanitize;
