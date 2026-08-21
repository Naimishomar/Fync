import assert from 'node:assert';
// The parser is pure and has no imports, so it is lifted straight out of the
// TS source rather than adding a transpile step for one function.
// Run with: node components/utility/pdf/parsePageRanges.test.mjs
import { readFileSync } from 'node:fs';
const src = readFileSync(new URL('./pdfKit.ts', import.meta.url), 'utf8');
const i = src.indexOf('export function parsePageRanges');
let body = src.slice(i);
body = body.slice(0, body.indexOf('\n}\n') + 3)
  .replace('export function parsePageRanges(spec: string, pageCount: number): number[]',
           'function parsePageRanges(spec, pageCount)')
  .replace('const out = new Set<number>();', 'const out = new Set();');
const parsePageRanges = new Function(`${body}; return parsePageRanges;`)();
const eq = (spec, n, want, why) =>
  assert.deepStrictEqual(parsePageRanges(spec, n), want, `${why}: "${spec}" over ${n}p`);
eq('1-3', 10, [0,1,2], 'simple range');
eq('2', 10, [1], 'single page');
eq('1-3, 5, 8-', 10, [0,1,2,4,7,8,9], 'open-ended tail');
eq('-3', 10, [0,1,2], 'open-ended head');
eq('3,1,2', 10, [0,1,2], 'sorted + deduped');
eq('2,2,2', 10, [1], 'duplicates collapse');
eq('1-99', 10, [0,1,2,3,4,5,6,7,8,9], 'range clamped to page count');
eq(' 1 , 3 ', 10, [0,2], 'whitespace tolerated');
eq('', 10, [], 'empty spec');
eq('0', 10, [], 'page 0 rejected');
eq('11', 10, [], 'beyond end rejected');
eq('5-2', 10, [], 'reversed range rejected');
eq('abc', 10, [], 'garbage rejected');
eq('1-3;5', 10, [], 'wrong separator rejected');
console.log('parsePageRanges: all 14 cases pass');
