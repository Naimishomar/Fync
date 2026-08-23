/**
 * Seeds the problem bank from deepmind/code_contests (CC BY 4.0), the only
 * public source that ships *hidden* test cases.
 *
 * LeetCode and Codeforces publish the samples printed in their statements and
 * nothing else, so a contest scored on an imported problem is a contest scored
 * on three visible cases — hardcode the outputs and you win. This dataset
 * carries the private and generated tests alongside each statement, which is
 * what makes a real contest possible.
 *
 * Everything in it is stdin/stdout competitive programming, so it matches the
 * judge harness (utils/codeHarness.js) with no argument reshaping.
 *
 * This is a seed, not a live search. Each row is ~1.5MB of solutions and test
 * data and the API ignores column projection, so pulling problems at request
 * time would mean tens of megabytes per admin keystroke. Run once, then pick
 * from the local bank like any other problem.
 *
 *   node scripts/seedOpenProblems.mjs --count=200
 *   node scripts/seedOpenProblems.mjs --count=50 --split=test --offset=0 --dry
 */
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Problem from '../models/coding/problem.model.js';
import { fetchRows } from './hfRows.mjs';

dotenv.config();

const DATASET = 'deepmind/code_contests';

// ClassLabel indices, in the order the dataset declares them.
const SOURCES = ['unknown', 'codechef', 'codeforces', 'hackerearth', 'codejam', 'atcoder', 'aizu'];

// Hidden cases are capped because every one of them runs on every submission.
// A hundred cases is a hundred executions per submit; twenty is enough to catch
// a wrong algorithm and keeps a contest's judge queue moving.
const MAX_HIDDEN = 20;

const arg = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};
const flag = (name) => process.argv.includes(`--${name}`);

/**
 * Codeforces ratings are the only calibrated difficulty in the set. Rows
 * without one (AtCoder, Aizu) fall back to the coarse EASY/MEDIUM/HARD label,
 * and rows with neither are treated as Medium rather than guessed at.
 */
function difficultyOf(row) {
  if (row.cf_rating > 0) return row.cf_rating < 1200 ? 'Easy' : row.cf_rating < 1900 ? 'Medium' : 'Hard';
  return { 1: 'Easy', 2: 'Medium', 3: 'Hard', 4: 'Hard', 5: 'Hard' }[row.difficulty] ?? 'Medium';
}

function toProblem(row, rowIdx, split) {
  const pub = row.public_tests ?? { input: [], output: [] };
  const priv = row.private_tests ?? { input: [], output: [] };
  const gen = row.generated_tests ?? { input: [], output: [] };

  const visible = pub.input.map((input, i) => ({
    input,
    expectedOutput: pub.output[i] ?? '',
    isHidden: false,
  }));

  // Private tests are the real ones from the original judge; generated tests
  // top them up when a problem has none. Both are hidden.
  const hidden = [...priv.input.map((input, i) => [input, priv.output[i]]),
                  ...gen.input.map((input, i) => [input, gen.output[i]])]
    .filter(([input, output]) => input !== undefined && output !== undefined)
    .slice(0, MAX_HIDDEN)
    .map(([input, expectedOutput]) => ({ input, expectedOutput, isHidden: true }));

  const tags = (row.cf_tags ?? []).filter(Boolean);
  const seconds = row.time_limit?.seconds ?? 2;

  return {
    title: row.name,
    description: row.description,
    difficulty: difficultyOf(row),
    category: tags[0] ?? SOURCES[row.source] ?? 'General',
    tags,
    testCases: [...visible, ...hidden],
    constraints: [],
    starterCode: {},
    // The dataset's own limits, not this app's defaults — a problem written for
    // a 4 second limit fails everything under a 2 second one.
    timeLimit: Math.round(seconds * 1000) || 2000,
    memoryLimit: Math.round((row.memory_limit_bytes || 268435456) / (1024 * 1024)),
    points: { Easy: 100, Medium: 200, Hard: 300 }[difficultyOf(row)],
    source: 'code_contests',
    sourceUrl: `https://huggingface.co/datasets/${DATASET}/viewer/default/${split}?row=${rowIdx}`,
  };
}

const fetchPage = (split, offset, length) => fetchRows({ dataset: DATASET, split, offset, length });

async function main() {
  const want = Number(arg('count', 100));
  const split = arg('split', 'train');
  const dry = flag('dry');
  // Rows are ~1.5MB each because the API ships every reference solution with
  // them, so pages stay small or the response times out.
  const PAGE = Number(arg('page', 3));

  if (!dry) {
    await mongoose.connect(process.env.MONGO_URI ?? process.env.MONGODB_URI);
  }

  let offset = Number(arg('offset', 0));
  let imported = 0;
  let skipped = 0;

  while (imported < want) {
    let page;
    try {
      page = await fetchPage(split, offset, Math.min(PAGE, want - imported + 2));
    } catch (err) {
      // fetchRows already backed off through the transient failures.
      console.error(`  ${err.message} — stopping`);
      break;
    }
    if (!page.rows?.length) break;

    for (const { row, row_idx } of page.rows) {
      offset = row_idx + 1;
      const draft = toProblem(row, row_idx, split);

      // A problem whose hidden cases are all empty strings judges everything as
      // correct, which is worse than not importing it.
      const usable = draft.testCases.filter((tc) => tc.input !== '' || tc.expectedOutput !== '');
      if (!draft.testCases.some((tc) => tc.isHidden) || usable.length < 2) {
        skipped++;
        continue;
      }
      if (!draft.testCases.some((tc) => !tc.isHidden)) {
        // Nothing for a solver to check against before submitting. Promote the
        // first hidden case rather than dropping the problem.
        draft.testCases[0].isHidden = false;
      }

      if (dry) {
        console.log(`  [dry] ${draft.difficulty.padEnd(6)} ${draft.testCases.length} cases  ${draft.title}`);
        imported++;
        continue;
      }

      const existing = await Problem.findOne({ sourceUrl: draft.sourceUrl });
      if (existing) { skipped++; continue; }

      await Problem.create(draft);
      imported++;
      if (imported % 10 === 0) console.log(`  ${imported}/${want} imported`);
      if (imported >= want) break;
    }
  }

  console.log(`Done: ${imported} imported, ${skipped} skipped. Next offset: ${offset}`);
  if (!dry) await mongoose.disconnect();
}

main().catch((err) => { console.error(err); process.exit(1); });
