import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from 'dotenv';
import PDFParser from "pdf2json";

dotenv.config({ quiet: true });

// Initialize the Official SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

// ... existing imports

export const AiIntelligence = async (req, res) => {
    try {
        // 🔥 Now accepting 'history' from the request body
        const { pdfText, question, mode, history = [] } = req.body;

        if (!pdfText) {
            return res.status(400).json({ error: "No PDF content provided." });
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
        res.status(500).json({ success: false, error: error.message });
    }
};