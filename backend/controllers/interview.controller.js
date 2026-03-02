import { GoogleGenAI } from "@google/genai"; 
import InterviewSession from '../models/interview.model.js'; 
import { cloudinary } from '../utils/cloudinary.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { PDFParse } = require('pdf-parse');
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const startInterview = async (req, res) => {
    try {
        console.log("🔹 Request received at /start");

        const { domain, experience, duration } = req.body;
        
        if (!req.file) {
            return res.status(400).json({ message: "Resume file is required." });
        }

        let resumeText = "";
        try {
            console.log("🔹 processing PDF with PDFParse V2...");
            const parser = new PDFParse({ url: req.file.path });
            const pdfResult = await parser.getText();
            resumeText = pdfResult.text.substring(0, 3000); 
            console.log("✅ PDF Parsed successfully");

        } catch (pdfError) {
            console.error("⚠️ PDF Parsing Failed:", pdfError.message);
            resumeText = `Candidate applying for ${domain} with ${experience} years experience.`;
        }
        const systemPrompt = `You are a technical interviewer for a ${domain} role. 
        Candidate Exp: ${experience} years.
        Resume Context: ${resumeText}.
        
        Start by introducing yourself and your name is "Laura" and asking the first technical question. 
        Keep it concise (2 sentences max).

        If the interviewer is not answering correctly then you must tell them that they are not answering correctly.
        
        If you do not heard the candidate correctly, then you must tell them that you are not hearing them and ask them to give the answer again.

        If the candidate unable to hear you and he/she asks you to repeat the question, then you must repeat the question again.
        `;

        console.log("🔹 Calling Gemini 2.5...");
        
        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: systemPrompt,
        });

        const firstQuestion = result.text;
        console.log("✅ Gemini Responded");

        const session = await InterviewSession.create({
            user: req.user.id,
            domain,
            resumeText,
            resumePublicId: req.file.filename,
            history: [
                { role: "user", parts: [{ text: systemPrompt }] },
                { role: "model", parts: [{ text: firstQuestion }] }
            ],
            duration: parseInt(duration),
            status: 'active'
        });

        res.json({ success: true, sessionId: session._id, question: firstQuestion });

    } catch (error) {
        console.error("❌ START ERROR:", error);
        res.status(500).json({ success: false, message: "Server error", error: error.message });
    }
};

export const processAnswer = async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await InterviewSession.findById(sessionId);

        if (!req.file) return res.status(400).json({ message: "Audio required" });

        session.audioPublicIds.push(req.file.filename);
        session.history.push({ role: "user", parts: [{ text: "(User answered verbally)" }] });

        const contextPrompt = `
        Context: The candidate just answered the previous question verbally. 
        Previous Question: ${session.history[session.history.length - 2]?.parts[0]?.text}
        
        Task: Acknowledge the answer briefly and ask the next relevant technical question.
        `;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash", 
            contents: contextPrompt,
        });

        const aiResponse = result.text;

        session.history.push({ role: "model", parts: [{ text: aiResponse }] });
        await session.save();

        res.json({ success: true, text: aiResponse });

    } catch (error) {
        console.error("❌ PROCESS ERROR:", error);
        res.status(500).json({ success: false, message: "Error processing answer" });
    }
};

export const endInterview = async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await InterviewSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({ success: false, message: "Session not found" });
        }

        const reportPrompt = `
        The interview is over. Based on this history: ${JSON.stringify(session.history)}
        
        Generate a JSON report with these exact keys: 
        - technical_score (0-10)
        - communication_score (0-10)
        - strengths (array of strings)
        - improvements (array of strings)
        - verdict (String: Must be exactly "Pass" or "Fail") 
        - summary (String)
        
        If insufficient data, default verdict to "Fail".
        Output ONLY valid JSON.
        `;

        const result = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: reportPrompt
        });

        let reportText = result.text.replace(/```json|```/g, '').trim();
        const report = JSON.parse(reportText);
        try {
            if (session.audioPublicIds && session.audioPublicIds.length > 0) {
                await cloudinary.api.delete_resources(session.audioPublicIds, { resource_type: 'raw' });
                await cloudinary.api.delete_resources(session.audioPublicIds, { resource_type: 'video' });
            }
            if (session.resumePublicId) {
                await cloudinary.api.delete_resources([session.resumePublicId], { resource_type: 'raw' });
                await cloudinary.api.delete_resources([session.resumePublicId], { resource_type: 'image' });
            }
            console.log("✅ Cloudinary files deleted successfully.");
        } catch (e) { 
            console.log("⚠️ Cloudinary cleanup warning:", e.message); 
        }
        await InterviewSession.findByIdAndDelete(sessionId);
        console.log(`✅ MongoDB Session ${sessionId} deleted successfully.`);
        res.json({ success: true, report });
    } catch (error) {
        console.error("❌ REPORT ERROR:", error);
        res.status(500).json({ success: false, message: "Failed to generate report" });
    }
};