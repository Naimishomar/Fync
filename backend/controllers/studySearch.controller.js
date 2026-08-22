/**
 * PDF search for Fync Academy, returned as data so the app can draw its own
 * list rather than embedding somebody else's results page.
 */
import { searchStudyPdfs } from "../utils/studySearch.js";

export const searchStudyMaterial = async (req, res) => {
  const query = String(req.query.q ?? "").trim();

  // Two characters matches most of the index and returns an arbitrary twenty of
  // it, which reads as "search is broken".
  if (query.length < 3) {
    return res.status(200).json({ success: true, results: [], query });
  }

  try {
    const results = await searchStudyPdfs(query, { limit: 20 });
    return res.status(200).json({ success: true, results, query });
  } catch (error) {
    console.error("Study search failed:", error.message);
    return res.status(502).json({ success: false, message: "Could not reach the search sources." });
  }
};
