import express from 'express';
import { IncomingMessage } from 'node:http';

/**
 * Batch endpoint: many GETs, one HTTP request.
 *
 * A screen here typically fires 2-9 requests the moment it mounts (the admin
 * portal fires 23). Each one pays the full per-request cost: HTTP parse, rate
 * limiter, a JWT verify, an auth cache lookup, routing, monitoring, compression.
 * On a box with 0.2 of a vCPU sustained, that fixed overhead is a real fraction
 * of the work. Collapsing a six-request screen into one call removes five sixths
 * of it.
 *
 * HOW IT WORKS
 *
 * Sub-requests are dispatched back through the app's own router with
 * `app.handle()`. That matters: it means every sub-request still passes through
 * authMiddleware, the rate limiter, the response cache and every route guard,
 * exactly as if it had arrived over the wire. Nothing here re-implements auth,
 * so nothing here can get auth wrong.
 *
 * WHAT IT DELIBERATELY DOES NOT DO
 *
 * GET only. Batching mutations sounds convenient and is a trap: a client that
 * retries a half-applied batch double-charges someone. Writes stay one request,
 * one outcome.
 *
 * One slow sub-request delays the whole response (head-of-line blocking), so
 * this is for the small, fast reads a screen needs to paint -- not for the feed
 * page that takes 300ms. Each sub-request is timed out independently so one
 * stuck route degrades to a single failed entry rather than hanging the batch.
 */

const router = express.Router();

/** Enough for the busiest screen, low enough that one request cannot fan out into a flood. */
const MAX_SUB_REQUESTS = 12;

/** A sub-request that outlives this returns 504 on its own; the rest still land. */
const SUB_REQUEST_TIMEOUT_MS = 8000;

/** Routes that must never be reachable through a batch. */
const DENY_PREFIXES = ['/batch', '/health', '/socket.io'];

const isAllowedPath = (path) =>
  typeof path === 'string' &&
  path.startsWith('/') &&
  // No protocol-relative or absolute URLs: this must not become an SSRF gadget
  // that fetches arbitrary hosts through the server's own credentials.
  !path.startsWith('//') &&
  !path.includes('://') &&
  !DENY_PREFIXES.some((p) => path === p || path.startsWith(p + '/'));

/**
 * Runs one path through the real Express app and captures what it wrote.
 *
 * The fake response object implements only what Express and the app's own
 * middleware touch; anything unexpected surfaces as a failed sub-request rather
 * than a corrupted one.
 */
const dispatch = (app, req, path) =>
  new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(
      () => finish({ status: 504, body: { success: false, message: 'Sub-request timed out' } }),
      SUB_REQUEST_TIMEOUT_MS
    );

    // Express's `app.handle` calls `Object.setPrototypeOf(req, this.request)`
    // (application.js:169), which severs any prototype chain we set up here.
    // Own properties survive that, inherited ones do not -- so everything the
    // sub-request needs is copied explicitly rather than inherited. An earlier
    // version used Object.create(req) and silently lost the Authorization
    // header and the resolved user.
    const subReq = Object.create(IncomingMessage.prototype);

    // Connection identity, so `req.ip` and `trust proxy` resolve the same way
    // they would for a request that arrived on its own.
    subReq.socket = req.socket;
    subReq.connection = req.socket;
    subReq.httpVersion = req.httpVersion;
    subReq.httpVersionMajor = req.httpVersionMajor;
    subReq.httpVersionMinor = req.httpVersionMinor;
    subReq.complete = true;
    subReq.app = app;

    // The batch envelope was a POST with a JSON body. A sub-request is a GET
    // with none, so the body headers must not travel with it -- body-parser
    // would otherwise try to read a stream this object does not have.
    const subHeaders = { ...req.headers };
    delete subHeaders['content-type'];
    delete subHeaders['content-length'];
    delete subHeaders['transfer-encoding'];
    subReq.headers = subHeaders;
    subReq.rawHeaders = req.rawHeaders;

    subReq.method = 'GET';
    subReq.url = path;
    subReq.originalUrl = path;
    subReq.baseUrl = '';
    subReq.params = {};
    subReq.body = {};
    // Express's convention for "the body is already resolved, do not read the
    // stream". Belt and braces alongside stripping content-type above.
    subReq._body = true;

    // Work already done for this caller on the outer request. This is the real
    // server-side saving: a six-endpoint batch verifies one JWT and resolves
    // the user once, instead of six times.
    subReq.verifiedJwt = req.verifiedJwt;
    subReq.authUser = req.authUser;
    subReq.user = req.user;

    const headers = {};
    let statusCode = 200;
    let payload;

    const subRes = {
      req: subReq,
      locals: {},
      headersSent: false,
      statusCode: 200,
      status(code) { statusCode = code; this.statusCode = code; return this; },
      set(field, value) { headers[String(field).toLowerCase()] = value; return this; },
      setHeader(field, value) { headers[String(field).toLowerCase()] = value; return this; },
      getHeader(field) { return headers[String(field).toLowerCase()]; },
      removeHeader(field) { delete headers[String(field).toLowerCase()]; return this; },
      getHeaders() { return headers; },
      vary() { return this; },
      type() { return this; },
      json(data) { payload = data; finish({ status: statusCode, body: data }); return this; },
      send(data) { payload = data; finish({ status: statusCode, body: data }); return this; },
      end(data) {
        finish({ status: statusCode, body: payload ?? (data ? String(data) : null) });
        return this;
      },
      // Anything that tries to stream or redirect is not batchable.
      redirect() {
        finish({ status: 400, body: { success: false, message: 'Redirects are not batchable' } });
        return this;
      },
      on() { return this; },
      once() { return this; },
      emit() { return false; },
      removeListener() { return this; },
      writeHead(code) { statusCode = code; this.statusCode = code; return this; },
      write() { return true; },
    };

    subReq.res = subRes;

    try {
      app.handle(subReq, subRes, (err) => {
        if (err) {
          console.error('Batch sub-request error:', path, err.message);
          return finish({ status: 500, body: { success: false, message: 'Sub-request failed' } });
        }
        finish({ status: 404, body: { success: false, message: 'Not found' } });
      });
    } catch (err) {
      console.error('Batch dispatch threw:', path, err.message);
      finish({ status: 500, body: { success: false, message: 'Sub-request failed' } });
    }
  });

/**
 * POST /batch
 *   { "requests": [ { "key": "badges", "path": "/notifications/count" }, ... ] }
 *
 * Always 200 with a per-key result; a failing sub-request is data, not an error,
 * so one bad path does not discard the rest of the screen's payload.
 */
router.post('/', async (req, res) => {
  const requests = Array.isArray(req.body?.requests) ? req.body.requests : null;

  if (!requests || requests.length === 0) {
    return res.status(400).json({ success: false, message: 'requests[] is required' });
  }
  if (requests.length > MAX_SUB_REQUESTS) {
    return res.status(400).json({
      success: false,
      message: `A batch may contain at most ${MAX_SUB_REQUESTS} requests`,
    });
  }

  const app = req.app;

  const results = await Promise.all(
    requests.map(async (entry, index) => {
      const key = entry?.key || String(index);
      const path = entry?.path;

      if (!isAllowedPath(path)) {
        return [key, { status: 400, body: { success: false, message: 'Invalid path' } }];
      }
      const result = await dispatch(app, req, path);
      return [key, result];
    })
  );

  return res.status(200).json({
    success: true,
    results: Object.fromEntries(results),
  });
});

export default router;
