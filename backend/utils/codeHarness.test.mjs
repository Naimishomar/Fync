import assert from 'node:assert/strict';
import { buildHarness, parseHarnessOutput, LANGUAGE_IDS, languageOf, SENTINEL, SENTINEL_COMPILE } from './codeHarness.js';

const cases = [{ input: '2 3', expectedOutput: '5' }];

// Every supported language must produce a harness, or explicitly decline.
for (const lang of ['python', 'javascript', 'cpp']) {
  const h = buildHarness(lang, 'print(1)', cases);
  assert.ok(h && h.includes(SENTINEL), `${lang} harness must emit the sentinel`);
}
// Java can only be batched when the class can be renamed.
assert.ok(buildHarness('java', 'public class Main{}', cases));
assert.equal(buildHarness('java', 'class Other{}', cases), null, 'unrenameable java declines batching');
assert.equal(buildHarness('ruby', 'puts 1', cases), null, 'unknown language declines');

// The sentinel must survive the user printing freely, including printing
// something that looks like the sentinel.
const noisy = `garbage\n${SENTINEL}[{"passed":true}]`;
assert.deepEqual(parseHarnessOutput(noisy), [{ passed: true }]);
const spoof = `${SENTINEL}[{"passed":false}]\nreal\n${SENTINEL}[{"passed":true}]`;
assert.deepEqual(parseHarnessOutput(spoof), [{ passed: true }], 'the LAST sentinel wins, so user output cannot forge a pass');

// Compile errors take priority over any results line.
assert.deepEqual(parseHarnessOutput(`${SENTINEL_COMPILE}{"error":"bad syntax"}`), { compileError: 'bad syntax' });

// No sentinel at all means the process died — must be null, never a false pass.
assert.equal(parseHarnessOutput('just some output'), null);
assert.equal(parseHarnessOutput(''), null);
assert.equal(parseHarnessOutput(null), null);

// Malformed JSON must not throw.
assert.equal(parseHarnessOutput(`${SENTINEL}{not json`), null);

// Language id round trip.
assert.equal(languageOf(71), 'python');
assert.equal(languageOf('54'), 'cpp');
assert.equal(languageOf(9999), 'python', 'unknown id falls back rather than crashing');

// Test case data must be embedded, so a case cannot be skipped by the harness.
const py = buildHarness('python', 'x=1', [{ input: 'A', expectedOutput: 'B' }, { input: 'C', expectedOutput: 'D' }]);
assert.ok(py.includes('"in": "A"') || py.includes('"in":"A"'));
assert.ok(py.includes('"out": "D"') || py.includes('"out":"D"'));

console.log('codeHarness: all assertions passed');
