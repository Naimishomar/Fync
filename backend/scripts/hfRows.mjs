/**
 * Reads pages from the HuggingFace datasets-server.
 *
 * The endpoint rate-limits anonymous callers, and a 429 has to be waited out,
 * not stepped over: the seeders used to advance the offset on any error, so one
 * burst of 429s silently skipped thousands of rows and imported nothing while
 * reporting no failure.
 */
const API = 'https://datasets-server.huggingface.co/rows';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Anonymous callers are rate-limited hard enough that a full seeding run will
// not finish. A free read token from huggingface.co/settings/tokens lifts it.
const headers = process.env.HF_TOKEN ? { Authorization: `Bearer ${process.env.HF_TOKEN}` } : {};

export async function fetchRows({ dataset, split, offset, length, attempts = 6 }) {
  const url = `${API}?dataset=${encodeURIComponent(dataset)}&config=default&split=${split}&offset=${offset}&length=${length}`;

  for (let attempt = 0; attempt < attempts; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers });
    } catch (err) {
      // Network blip: same treatment as a 5xx.
      await sleep(2000 * 2 ** attempt);
      continue;
    }

    if (res.ok) return res.json();

    // 429 and 5xx are worth waiting for; a 4xx means this request will never
    // work and retrying it just wastes the run.
    if (res.status !== 429 && res.status < 500) {
      throw new Error(`HTTP ${res.status} at offset ${offset}`);
    }

    const retryAfter = Number(res.headers.get('retry-after'));
    const wait = retryAfter ? retryAfter * 1000 : Math.min(60000, 3000 * 2 ** attempt);
    console.log(`  rate limited at offset ${offset}, waiting ${Math.round(wait / 1000)}s`);
    await sleep(wait);
  }

  throw new Error(`gave up on offset ${offset} after ${attempts} attempts`);
}
