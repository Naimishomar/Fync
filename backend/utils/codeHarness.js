/**
 * Builds a single program that runs every test case in one execution.
 *
 * This is the difference between a feature that fits in a free judge and one
 * that does not. A problem with 40 test cases costs 40 submissions if each is
 * sent separately; wrapped this way it costs one, and the wall time is one
 * round trip instead of forty.
 *
 * Every harness prints one sentinel line and nothing else that matters, so the
 * caller can find its verdict even when the user's code has been printing
 * freely to stdout.
 */
export const SENTINEL = "__FYNC_RESULT__";
/** Emitted instead of results when the submission never compiles. */
export const SENTINEL_COMPILE = "__FYNC_COMPILE_ERROR__";

/** Judge0 CE language ids. */
export const LANGUAGE_IDS = {
  python: 71,
  javascript: 63,
  cpp: 54,
  java: 62,
};

/** The reverse map. The battle socket receives a Judge0 id from the client and
 *  needs the language name to pick a harness. */
export const languageOf = (id) =>
  Object.keys(LANGUAGE_IDS).find((k) => LANGUAGE_IDS[k] === Number(id)) ?? "python";

const jsonify = (cases) =>
  JSON.stringify(cases.map((c) => ({ in: String(c.input ?? ""), out: String(c.expectedOutput ?? "") })));

/**
 * Python: the user's program is compiled once and re-executed per case with
 * stdin swapped underneath it, so code written as a normal script still works.
 */
const pythonHarness = (userCode, cases) => `
import sys, io, json, traceback

__FYNC_CASES = json.loads(r'''${jsonify(cases)}''')
__FYNC_SRC = ${JSON.stringify(userCode)}
try:
    __FYNC_CODE = compile(__FYNC_SRC, "solution.py", "exec")
except SyntaxError as e:
    print("${SENTINEL_COMPILE}" + json.dumps({"error": "%s (line %s)" % (e.msg, e.lineno)}))
    sys.exit(0)

__FYNC_RESULTS = []

for __c in __FYNC_CASES:
    __real_stdin, __real_stdout = sys.stdin, sys.stdout
    sys.stdin = io.StringIO(__c["in"])
    sys.stdout = io.StringIO()
    try:
        exec(__FYNC_CODE, {"__name__": "__main__"})
        __got = sys.stdout.getvalue()
        __err = None
    except SystemExit:
        __got = sys.stdout.getvalue()
        __err = None
    except Exception:
        __got = sys.stdout.getvalue()
        __err = traceback.format_exc(limit=3)
    finally:
        sys.stdin, sys.stdout = __real_stdin, __real_stdout

    __FYNC_RESULTS.append({
        "got": __got.strip(),
        "expected": __c["out"].strip(),
        "passed": __err is None and __got.strip() == __c["out"].strip(),
        "error": __err,
    })

print("${SENTINEL}" + json.dumps(__FYNC_RESULTS))
`;

/**
 * JavaScript: stdout and the readline path are both intercepted, because a
 * student may read input either way.
 */
const jsHarness = (userCode, cases) => `
const __CASES = ${jsonify(cases)};
const __SRC = ${JSON.stringify(userCode)};
const __results = [];
const __realWrite = process.stdout.write.bind(process.stdout);

try {
  new Function(__SRC);
} catch (e) {
  __realWrite("${SENTINEL_COMPILE}" + JSON.stringify({ error: String(e.message) }) + "\\n");
  process.exit(0);
}

for (const c of __CASES) {
  let buf = "";
  process.stdout.write = (chunk) => { buf += chunk; return true; };
  let err = null;
  try {
    const lines = String(c.in).split("\\n");
    let i = 0;
    const readline = () => (i < lines.length ? lines[i++] : "");
    const fn = new Function("readline", "require", "console", "input",
      __SRC + "\\n//# sourceURL=solution.js");
    fn(readline, require, { log: (...a) => { buf += a.join(" ") + "\\n"; } }, String(c.in));
  } catch (e) {
    err = String(e && e.stack ? e.stack : e).split("\\n").slice(0, 3).join("\\n");
  } finally {
    process.stdout.write = __realWrite;
  }
  const got = buf.trim();
  __results.push({ got, expected: String(c.out).trim(), passed: !err && got === String(c.out).trim(), error: err });
}

__realWrite("${SENTINEL}" + JSON.stringify(__results) + "\\n");
`;

/**
 * C++: the user's main is renamed by the preprocessor so our own main can call
 * it once per case with cin rebound to that case's input. Without the rename
 * there would be two mains and the translation unit would not link.
 */
const cppHarness = (userCode, cases) => `
#include <bits/stdc++.h>
#define main __fync_user_main
${userCode}
#undef main

int main() {
    std::vector<std::pair<std::string,std::string>> cases = {
${cases.map((c) => `        {${JSON.stringify(String(c.input ?? ""))}, ${JSON.stringify(String(c.expectedOutput ?? ""))}}`).join(",\n")}
    };

    auto trim = [](std::string s) {
        size_t a = s.find_first_not_of(" \\n\\r\\t");
        if (a == std::string::npos) return std::string("");
        size_t b = s.find_last_not_of(" \\n\\r\\t");
        return s.substr(a, b - a + 1);
    };

    std::string out = "[";
    for (size_t i = 0; i < cases.size(); i++) {
        std::istringstream in(cases[i].first);
        std::ostringstream cap;
        auto *oldIn = std::cin.rdbuf(in.rdbuf());
        auto *oldOut = std::cout.rdbuf(cap.rdbuf());
        // Each case starts from a clean stream state; a previous case that read
        // past the end would otherwise leave cin failed for every case after it.
        std::cin.clear();
        __fync_user_main();
        std::cin.rdbuf(oldIn);
        std::cout.rdbuf(oldOut);

        std::string got = trim(cap.str()), exp = trim(cases[i].second);
        std::string esc;
        for (char ch : got) {
            if (ch == '"' || ch == '\\\\') { esc += '\\\\'; esc += ch; }
            else if (ch == '\\n') esc += "\\\\n";
            else if (ch >= 0 && ch < 32) continue;
            else esc += ch;
        }
        out += std::string(i ? "," : "") + "{\\"got\\":\\"" + esc + "\\",\\"passed\\":" + (got == exp ? "true" : "false") + "}";
    }
    out += "]";
    std::cout << "${SENTINEL}" << out << std::endl;
    return 0;
}
`;


/**
 * Java: Judge0 requires the public class to be called Main, so the user's class
 * is renamed and our own Main drives it, rebinding System.in and System.out per
 * case. Reflection is not needed — the renamed class is in the same file.
 */
const javaHarness = (userCode, cases) => {
  // If the user did not declare `public class Main` there is nothing to rename
  // safely, so batching is declined and the caller falls back to one run each.
  if (!/public\s+class\s+Main\b/.test(userCode)) return null;
  const renamed = userCode.replace(/public\s+class\s+Main\b/, "class __FyncUser");

  const rows = cases
    .map((c) => `        {${JSON.stringify(String(c.input ?? ""))}, ${JSON.stringify(String(c.expectedOutput ?? ""))}}`)
    .join(",\n");

  return `import java.io.*;
import java.util.*;

${renamed}

public class Main {
    public static void main(String[] args) throws Exception {
        String[][] cases = {
${rows}
        };
        InputStream realIn = System.in;
        PrintStream realOut = System.out;
        StringBuilder out = new StringBuilder("[");
        for (int i = 0; i < cases.length; i++) {
            ByteArrayOutputStream cap = new ByteArrayOutputStream();
            System.setIn(new ByteArrayInputStream(cases[i][0].getBytes()));
            System.setOut(new PrintStream(cap));
            boolean err = false;
            try { __FyncUser.main(new String[0]); }
            catch (Throwable t) { err = true; }
            finally { System.setIn(realIn); System.setOut(realOut); }
            String got = cap.toString().trim(), exp = cases[i][1].trim();
            out.append(i > 0 ? "," : "").append("{\\"got\\":").append(jsonStr(got))
               .append(",\\"passed\\":").append(!err && got.equals(exp)).append("}");
        }
        out.append("]");
        realOut.println("${SENTINEL}" + out);
    }
    static String jsonStr(String s) {
        StringBuilder b = new StringBuilder("\\"");
        for (char c : s.toCharArray()) {
            if (c == '"' || c == '\\\\') b.append('\\\\').append(c);
            else if (c == '\\n') b.append("\\\\n");
            else if (c < 32) continue;
            else b.append(c);
        }
        return b.append('"').toString();
    }
}`;
};

export function buildHarness(language, userCode, cases) {
  switch (language) {
    case "python": return pythonHarness(userCode, cases);
    case "javascript": return jsHarness(userCode, cases);
    case "cpp": return cppHarness(userCode, cases);
    case "java": return javaHarness(userCode, cases);
    default: return null;   // unknown language falls back to one run per case
  }
}

/**
 * Pull the verdict out, tolerating anything the user printed around it.
 *
 * Returns { compileError } when the program never compiled, an array of case
 * results when it ran, and null when neither marker is present — which means
 * the process died before reaching either.
 */
export function parseHarnessOutput(stdout) {
  if (!stdout) return null;

  const ce = stdout.lastIndexOf(SENTINEL_COMPILE);
  if (ce !== -1) {
    try {
      return { compileError: JSON.parse(stdout.slice(ce + SENTINEL_COMPILE.length).trim()).error };
    } catch {
      return { compileError: "Compilation failed" };
    }
  }

  const at = stdout.lastIndexOf(SENTINEL);
  if (at === -1) return null;
  try {
    return JSON.parse(stdout.slice(at + SENTINEL.length).trim());
  } catch {
    return null;
  }
}
