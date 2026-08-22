/**
 * Code execution for the Coding Arena.
 *
 * Three things make this survive a contest start rather than a demo:
 *
 *  1. Every test case for a submission runs in ONE execution (see codeHarness).
 *     A 40-case problem costs one judge request, not forty.
 *  2. Verdicts are cached on a hash of (language, code, problem). In a contest
 *     a large share of submissions are byte-identical resubmissions and near
 *     identical answers between students; those cost nothing.
 *  3. Outbound requests are capped by a semaphore. The judge is the scarce
 *     resource, so 2,000 students waiting is fine and 2,000 simultaneous
 *     requests is not — the queue is what turns the second into the first.
 */
import crypto from "crypto";
import redisClient from "../utils/redis.js";
import { buildHarness, parseHarnessOutput, LANGUAGE_IDS } from "../utils/codeHarness.js";

// Self-hosted first when configured — it is free, unmetered and has no third
// party in the path. The community instance is the fallback, not the plan.
const PROVIDERS = [
  process.env.JUDGE0_SELF_HOSTED_URL,
  process.env.JUDGE0_URL,
  "https://ce.judge0.com",
].filter(Boolean);

const VERDICT_TTL_SECONDS = 86400;
const REQUEST_TIMEOUT_MS = 30000;

// Concurrency the judge is allowed to see at once. Sized for the community
// instance; raise it once a self-hosted judge is doing the work.
const MAX_INFLIGHT = Number(process.env.JUDGE0_MAX_INFLIGHT ?? 8);

let inflight = 0;
const waiting = [];
// Outbound executions actually sent to a judge. Exposed so a contest can be
// watched in real time and so load tests measure the real number rather than
// the number of students.
let executions = 0;

/**
 * A plain semaphore rather than a job queue.
 *
 * BullMQ would move the work to another process, which is the right shape for
 * long jobs; these are one-second HTTP calls whose result a socket is waiting
 * on, so the round trip through Redis would cost more than it saves. What
 * matters is that only MAX_INFLIGHT leave the box at once.
 */
function acquire() {
  if (inflight < MAX_INFLIGHT) {
    inflight += 1;
    return Promise.resolve();
  }
  return new Promise((resolve) => waiting.push(resolve));
}

function release() {
  const next = waiting.shift();
  if (next) next();
  else inflight -= 1;
}

export const queueDepth = () => ({ inflight, waiting: waiting.length, coalesced: pending.size, executions });

/**
 * Identical submissions in flight share one judge request.
 *
 * The cache alone does not survive a contest start: 2,000 students submitting
 * at the same second all miss it, because the first write has not landed when
 * the last one checks. Without this the queue takes 2,000 judge requests to
 * answer what is really a handful of distinct programs — measured at over two
 * minutes for a run that finishes in seconds once they are coalesced.
 */
const pending = new Map();

function singleFlight(key, work) {
  const existing = pending.get(key);
  if (existing) return existing;

  const p = work().finally(() => pending.delete(key));
  pending.set(key, p);
  return p;
}

const verdictKey = (language, code, problemId) =>
  "arena:verdict:" +
  crypto.createHash("sha256").update(`${language}|${problemId}|${code}`).digest("hex").slice(0, 32);

/**
 * Post one submission, trying each provider in turn.
 *
 * A provider that is down or rate limiting must not fail the submission while
 * another one would have answered it.
 */
async function execute(sourceCode, languageId, cpuTimeLimit) {
  let lastError = null;
  executions += 1;

  for (const base of PROVIDERS) {
    try {
      await acquire();
      try {
        // base64 throughout, not just for tidiness: the judge rejects any
        // payload it cannot read as UTF-8, and student code routinely carries
        // unicode — comments in Hindi, emoji, smart quotes pasted from a doc.
        // The C++ harness alone was enough to trip it.
        const res = await fetch(`${base}/submissions?base64_encoded=true&wait=true`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            // Only sent when the provider is RapidAPI; harmless otherwise.
            ...(base.includes("rapidapi") && process.env.RAPIDAPI_KEY
              ? { "x-rapidapi-key": process.env.RAPIDAPI_KEY, "x-rapidapi-host": process.env.RAPIDAPI_HOST }
              : {}),
          },
          body: JSON.stringify({
            source_code: Buffer.from(sourceCode, "utf8").toString("base64"),
            language_id: languageId,
            cpu_time_limit: cpuTimeLimit,
            memory_limit: 256000,
          }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });

        if (!res.ok) throw new Error(`${base} responded ${res.status}`);

        const data = await res.json();
        const decode = (v) => (v ? Buffer.from(v, "base64").toString("utf8") : null);
        return {
          ...data,
          stdout: decode(data.stdout),
          stderr: decode(data.stderr),
          compile_output: decode(data.compile_output),
        };
      } finally {
        release();
      }
    } catch (err) {
      lastError = err;
      console.error(`Judge provider failed (${base}):`, err.message);
    }
  }

  throw new Error(lastError?.message ?? "no judge provider available");
}

/**
 * Run a submission against every test case and return a verdict.
 *
 * `cases` is the full set including hidden ones — hiding happens when the
 * result is sent to the client, not here.
 */
export async function runSubmission({
  language,
  code,
  cases,
  problemId = "adhoc",
  timeLimitMs = 2000,
  useCache = true,
}) {
  const languageId = LANGUAGE_IDS[language];
  if (!languageId) throw new Error(`Unsupported language: ${language}`);
  if (!Array.isArray(cases) || !cases.length) throw new Error("No test cases");

  const key = verdictKey(language, code, problemId);

  if (useCache) {
    try {
      const hit = await redisClient.get(key);
      if (hit) return { ...JSON.parse(hit), cached: true };
    } catch (err) {
      console.error("Verdict cache read failed:", err.message);
    }
  }

  return singleFlight(key, () => judge(key, { language, languageId, code, cases, timeLimitMs, useCache }));
}

async function judge(key, { language, languageId, code, cases, timeLimitMs, useCache }) {
  // CPU budget covers every case in the batch, plus headroom for start-up.
  const cpuTimeLimit = Math.min(15, Math.max(2, (timeLimitMs / 1000) * cases.length + 2));

  const harness = buildHarness(language, code, cases);
  let verdict;

  if (harness) {
    const raw = await execute(harness, languageId, cpuTimeLimit);
    const parsed = parseHarnessOutput(raw.stdout);

    if (!parsed) {
      // No sentinel means the program never reached the end: a compile error, a
      // crash before the loop, or a timeout. All are real verdicts, not bugs.
      verdict = {
        status: raw.compile_output ? "Compilation Error"
          : raw.status?.description === "Time Limit Exceeded" ? "Time Limit Exceeded"
          : "Runtime Error",
        passed: 0,
        total: cases.length,
        results: [],
        message: (raw.compile_output || raw.stderr || raw.status?.description || "Execution failed").slice(0, 2000),
        time: Number(raw.time ?? 0),
        memory: Number(raw.memory ?? 0),
      };
    } else if (parsed.compileError) {
      verdict = {
        status: "Compilation Error",
        passed: 0,
        total: cases.length,
        results: [],
        message: String(parsed.compileError).slice(0, 2000),
        time: Number(raw.time ?? 0),
        memory: Number(raw.memory ?? 0),
      };
    } else {
      const passed = parsed.filter((r) => r.passed).length;
      const errored = parsed.filter((r) => r.error).length;
      verdict = {
        // Every case throwing is a broken program, not a wrong answer, and
        // telling a student "Wrong Answer" for a crash sends them looking in
        // the wrong place entirely.
        status: passed === cases.length ? "Accepted"
          : errored === cases.length ? "Runtime Error"
          : "Wrong Answer",
        passed,
        total: cases.length,
        results: parsed,
        message: null,
        time: Number(raw.time ?? 0),
        memory: Number(raw.memory ?? 0),
      };
    }
  } else {
    // No harness for this language shape — fall back to one run per case, still
    // through the same semaphore so it cannot flood the judge.
    const runs = await Promise.all(
      cases.map(async (c) => {
        const raw = await execute(code, languageId, Math.max(2, timeLimitMs / 1000));
        const got = String(raw.stdout ?? "").trim();
        const expected = String(c.expectedOutput ?? "").trim();
        return { got, expected, passed: got === expected, error: raw.stderr || raw.compile_output || null };
      }),
    );
    const passed = runs.filter((r) => r.passed).length;
    verdict = {
      status: passed === cases.length ? "Accepted" : "Wrong Answer",
      passed,
      total: cases.length,
      results: runs,
      message: null,
      time: 0,
      memory: 0,
    };
  }

  if (useCache) {
    redisClient.setEx(key, VERDICT_TTL_SECONDS, JSON.stringify(verdict)).catch(() => {});
  }

  return { ...verdict, cached: false };
}

export default { runSubmission, queueDepth };
