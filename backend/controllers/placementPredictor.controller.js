import Groq from "groq-sdk";
import PlacementPrediction from "../models/newFeatures/placementPrediction.model.js";
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const pdf = require("pdf-parse");
import https from "https";
import crypto from "crypto";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export const predictPlacement = async (req, res) => {
    console.log("🚀 Placement Predictor Request Received");
    try {
        const { gpa, resumeText: manualText } = req.body;
        console.log("📊 GPA:", gpa, "Manual Text length:", manualText?.length || 0);
        
        let resumeText = manualText || "";

        if (req.file) {
            try {
                const pdfData = await pdf(req.file.buffer);
                resumeText = pdfData.text.trim();
            } catch (err) {
                console.error("❌ PDF Parsing failed for prediction:", err.message);
                if (!resumeText) {
                    return res.status(400).json({ success: false, message: "Could not parse PDF. Please provide text resume or upload a cleaner file." });
                }
            }
        }

        if (!resumeText) {
            return res.status(400).json({ success: false, message: "GPA and Resume content (or file) are required for prediction." });
        }

        // --- CONSISTENCY LOGIC: HASH & CACHE ---
        const resumeHash = crypto.createHash('md5').update(resumeText + (gpa || "0")).digest('hex');
        
        // Check if user has already uploaded this EXACT resume/GPA combo in the last 7 days
        const existingPrediction = await PlacementPrediction.findOne({
            user: req.user.id,
            resumeHash,
            createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        }).sort({ createdAt: -1 });

        if (existingPrediction) {
            console.log("♻️ Returning cached prediction for consistency");
            return res.status(200).json({
                success: true,
                data: existingPrediction,
                cached: true
            });
        }

        const prompt = `
        Analyze the following student profile for job placement prediction based on REAL-WORLD 2024-2025 hiring trends.
        
        GPA: ${gpa || "Not specified"}
        Resume Content:
        """
        ${resumeText}
        """
        
        INSTRUCTIONS FOR ANALYSIS:
        1. ATS COMPATIBILITY: Evaluate if the resume follows the high-conversion "Jake's Resume" or "Deedy" style (Single-column, clear section headers, Quantifiable Bullet Points using the Google X-Y-Z formula).
        2. MARKET REALITY: Be honest about the current tech winter/market. If the projects are generic (e.g., Todo List, Basic Weather App), mark them as weak for Tier-1 companies.
        3. SKILL GAP: Identify missing high-demand industry skills (e.g., Docker, Kubernetes, System Design, Advanced DS/ALGO).

        Provide a detailed analysis in JSON format with exactly these keys:
        - placement_probability: (A percentage score 0-100)
        - ats_score: (Score 0-100 based on "Jake's Resume" formatting standards and readability)
        - is_jakes_format: (Boolean, true if it follows the clean minimalist single-column format)
        - target_companies: (Array of 3 company types: [Top-Tier, Mid-Range, Early-Startup])
        - strengths: (Array of strong professional points)
        - weaknesses: (Array of areas needing improvement, specifically mentioning if bullet points lack numbers/impact)
        - suggestion: (A 6-month roadmap including specific tech stacks to learn)
        - salary_estimate: (Potential starting salary range string in INR based on current market)
        - roles: (Array of top 3 job roles suited for)
        - resume_fix_tip: (One specific tip to improve their resume formatting to match the "Jake's Resume" standard)

        Be professional, data-driven, and slightly "tough" on the feedback to ensure the student actually improves.
        `;

        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: "You are an expert career counselor. You MUST provide consistent, objective, and data-backed analysis. Return ONLY a JSON object." },
                { role: "user", content: prompt }
            ],
            response_format: { type: "json_object" },
            temperature: 0.1, // Near-zero temperature for maximum consistency if cache fails
        });

        const analysis = JSON.parse(completion.choices[0].message.content);

        // Save to database
        const prediction = await PlacementPrediction.create({
            user: req.user.id,
            gpa: parseFloat(gpa) || 0,
            resumeText: resumeText.substring(0, 8000), 
            resumeHash,
            analysis
        });

        res.status(200).json({
            success: true,
            data: prediction
        });

    } catch (error) {
        console.error("Error in placement prediction:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getPredictionHistory = async (req, res) => {
    try {
        const history = await PlacementPrediction.find({ user: req.user.id }).sort({ createdAt: -1 });
        res.status(200).json({ success: true, data: history });
    } catch (error) {
        console.error("Error fetching prediction history:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
