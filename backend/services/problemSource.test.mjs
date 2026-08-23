import assert from 'node:assert/strict';
import { toStdin, parseExamples, parseConstraints, htmlToText } from './problemSource.service.js';

// Offline: the parsers are the only part worth pinning. The HTTP calls are the
// sources' problem, not ours.

// Commas inside a literal must not be mistaken for argument separators.
assert.equal(toStdin('nums = [2,7,11,15], target = 9'), '[2,7,11,15]\n9');
assert.equal(toStdin('grid = [[1,0],[0,1]], k = 2'), '[[1,0],[0,1]]\n2');
assert.equal(toStdin('s = "a,b"'), '"a,b"');
// An equality inside the value is not an argument boundary.
assert.equal(toStdin('n = 5, cond = a == b'), '5\na == b');
// Codeforces-style plain input passes through untouched.
assert.equal(toStdin('3 4'), '3 4');

const html = `<p>Do a thing.</p>
<pre>
<strong>Input:</strong> nums = [3,3], target = 6
<strong>Output:</strong> [0,1]
<strong>Explanation:</strong> because.
</pre>
<pre>
<strong>Input:</strong> nums = [1], target = 1
<strong>Output:</strong> []
</pre>
<p><strong>Constraints:</strong></p>
<ul><li><code>1 &lt;= n &lt;= 10<sup>4</sup></code></li><li>Only one answer.</li></ul>`;

const cases = parseExamples(html);
assert.equal(cases.length, 2);
assert.deepEqual(cases[0], { input: '[3,3]\n6', expectedOutput: '[0,1]', isHidden: false });
// An empty-array answer is a real expected output, not a missing one.
assert.equal(cases[1].expectedOutput, '[]');
// The explanation must not leak into the expected output.
assert.ok(!cases[0].expectedOutput.includes('because'));

assert.deepEqual(parseConstraints(html), ['1 <= n <= 10^4', 'Only one answer.']);

// Entities and superscripts survive as readable text, and no tags remain.
const text = htmlToText('<p>a &lt; b &amp; 10<sup>9</sup></p>');
assert.equal(text, 'a < b & 10^9');

console.log('problemSource: ok');
