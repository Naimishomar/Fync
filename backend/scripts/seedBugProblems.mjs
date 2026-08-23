/**
 * Seeds bug missions from deepmind/code_contests (CC BY 4.0).
 *
 * Every row in that dataset carries real accepted submissions *and* real
 * rejected ones for the same problem, with the judge's test cases attached.
 * A rejected submission that sits one or two lines away from an accepted one is
 * exactly a bug mission: runnable, verifiably broken, and the fix is known.
 *
 * What this cannot do, stated plainly: there is no public dataset of buggy
 * React, Express, MongoDB or SQL with runnable tests, and utils/codeHarness.js
 * only builds harnesses for Python, JavaScript, C++ and Java. Those domains
 * exist in the schema and are unfilled; seeding them means authoring or
 * generating them, not scraping them.
 *
 *   node scripts/seedBugProblems.mjs --count=600
 *   node scripts/seedBugProblems.mjs --count=20 --dry
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import BugProblem from '../models/coding/bugProblem.model.js';
import { fetchRows } from './hfRows.mjs';

dotenv.config();

const DATASET = 'deepmind/code_contests';

// ClassLabel order for the solutions.language field.
const LANGS = { 1: 'python', 2: 'cpp', 3: 'python', 4: 'java' };

// A bug that spans more than this is a rewrite, not a bug hunt.
const MAX_DIFF_LINES = 3;
// Candidates compared per language per problem. The full lists run to hundreds
// of solutions each; pairing all of them is quadratic for no extra quality.
const SAMPLE = 20;
const MAX_CASES = 12;

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `=${d}`).split('=')[1];
const flag = (n) => process.argv.includes(`--${n}`);

const normalize = (code) =>
  code.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('//') && !l.startsWith('#'));

/**
 * How many lines changed between two versions.
 *
 * Taking the larger of the two one-sided counts, not their sum: a single
 * modified line shows up as one line missing from each side, and summing them
 * reports every one-line bug as a two-line bug — which pushed every genuinely
 * Easy mission up into Medium.
 */
function lineDiff(a, b) {
  const setA = new Set(a);
  const setB = new Set(b);
  const onlyInA = a.filter((l) => !setB.has(l)).length;
  const onlyInB = b.filter((l) => !setA.has(l)).length;
  return Math.max(onlyInA, onlyInB);
}

/**
 * Pair each rejected submission with the accepted one it most resembles.
 *
 * Rejected submissions in the wild are mostly noise — code that never compiled,
 * or a different approach abandoned halfway. Requiring a close accepted twin
 * filters both out: what survives is a working program with a small mistake in
 * it, which is the only kind worth handing a student.
 */
function pairBugs(row) {
  const correct = row.solutions ?? { language: [], solution: [] };
  const wrong = row.incorrect_solutions ?? { language: [], solution: [] };
  const out = [];

  for (const langId of new Set(wrong.language)) {
    const domain = LANGS[langId];
    if (!domain) continue;

    const good = correct.solution
      .filter((_, i) => correct.language[i] === langId)
      .slice(0, SAMPLE)
      .map((code) => ({ code, lines: normalize(code) }));
    if (!good.length) continue;

    const bad = wrong.solution.filter((_, i) => wrong.language[i] === langId).slice(0, SAMPLE);

    for (const code of bad) {
      const lines = normalize(code);
      if (lines.length < 4 || lines.length > 60) continue;

      let best = null;
      for (const g of good) {
        // Wildly different lengths cannot be a small bug; skipping them early
        // keeps this loop cheap.
        if (Math.abs(g.lines.length - lines.length) > MAX_DIFF_LINES) continue;
        const diff = lineDiff(lines, g.lines);
        if (diff >= 1 && (!best || diff < best.diff)) best = { diff, fix: g.code };
      }
      if (best && best.diff <= MAX_DIFF_LINES) {
        out.push({ domain, language: domain, buggyCode: code, fixedCode: best.fix, buggyLines: best.diff });
      }
    }
  }
  return out;
}

/**
 * Difficulty comes from how hard the bug is to *find*, not how hard the
 * original problem was: a one-line slip in a short program is an Easy bug even
 * when the problem is rated 2500.
 */
function difficultyOf(bug, rating) {
  if (bug.buggyLines === 1 && rating < 1600) return 'Easy';
  if (bug.buggyLines <= 2 && rating < 2100) return 'Medium';
  return 'Hard';
}

async function main() {
  const want = Number(arg('count', 200));
  const split = arg('split', 'train');
  const dry = flag('dry');
  const perProblem = Number(arg('per-problem', 3));

  if (!dry) await mongoose.connect(process.env.MONGO_URI ?? process.env.MONGODB_URI);

  let offset = Number(arg('offset', 0));
  let made = 0;
  const tally = {};

  while (made < want) {
    let page;
    try {
      page = await fetchRows({ dataset: DATASET, split, offset, length: 2 });
    } catch (err) {
      // Only a permanent failure lands here; transient ones were already
      // waited out. Stopping beats silently skipping the rest of the split.
      console.error(`  ${err.message} — stopping`);
      break;
    }
    if (!page.rows?.length) break;

    for (const { row, row_idx } of page.rows) {
      offset = row_idx + 1;

      const pub = row.public_tests ?? { input: [], output: [] };
      const priv = row.private_tests ?? { input: [], output: [] };
      const cases = [
        ...pub.input.map((input, i) => ({ input, expectedOutput: pub.output[i], isHidden: false })),
        ...priv.input.map((input, i) => ({ input, expectedOutput: priv.output[i], isHidden: true })),
        ...(row.generated_tests?.input ?? []).map((input, i) => ({
          input, expectedOutput: row.generated_tests.output[i], isHidden: true,
        })),
      ].filter((c) => c.input !== undefined && c.expectedOutput !== undefined).slice(0, MAX_CASES);

      // Without a visible case the student cannot tell a fixed program from a
      // still-broken one until they submit.
      if (!cases.some((c) => !c.isHidden) || cases.length < 2) continue;

      const rating = row.cf_rating || 1500;
      const bugs = pairBugs(row).slice(0, perProblem);

      for (const bug of bugs) {
        const difficulty = difficultyOf(bug, rating);
        tally[`${bug.domain}/${difficulty}`] = (tally[`${bug.domain}/${difficulty}`] ?? 0) + 1;

        if (dry) { made++; if (made >= want) break; continue; }

        const sourceUrl = `https://huggingface.co/datasets/${DATASET}/viewer/default/${split}?row=${row_idx}#${bug.domain}-${made}`;
        await BugProblem.create({
          title: `${row.name} — ${bug.domain} fix`,
          description: `${row.description}\n\nThe program below is a real rejected submission for this problem. It is close to correct: ${bug.buggyLines} line${bug.buggyLines === 1 ? '' : 's'} differ from a working version. Find the mistake and fix it.`,
          buggyCode: bug.buggyCode,
          fixedCode: bug.fixedCode,
          difficulty,
          language: bug.language,
          domain: bug.domain,
          buggyLines: bug.buggyLines,
          testCases: cases,
          points: { Easy: 50, Medium: 100, Hard: 150 }[difficulty],
          timeLimit: Math.round((row.time_limit?.seconds ?? 2) * 1000),
          source: 'code_contests',
          sourceUrl,
        });
        made++;
        if (made % 25 === 0) console.log(`  ${made}/${want}`);
        if (made >= want) break;
      }
      if (made >= want) break;
    }
  }

  console.log(`Done: ${made} bug missions. Next offset: ${offset}`);
  console.log(Object.entries(tally).sort().map(([k, v]) => `  ${k}: ${v}`).join('\n'));
  if (!dry) await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
