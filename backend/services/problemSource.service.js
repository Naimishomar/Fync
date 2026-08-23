import axios from 'axios';

/**
 * Pulls problems from public sources so an admin can pick one instead of
 * typing a statement and forty test cases into a form.
 *
 * What each source can actually give us (probed, not assumed):
 *  - LeetCode: public GraphQL endpoint. Full list, statement, sample cases,
 *    constraints and per-language starter code. No auth needed.
 *  - Codeforces: official API gives the problem *list* (name, tags, rating),
 *    but the statement page is behind Cloudflare and returns 403 to servers,
 *    so a Codeforces pick lands in the form with everything except the body.
 *
 * Nobody publishes hidden test cases. Every source here yields the samples
 * only, which is enough to author from and NOT enough to judge a contest on.
 */

const LEETCODE_GRAPHQL = 'https://leetcode.com/graphql';
const UA = 'Mozilla/5.0 (compatible; FyncArena/1.0)';

const LANG_MAP = { javascript: 'javascript', python3: 'python', cpp: 'cpp', java: 'java' };

/** Turn LeetCode's statement HTML into the plain text the arena UI renders. */
export function htmlToText(html = '') {
  return html
    .replace(/<sup>(.*?)<\/sup>/g, '^$1')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<\/(p|div|li|pre|ul|ol)>/g, '\n')
    .replace(/<li>/g, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * LeetCode writes an example input as a call signature — `nums = [2,7,11,15],
 * target = 9` — because it invokes a method. This judge runs whole programs
 * against stdin (see utils/codeHarness.js), so the arguments are unpacked onto
 * one line each and the parameter names dropped.
 *
 * The split only fires before `identifier =`, so commas inside an array or an
 * object literal stay where they are.
 */
export function toStdin(signature) {
  return signature
    .split(/,\s*(?=[A-Za-z_]\w*\s*=[^=])/)
    .map((part) => part.replace(/^\s*[A-Za-z_]\w*\s*=\s*/, '').trim())
    .filter((part) => part.length)
    .join('\n');
}

/**
 * Sample cases live inside the statement's <pre> blocks as
 * "Input: ... Output: ... Explanation: ...". There is no structured field for
 * them, so this reads them back out of the rendered example blocks.
 */
export function parseExamples(html = '') {
  const cases = [];
  for (const [, block] of html.matchAll(/<pre>([\s\S]*?)<\/pre>/g)) {
    const text = htmlToText(block);
    const input = text.match(/Input:\s*([\s\S]*?)(?=\n?\s*Output:|$)/i)?.[1]?.trim();
    const output = text.match(/Output:\s*([\s\S]*?)(?=\n?\s*Explanation:|$)/i)?.[1]?.trim();
    if (input && output !== undefined) {
      cases.push({ input: toStdin(input), expectedOutput: output, isHidden: false });
    }
  }
  return cases;
}

/** The <ul> that follows the Constraints heading, one bullet per entry. */
export function parseConstraints(html = '') {
  const list = html.split(/Constraints:?\s*<\/strong>/i)[1]?.match(/<ul>([\s\S]*?)<\/ul>/)?.[1];
  if (!list) return [];
  return [...list.matchAll(/<li>([\s\S]*?)<\/li>/g)].map(([, li]) => htmlToText(li)).filter(Boolean);
}

async function leetcodeQuery(query, variables) {
  const { data } = await axios.post(
    LEETCODE_GRAPHQL,
    { query, variables },
    { headers: { 'Content-Type': 'application/json', 'User-Agent': UA }, timeout: 15000 },
  );
  if (data.errors?.length) throw new Error(data.errors[0].message);
  return data.data;
}

async function searchLeetcode(q, difficulty, limit) {
  const filters = {};
  if (q) filters.searchKeywords = q;
  if (difficulty) filters.difficulty = difficulty.toUpperCase();
  const data = await leetcodeQuery(
    `query($c:String!,$l:Int!,$s:Int!,$f:QuestionListFilterInput){
       questionList(categorySlug:$c,limit:$l,skip:$s,filters:$f){
         total:totalNum
         data{questionFrontendId title titleSlug difficulty isPaidOnly topicTags{name}}
       }}`,
    { c: '', l: limit, s: 0, f: filters },
  );
  return (data.questionList?.data ?? [])
    // Premium statements are not returned by the API, so an import would create
    // an empty problem. Better to not offer them at all.
    .filter((q2) => !q2.isPaidOnly)
    .map((q2) => ({
      source: 'leetcode',
      id: q2.titleSlug,
      ref: `#${q2.questionFrontendId}`,
      title: q2.title,
      difficulty: q2.difficulty,
      tags: q2.topicTags.map((t) => t.name),
      url: `https://leetcode.com/problems/${q2.titleSlug}/`,
    }));
}

// The full Codeforces problemset is ~2MB and changes only when a contest ends,
// so it is fetched once per process and filtered in memory.
// ponytail: process-local cache, no TTL. Restart to refresh; move to Redis if
// this ever runs on more than one box and staleness starts to matter.
let cfCache = null;
async function codeforcesProblems() {
  if (!cfCache) {
    const { data } = await axios.get('https://codeforces.com/api/problemset.problems', { timeout: 20000 });
    if (data.status !== 'OK') throw new Error('Codeforces API unavailable');
    cfCache = data.result.problems.filter((p) => p.contestId && p.index);
  }
  return cfCache;
}

// Codeforces publishes a difficulty rating, not a label. These cut points are
// the usual Div. 2 A-B / C-D / E+ split.
const cfDifficulty = (rating) => (!rating ? 'Medium' : rating < 1200 ? 'Easy' : rating < 1900 ? 'Medium' : 'Hard');

async function searchCodeforces(q, difficulty, limit) {
  const needle = (q ?? '').toLowerCase();
  return (await codeforcesProblems())
    .filter((p) => (!needle || p.name.toLowerCase().includes(needle) || p.tags.some((t) => t.includes(needle))))
    .filter((p) => (!difficulty || cfDifficulty(p.rating) === difficulty))
    .slice(0, limit)
    .map((p) => ({
      source: 'codeforces',
      id: `${p.contestId}${p.index}`,
      ref: `${p.contestId}${p.index}`,
      title: p.name,
      difficulty: cfDifficulty(p.rating),
      tags: p.tags,
      rating: p.rating,
      url: `https://codeforces.com/problemset/problem/${p.contestId}/${p.index}`,
      // Surfaced so the picker can warn before the admin commits to a pick.
      statementAvailable: false,
    }));
}

export async function searchProblems({ source = 'leetcode', q = '', difficulty = '', limit = 25 }) {
  const capped = Math.min(Number(limit) || 25, 50);
  if (source === 'codeforces') return searchCodeforces(q, difficulty, capped);
  if (source === 'leetcode') return searchLeetcode(q, difficulty, capped);
  throw new Error(`Unknown source "${source}"`);
}

/**
 * Fetch one problem and shape it into the Problem model. Returns a draft, not
 * a saved document — the caller decides whether to persist it.
 */
export async function fetchProblem({ source, id }) {
  if (source === 'codeforces') {
    const found = (await codeforcesProblems()).find((p) => `${p.contestId}${p.index}` === id);
    if (!found) throw new Error('Problem not found on Codeforces');
    return {
      title: found.name,
      // Codeforces serves 403 to non-browser clients, so the body cannot be
      // fetched here. The admin pastes it from the link.
      description: `Statement: ${`https://codeforces.com/problemset/problem/${found.contestId}/${found.index}`}\n\n(Codeforces blocks server-side statement fetches — paste the statement and samples from the link above.)`,
      difficulty: cfDifficulty(found.rating),
      category: found.tags[0] ?? 'General',
      tags: found.tags,
      testCases: [],
      constraints: [],
      starterCode: {},
      source: 'codeforces',
      sourceUrl: `https://codeforces.com/problemset/problem/${found.contestId}/${found.index}`,
    };
  }

  if (source !== 'leetcode') throw new Error(`Unknown source "${source}"`);

  const data = await leetcodeQuery(
    `query($s:String!){question(titleSlug:$s){
       questionFrontendId title difficulty content topicTags{name} codeSnippets{langSlug code}
     }}`,
    { s: id },
  );
  const q = data.question;
  if (!q?.content) throw new Error('Problem not found, or its statement is premium-only');

  const starterCode = {};
  for (const snip of q.codeSnippets ?? []) {
    const key = LANG_MAP[snip.langSlug];
    if (key) starterCode[key] = snip.code;
  }

  const testCases = parseExamples(q.content);

  // The statement is written for a method call; the judge feeds stdin. Without
  // this line a solver has no way to know what their program will receive.
  const inputNote = testCases.length
    ? `\n\nInput format: each argument arrives on its own line of stdin, in the order shown in the examples. Print only the answer.`
    : '';

  return {
    title: q.title,
    description: htmlToText(q.content) + inputNote,
    difficulty: q.difficulty,
    category: q.topicTags?.[0]?.name ?? 'General',
    tags: (q.topicTags ?? []).map((t) => t.name),
    testCases,
    constraints: parseConstraints(q.content),
    starterCode,
    source: 'leetcode',
    sourceUrl: `https://leetcode.com/problems/${id}/`,
  };
}
