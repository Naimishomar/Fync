import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import PDFParser from "pdf2json";
import { GEMINI_MODEL_PRO } from '../../utils/geminiModel.js';
import redisClient from '../../utils/redis.js';
import { istDateKey } from '../../utils/eventTime.js';

dotenv.config({ quiet: true });

// Initialize the Official SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: GEMINI_MODEL_PRO });

export const uploadPDF = async (req, res) => {
    try {
        if (!req.file || !req.file.buffer) {
            return res.status(400).json({ error: "No PDF file uploaded" });
        }

        const pdfParser = new PDFParser(null, 1);

        pdfParser.on("pdfParser_dataError", errData => {
            console.error("Parser Error:", errData.parserError);
            if (!res.headersSent) res.status(500).json({ error: "Failed to parse PDF" });
        });

        pdfParser.on("pdfParser_dataReady", (pdfData) => {
            const rawText = pdfParser.getRawTextContent();
            const cleanText = decodeURIComponent(rawText)
                .replace(/\r\n/g, ' ')
                .replace(/\s+/g, ' ')
                .replace(/------------------/g, '')
                .trim();

            if (!res.headersSent) {
                res.status(200).json({ 
                    text: cleanText,
                    pageCount: pdfData?.Pages?.length || 0 
                });
            }
        });

        pdfParser.parseBuffer(req.file.buffer);
    } catch (error) {
        console.error("Internal Server Error:", error);
        res.status(500).json({ error: "Server-side extraction failed." });
    }
};

// Every call is a paid Gemini request, and the prompt is whatever the client
// sends, so both the number of calls and their size are bounded server-side.
const DAILY_AI_CALLS = 40;
const MAX_PDF_CHARS = 60_000;
const MAX_QUESTION_CHARS = 2_000;
const MAX_HISTORY_CHARS = 4_000;

/** True while this user has calls left today (IST). Fails open if Redis is down. */
const takeAiCall = async (userId) => {
    const key = `ai:study:${userId}:${istDateKey()}`;
    try {
        const used = await redisClient.incr(key);
        if (used === 1) await redisClient.expire(key, 2 * 86400);
        return used <= DAILY_AI_CALLS;
    } catch (err) {
        console.error("AI quota check failed, allowing:", err.message);
        return true;
    }
};

const clip = (v, max) => String(v ?? "").slice(0, max);

export const AiIntelligence = async (req, res) => {
    try {
        const { mode } = req.body;
        const pdfText = clip(req.body.pdfText, MAX_PDF_CHARS);
        const question = clip(req.body.question, MAX_QUESTION_CHARS);
        // Only well-formed turns, each bounded: this is replayed to Gemini.
        const history = (Array.isArray(req.body.history) ? req.body.history : [])
            .slice(-10)
            .filter((h) => h && (h.role === "user" || h.role === "model"))
            .map((h) => ({ role: h.role, parts: [{ text: clip(h.parts?.[0]?.text, MAX_HISTORY_CHARS) }] }));

        if (!pdfText) {
            return res.status(400).json({ error: "No PDF content provided." });
        }
        if (!(await takeAiCall(req.user.id))) {
            return res.status(429).json({ success: false, error: "Daily AI limit reached. Try again tomorrow." });
        }

        let systemPrompt = "You are a Fync Study Assistant. Use the PDF text provided to answer.";
        if (mode === 'QUESTIONS') {
            systemPrompt = "Based on this PDF, generate 5 highly important exam questions with brief answers. Format it professionally.";
        }

        // Initialize Chat with History (Limited to last 10 for performance/cost)
        // Gemini expects: { role: "user" | "model", parts: [{ text: "..." }] }
        const chatSession = model.startChat({
            history: history.slice(-10), // 🔥 Keep only last 10 messages
        });

        const fullPrompt = `Context from PDF: ${pdfText}\n\nInstruction: ${systemPrompt}\n\nUser Question: ${question || "Summarize this content"}`;

        console.log("🔹 Calling Gemini SDK with History...");

        const result = await chatSession.sendMessage(fullPrompt);
        const response = await result.response;
        const aiText = response.text();

        // Prepare updated history to send back
        const updatedHistory = [
            ...history,
            { role: "user", parts: [{ text: question || "Summarize" }] },
            { role: "model", parts: [{ text: aiText }] }
        ].slice(-10); // 🔥 Maintain the 10-message limit

        console.log("✅ AI Responded");
        res.json({ 
            answer: aiText, 
            history: updatedHistory 
        });

    } catch (error) {
        console.error("❌ AI ERROR:", error);
        res.status(500).json({ success: false, error: "The study assistant could not answer right now." });
    }
};