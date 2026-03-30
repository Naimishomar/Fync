import Groq from "groq-sdk";
import Razorpay from "razorpay";
import crypto from "crypto";
import InterviewSession from "../models/interview.model.js";
import { cloudinary } from "../utils/cloudinary.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");

import axios from "axios";
import https from "https";
import fs from "fs";
import path from "path";
import os from "os";
import PDFDocument from "pdfkit";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const deleteInterviewAssets = async (session) => {
    try {
        if (session.audioPublicIds?.length) {
            await cloudinary.api.delete_resources(session.audioPublicIds, {
                resource_type: "raw",
            });
            console.log("✅ Audio assets deleted");
        }
        if (session.resumePublicId) {
            await cloudinary.uploader.destroy(session.resumePublicId, { 
                resource_type: "image" 
            });
            await cloudinary.uploader.destroy(session.resumePublicId, { 
                resource_type: "raw" 
            });
            console.log("✅ Resume asset deleted");
        }
    } catch (err) {
        console.log("⚠️ Cleanup warning:", err.message);
    }
};

const updateHistorySummary = async (history) => {
    try {
        if (history.length < 6) return "";

        const oldMessages = history.slice(1, -3);

        const text = oldMessages
            .map((m) => `${m.role}: ${m.parts[0].text}`)
            .join("\n");

        const res = await groq.chat.completions.create({
            model: "llama-3.1-8b-instant",
            messages: [
                {
                    role: "system",
                    content:
                        "Summarize this interview in 2 sentences. Mention topics covered and candidate performance.",
                },
                { role: "user", content: text },
            ],
            max_tokens: 120,
        });

        return res.choices[0].message.content;
    } catch (err) {
        console.log("⚠️ Summary error:", err.message);
        return "";
    }
};

export const startInterview = async (req, res) => {
    try {
        const { domain, experience, duration } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Resume file required" });
        }

        let resumeText = "";

        try {
            console.log("🔹 Fetching resume (native https) from:", req.file.path);
            
            const buffer = await new Promise((resolve, reject) => {
                https.get(req.file.path, (res) => {
                    if (res.statusCode !== 200) {
                        reject(new Error(`Failed to fetch PDF: ${res.statusCode}`));
                        return;
                    }
                    const chunks = [];
                    res.on('data', (chunk) => chunks.push(chunk));
                    res.on('end', () => resolve(Buffer.concat(chunks)));
                }).on('error', reject);
            });

            const pdfData = await pdf(buffer);
            resumeText = pdfData.text.substring(0, 3000);
            console.log("✅ Resume parsed successfully");
        } catch (err) {
            console.error("❌ Resume fetch failed using native https.");
            console.error("URL:", req.file.path);
            console.error("Error:", err.message);
            resumeText = `Candidate applying for ${domain} with ${experience} years experience.`;
        }

        const systemPrompt = `You are Anusthi, a professional and friendly technical interviewer for the ${domain} role.

Candidate experience: ${experience} years
Resume context: ${resumeText}

GOAL: Introduce yourself as Anusthi and ask the first technical question. 

STRATEGY: Pick a specific project, technology, or keyword mentioned in the Resume context and ask a challenging question about it.

INTERACTION RULES:
1. NO CONCEPT EXPLANATIONS: Do not explain how things work. Focus on evaluation.
2. RESUME FOCUS: Every question MUST relate to a keyword or skill found in the resume.
3. RESPONSE TO CHECK-INS: If the candidate asks "Are you listening?", confirm politely and redirect.
4. REPEAT REQUESTS: If asked to repeat, do so exactly.
5. CONCISE: Keep your total response under 3 sentences.`;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "system", content: systemPrompt }],
            temperature: 0.7,
            max_tokens: 200,
        });

        const firstQuestion = completion.choices[0].message.content;

        const session = await InterviewSession.create({
            user: req.user.id,
            domain,
            resumeText,
            resumePublicId: req.file.filename,
            duration: parseInt(duration),
            summary: "",
            history: [
                { role: "system", parts: [{ text: systemPrompt }] },
                { role: "assistant", parts: [{ text: firstQuestion }] },
            ],
            status: "active",
        });

        res.json({
            success: true,
            sessionId: session._id,
            question: firstQuestion,
        });
    } catch (error) {
        console.log("❌ Start error:", error);
        res.status(500).json({ success: false });
    }
};

export const processAnswer = async (req, res) => {
    try {
        const { sessionId } = req.body;

        const session = await InterviewSession.findById(sessionId);

        if (!req.file) {
            return res.status(400).json({ message: "Audio required" });
        }

        let userText = "(audio unclear)";
        let tempPath = null;

        try {
            const audioRes = await axios.get(req.file.path, {
                responseType: "arraybuffer",
            });

            tempPath = path.join(os.tmpdir(), `audio_${Date.now()}.m4a`);

            fs.writeFileSync(tempPath, Buffer.from(audioRes.data));

            const transcription = await groq.audio.transcriptions.create({
                file: fs.createReadStream(tempPath),
                model: "whisper-large-v3",
                language: "en",
            });

            userText = transcription.text;
        } catch (err) {
            console.log("⚠️ Whisper error:", err.message);
        } finally {
            if (tempPath && fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
            }
        }

        session.audioPublicIds.push(req.file.filename);

        session.history.push({
            role: "user",
            parts: [{ text: userText }],
        });

        if (session.history.length % 6 === 0) {
            session.summary = await updateHistorySummary(session.history);
        }

        const lastMessages = session.history.slice(-3);

        const messages = [
            {
                role: "system",
                content: `You are Anusthi, a technical interviewer. 

ROLE: Interviewing for ${session.domain}.
RESUME KEYWORDS: ${session.resumeText}
PREVIOUS SUMMARY: ${session.summary}

GOAL: Provide immediate feedback, suggest a quick refinement, and ask the next resume-based question.

STRICT RULES:
1. FEEDBACK & VERDICT: Start with "Yes, you are correct" or "No, that's not quite right."
2. REFINEMENT: If the answer was weak or wrong, give a 1-sentence tip on how they could have answered better. DO NOT explain the whole concept.
3. NEXT QUESTION: Immediately ask the next technical question focusing strictly on keywords/projects from the RESUME.
4. INTERACTION: 
   - "Are you listening?" -> "Yes, I'm here. Please continue."
   - "Repeat?" -> "Sure, [Repeat last question]."
5. NO LAME TOPICS: Stay strictly on the technical path for ${session.domain}.
6. VERY CONCISE: Keep the entire response under 3-4 sentences total.`,
            },
            ...lastMessages.map((m) => ({
                role: m.role === "assistant" ? "assistant" : "user",
                content: m.parts[0].text,
            })),
        ];

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages,
            temperature: 0.7,
            max_tokens: 200,
        });

        const aiResponse = completion.choices[0].message.content;

        session.history.push({
            role: "assistant",
            parts: [{ text: aiResponse }],
        });

        await session.save();

        res.json({
            success: true,
            text: aiResponse,
        });
    } catch (error) {
        console.log("❌ Process error:", error);
        res.status(500).json({ success: false });
    }
};

export const endInterview = async (req, res) => {
    try {
        const { sessionId } = req.body;

        const session = await InterviewSession.findById(sessionId);

        if (!session) {
            return res.status(404).json({ message: "Session not found" });
        }

        const reportPrompt = `
Interview history:

${JSON.stringify(session.history)}

Generate JSON with:

technical_score (0-10)
communication_score (0-10)
strengths (array)
improvements (array)
verdict ("Pass" or "Fail")
summary
`;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                {
                    role: "system",
                    content: "Generate interview evaluation JSON only.",
                },
                { role: "user", content: reportPrompt },
            ],
            response_format: { type: "json_object" },
        });

        const report = JSON.parse(completion.choices[0].message.content);

        await deleteInterviewAssets(session);

        await InterviewSession.findByIdAndDelete(sessionId);

        res.json({
            success: true,
            report,
        });
    } catch (error) {
        console.log("❌ Report error:", error);
        res.status(500).json({ success: false });
    }
};
export const cancelInterview = async (req, res) => {
    try {
        const { sessionId } = req.body;
        const session = await InterviewSession.findById(sessionId);

        if (session) {
            await deleteInterviewAssets(session);
            await InterviewSession.findByIdAndDelete(sessionId);
            console.log(`? Session ${sessionId} cancelled and cleaned up`);
        }

        res.json({ success: true, message: `Interview cancelled and assets cleaned up` });
    } catch (error) {
        console.log(`? Cancel error:`, error);
        res.status(500).json({ success: false });
    }
};
export const generateReportPDF = async (req, res) => {
    try {
        const { report } = req.body;
        if (!report) return res.status(400).json({ error: "Report data missing" });

        const doc = new PDFDocument({ margin: 50 });
        
        // Response headers for PDF download
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="Fync_Interview_Report.pdf"');

        doc.pipe(res);

        // Header
        doc.fillColor("#ec4899").fontSize(24).font("Helvetica-Bold").text("FYNC INTERVIEW REPORT", { align: "center" });
        doc.moveDown();

        // Scores
        doc.fillColor("#1f2937").fontSize(14).font("Helvetica-Bold").text("EVALUATION SCORES");
        doc.rect(doc.x, doc.y, 500, 1).fill("#e5e7eb");
        doc.moveDown(0.5);
        
        doc.fontSize(12).font("Helvetica").fillColor("#374151");
        doc.text(`Technical Score: ${report.technical_score}/10`);
        doc.text(`Communication Score: ${report.communication_score}/10`);
        doc.text(`Verdict: ${report.verdict}`, { color: report.verdict === 'Pass' ? '#10b981' : '#ef4444' });
        doc.moveDown();

        // Summary
        doc.font("Helvetica-Bold").text("EXECUTIVE SUMMARY");
        doc.moveDown(0.2);
        doc.font("Helvetica").fontSize(10).text(report.summary, { align: "justify" });
        doc.moveDown();

        // Strengths
        doc.font("Helvetica-Bold").fontSize(12).text("STRENGTHS");
        report.strengths.forEach(s => {
            doc.font("Helvetica").fontSize(10).text(`- ${s}`, { indent: 15 });
        });
        doc.moveDown();

        // Areas for Improvement
        doc.font("Helvetica-Bold").fontSize(12).text("AREAS FOR IMPROVEMENT");
        report.improvements.forEach(i => {
            doc.font("Helvetica").fontSize(10).text(`- ${i}`, { indent: 15 });
        });

        // Footer
        doc.moveDown(4);
        doc.fontSize(8).fillColor("#9ca3af").text("Generated by Fync AI Career Assistant", { align: "center" });

        doc.end();
    } catch (error) {
        console.error("❌ PDF Gen Error:", error);
        res.status(500).json({ error: "Failed to generate PDF" });
    }
};

export const createInterviewOrder = async (req, res) => {
    try {
        const { duration } = req.body;
        let amount = 0;

        if (duration == 10) amount = 5;
        else if (duration == 15) amount = 7;
        else return res.status(400).json({ success: false, message: `Invalid duration` });

        const options = {
            amount: amount * 100,
            currency: `INR`,
            receipt: `interview_receipt_`,
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json({ success: true, order });
    } catch (err) {
        console.error(`Error creating interview order:`, err);
        res.status(500).json({ success: false, message: `Error creating payment order` });
    }
};

export const verifyInterviewPayment = async (req, res) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const body = razorpay_order_id + `|` + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac(`sha256`, process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest(`hex`);

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: `Invalid payment signature` });
        }

        res.status(200).json({ success: true, message: `Payment verified` });
    } catch (err) {
        console.error(`Error verifying payment:`, err);
        res.status(500).json({ success: false, message: `Error verifying payment` });
    }
};
