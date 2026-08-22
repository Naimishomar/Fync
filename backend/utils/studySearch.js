/**
 * PDF search for Fync Academy.
 *
 * Returns structured results so the app can draw its own list, instead of
 * showing a Google results page inside a WebView — which looked like Google
 * because it was Google.
 *
 * Both sources are keyless and open-access, so every link here is a PDF that is
 * legal to read and links directly rather than through a search page.
 */
import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";

const UA = "FyncApp/1.0 (+https://fync-api.duckdns.org)";
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_" });

export const resultId = (url) =>
  crypto.createHash("sha1").update(String(url)).digest("hex").slice(0, 24);

/**
 * OpenAlex indexes most of the scholarly record and reports where the free PDF
 * lives. Filtered to open access, so nothing returned sits behind a paywall.
 *
 * The mailto is not decoration — it puts the request in OpenAlex's polite pool,
 * which is faster and far less likely to be rate limited.
 */
async function openAlex(query, limit) {
  // title.search, not the general `search` parameter. The general one matches
  // full text, so "data structures and algorithms" led with a crystallography
  // paper — famous papers match almost anything loosely. Searching titles
  // returns what a student actually meant.
  //
  // Commas and pipes separate filters in OpenAlex's syntax, so they are
  // stripped rather than escaped; a query containing one would otherwise be
  // read as two filters and rejected.
  const safe = query.replace(/[,|:]/g, " ").replace(/\s+/g, " ").trim();

  const url =
    "https://api.openalex.org/works" +
    `?filter=open_access.is_oa:true,title.search:${encodeURIComponent(safe)}` +
    `&per-page=${limit}` +
    "&mailto=support@fync.app";

  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
  const data = await res.json();

  return (data.results ?? [])
    .filter((w) => w.best_oa_location?.pdf_url)
    .map((w) => ({
      id: resultId(w.best_oa_location.pdf_url),
      title: w.title ?? "Untitled",
      pdfUrl: w.best_oa_location.pdf_url,
      year: w.publication_year ?? null,
      authors: (w.authorships ?? []).slice(0, 3).map((a) => a.author?.display_name).filter(Boolean),
      source: w.primary_location?.source?.display_name ?? "Open Access",
      citations: w.cited_by_count ?? 0,
    }));
}

/** arXiv: preprints in CS, maths and physics — the closest thing to free
 *  textbook-depth material for the subjects students here are studying. */
async function arxiv(query, limit) {
  const url =
    "http://export.arxiv.org/api/query" +
    `?search_query=all:${encodeURIComponent(query)}` +
    `&max_results=${limit}&sortBy=relevance`;

  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(9000) });
  if (!res.ok) throw new Error(`arXiv ${res.status}`);
  const feed = parser.parse(await res.text());

  const entries = feed?.feed?.entry;
  const list = Array.isArray(entries) ? entries : entries ? [entries] : [];

  return list
    .map((e) => {
      const links = Array.isArray(e.link) ? e.link : [e.link].filter(Boolean);
      const pdf = links.find((l) => l?.["@_title"] === "pdf")?.["@_href"];
      if (!pdf) return null;

      const authors = Array.isArray(e.author) ? e.author : [e.author].filter(Boolean);
      return {
        id: resultId(pdf),
        title: String(e.title ?? "Untitled").replace(/\s+/g, " ").trim(),
        pdfUrl: pdf,
        year: e.published ? new Date(e.published).getFullYear() : null,
        authors: authors.slice(0, 3).map((a) => a?.name).filter(Boolean),
        source: "arXiv",
        citations: 0,
      };
    })
    .filter(Boolean);
}

/**
 * One dead source must not empty the results, so each is settled independently.
 */
export async function searchStudyPdfs(query, { limit = 20 } = {}) {
  const settled = await Promise.allSettled([
    openAlex(query, limit),
    arxiv(query, Math.ceil(limit / 2)),
  ]);

  const failures = settled.filter((r) => r.status === "rejected");
  if (failures.length === settled.length) {
    throw new Error(failures[0].reason?.message ?? "every search source failed");
  }

  const all = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

  // The same paper appears on arXiv and in OpenAlex under different URLs, so
  // duplicates are collapsed on the title rather than the link.
  const seen = new Set();
  const unique = all.filter((r) => {
    const key = r.title.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Source relevance order is preserved, not re-sorted by citations.
  //
  // Sorting globally by citation count looked sensible and was badly wrong: a
  // search for "operating systems" led with a crystallography paper, because
  // the most-cited papers in existence match almost any query loosely and then
  // dominate everything. Both APIs already rank by relevance to the query, so
  // the useful thing to do is interleave them rather than override them.
  const oa = unique.filter((r) => r.source !== "arXiv");
  const ax = unique.filter((r) => r.source === "arXiv");
  const merged = [];
  for (let i = 0; i < Math.max(oa.length, ax.length); i++) {
    if (oa[i]) merged.push(oa[i]);
    if (ax[i]) merged.push(ax[i]);
  }
  return merged;
}
