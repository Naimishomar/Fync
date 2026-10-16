import Groq from "groq-sdk";
import { GROQ_MODEL_FAST, GROQ_MODEL_CHAT, GROQ_MODEL_REPORT, GROQ_MODEL_STT } from "../utils/groqModel.js";
import { randomUUID } from "crypto";
import PaymentOrder from "../models/paymentOrder.model.js";
import { resolvePurchase } from "../utils/pricing.js";
import { PaymentError } from "../utils/redeemOrder.js";
import { redeemInterviewOrder, findInterviewCredit, claimInterviewCredit, releaseInterviewCredit } from "../utils/interviewCredit.js";
import Razorpay from "razorpay";
import crypto from "crypto";
import InterviewSession from "../models/interview.model.js";
import { deleteFromR2 } from "../utils/r2.js";
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
        const deletions = [];
        
        // Audio assets cleanup
        if (session.audioPublicIds?.length) {
            session.audioPublicIds.forEach(url => deletions.push(deleteFromR2(url)));
        }
        
        // Resume asset cleanup
        if (session.resumePublicId) {
            deletions.push(deleteFromR2(session.resumePublicId));
        }
        
        await Promise.allSettled(deletions);
        console.log("✅ Interview assets cleaned up from R2");
    } catch (err) {
        console.log("⚠️ R2 Cleanup warning:", err.message);
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
            model: GROQ_MODEL_FAST,
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
    let credit = null;
    try {
        const { domain, experience } = req.body;

        if (!req.file) {
            return res.status(400).json({ message: "Resume file required" });
        }

        // One verified payment = one session. Released below if start fails,
        // so the student retries without paying again.
        credit = await claimInterviewCredit(req.user.id);
        if (!credit) {
            return res.status(402).json({ success: false, message: "Payment required" });
        }
        const duration = credit.meta?.duration;

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
            model: GROQ_MODEL_CHAT,
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
            duration,
        });
    } catch (error) {
        console.log("❌ Start error:", error);
        if (credit) await releaseInterviewCredit(credit).catch((e) => console.error("Credit release failed:", e));
        res.status(500).json({ success: false, message: "Could not start the interview. Your payment is saved, please retry." });
    }
};

export const getInterviewCredit = async (req, res) => {
    try {
        const credit = await findInterviewCredit(req.user.id);
        res.json({ success: true, credit: credit ? { duration: credit.meta?.duration } : null });
    } catch (err) {
        console.error("Error reading interview credit:", err);
        res.status(500).json({ success: false, message: "Error reading interview credit" });
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
                model: GROQ_MODEL_STT,
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

        /**
         * Streamed, not awaited whole.
         *
         * Time to first token is ~410ms; a full four-sentence reply takes
         * several times that. Waiting for the whole thing meant the candidate
         * sat in silence for the difference, which is the single thing that
         * made this feel like software rather than a conversation.
         *
         * Tokens go over the socket the client already holds. The HTTP
         * response still returns the complete text at the end, so an app build
         * that predates this keeps working unchanged -- it just doesn't render
         * the intermediate tokens.
         */
        const io = req.app.get("io");
        const room = `user:${req.user.id}`;
        const emit = (event, payload) => {
            // Never let a socket problem fail an interview turn.
            try {
                io?.to(room).emit(event, { sessionId: String(session._id), ...payload });
            } catch (err) {
                console.log("⚠️ Interview emit failed:", err.message);
            }
        };

        // The candidate's own words, as soon as Whisper has them. Previously
        // nothing appeared on screen until the model had finished replying.
        emit("interview:transcript", { text: userText });

        let aiResponse = "";
        try {
            const stream = await groq.chat.completions.create({
                model: GROQ_MODEL_CHAT,
                messages,
                temperature: 0.7,
                max_tokens: 200,
                stream: true,
            });

            for await (const chunk of stream) {
                const delta = chunk.choices?.[0]?.delta?.content;
                if (!delta) continue;
                aiResponse += delta;
                emit("interview:token", { delta });
            }
        } catch (err) {
            // A stream that dies mid-flight leaves a partial answer. Better to
            // send what we have than to 500 on a live interview.
            console.log("⚠️ Interview stream error:", err.message);
        }

        if (!aiResponse.trim()) {
            aiResponse = "Sorry, I missed that. Could you say it once more?";
        }

        session.history.push({
            role: "assistant",
            parts: [{ text: aiResponse }],
        });

        await session.save();

        emit("interview:done", { text: aiResponse });

        res.json({
            success: true,
            text: aiResponse,
            userText,
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
            model: GROQ_MODEL_REPORT,
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

        // Priced from the shared catalog, like every other purchase.
        let priced;
        try {
            priced = await resolvePurchase("interview_session", { duration }, req.user.id);
        } catch (e) {
            return res.status(400).json({ success: false, message: e.message });
        }

        const order = await razorpay.orders.create({
            amount: priced.amount,
            currency: `INR`,
            // Razorpay wants this unique per order; it used to be the constant
            // string `interview_receipt_` for every single one.
            receipt: `interview_${randomUUID()}`,
            notes: { purpose: "interview_session", userId: req.user.id },
        });

        // Recorded so the verify step can bind the receipt to this order and
        // spend it once, instead of trusting a bare signature.
        await PaymentOrder.create({
            razorpayOrderId: order.id,
            user: req.user.id,
            purpose: "interview_session",
            amount: priced.amount,
            meta: priced.meta,
        });

        res.status(200).json({ success: true, order });
    } catch (err) {
        console.error(`Error creating interview order:`, err);
        res.status(500).json({ success: false, message: `Error creating payment order` });
    }
};

export const verifyInterviewPayment = async (req, res, next) => {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        // This used to return success for any valid signature, so one ₹5
        // receipt unlocked unlimited interviews — and a receipt bought for a
        // different feature worked just as well.
        let order;
        try {
            order = await redeemInterviewOrder({
                orderId: razorpay_order_id,
                paymentId: razorpay_payment_id,
                signature: razorpay_signature,
                userId: req.user.id,
            });
        } catch (e) {
            if (e instanceof PaymentError) {
                return res.status(e.status).json({ success: false, message: e.message });
            }
            throw e;
        }

        res.status(200).json({
            success: true,
            message: `Payment verified`,
            duration: order.meta?.duration,
        });
    } catch (err) {
        console.error(`Error verifying payment:`, err);
        res.status(500).json({ success: false, message: `Error verifying payment` });
    }
};
