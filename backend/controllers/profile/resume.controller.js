import User from "../../models/user.model.js";
import UserProject from "../../models/profile/project.model.js";
import Internship from "../../models/profile/internship.model.js";
import Certificate from "../../models/profile/certificate.model.js";
import FyncScore from "../../models/profile/fyncScore.model.js";
import PDFDocument from "pdfkit";

// ─── Badge emoji map ──────────────────────────────────────────────────────────
const BADGE_EMOJI = {
    Newcomer: "🌱", Explorer: "🗺️", Builder: "🔨",
    Innovator: "💡", Pioneer: "🚀", Legend: "🌟"
};

// ─── Generate PDF Resume ──────────────────────────────────────────────────────
export const generateResumePDF = async (req, res) => {
    try {
        const targetUserId = req.params.userId;

        const [user, projects, internships, certs, scoreDoc] = await Promise.all([
            User.findById(targetUserId).select("-password -refreshToken -githubAccessToken"),
            UserProject.find({ user: targetUserId, isPublic: true }).sort({ isFeatured: -1, createdAt: -1 }).limit(6),
            Internship.find({ user: targetUserId, isPublic: true }).sort({ startDate: -1 }),
            Certificate.find({ user: targetUserId, isPublic: true }).sort({ issueDate: -1 }).limit(8),
            FyncScore.findOne({ user: targetUserId })
        ]);

        if (!user) return res.status(404).json({ success: false, message: "User not found" });

        // ── Setup PDF ──────────────────────────────────────────────────────
        const doc = new PDFDocument({ margin: 50, size: "A4" });

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", `attachment; filename="fync-resume-${user.username}.pdf"`);
        doc.pipe(res);

        const W = doc.page.width - 100; // usable width
        const BLUE = "#2563EB";
        const DARK = "#111827";
        const GRAY = "#6B7280";
        const LIGHT = "#F3F4F6";

        // ── Header ─────────────────────────────────────────────────────────
        doc.rect(0, 0, doc.page.width, 130).fill(BLUE);
        doc.fillColor("white").fontSize(26).font("Helvetica-Bold")
            .text(user.name || user.username, 50, 40);
        doc.fontSize(12).font("Helvetica")
            .text(`@${user.username}  •  ${user.college || ""}`, 50, 72);

        // Fync Score badge
        const badge = scoreDoc?.badge || user.fyncBadge || "Newcomer";
        const score = scoreDoc?.totalScore || user.fyncScore || 0;
        doc.fontSize(11).font("Helvetica-Bold")
            .text(`${BADGE_EMOJI[badge] || ""} Fync ${badge}  |  Score: ${score}/1000`, 50, 94);

        // Contact row
        const contact = [
            user.email,
            user.github_id ? `github.com/${user.githubUsername || ""}` : null,
            user.linkedIn_id || null
        ].filter(Boolean).join("  •  ");
        doc.fontSize(9).font("Helvetica").fillColor("rgba(255,255,255,0.85)")
            .text(contact, 50, 112);

        doc.moveDown(4);

        // Helper: section header
        const sectionHeader = (title) => {
            doc.fillColor(BLUE).fontSize(13).font("Helvetica-Bold")
                .text(title.toUpperCase(), { continued: false });
            doc.moveTo(50, doc.y).lineTo(50 + W, doc.y).stroke(BLUE);
            doc.moveDown(0.4);
        };

        // Helper: small label
        const label = (text) => doc.fillColor(GRAY).fontSize(9).font("Helvetica").text(text);
        const body  = (text) => doc.fillColor(DARK).fontSize(10).font("Helvetica").text(text, { lineGap: 2 });

        // ── About ──────────────────────────────────────────────────────────
        if (user.about) {
            sectionHeader("About");
            body(user.about);
            doc.moveDown(0.8);
        }

        // ── Skills ─────────────────────────────────────────────────────────
        if (user.skills?.length) {
            sectionHeader("Skills");
            doc.fillColor(DARK).fontSize(10).font("Helvetica")
                .text(user.skills.join("  •  "), { lineGap: 2 });
            doc.moveDown(0.8);
        }

        // ── Work Experience ────────────────────────────────────────────────
        if (internships.length) {
            sectionHeader("Experience");
            internships.forEach((i) => {
                const start = i.startDate ? new Date(i.startDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "";
                const end = i.isCurrentlyWorking ? "Present" : (i.endDate ? new Date(i.endDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "");
                doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold").text(`${i.role}  @  ${i.company}`);
                label(`${capitalize(i.type)}  |  ${i.workMode}  |  ${start} — ${end}`);
                if (i.description) body(i.description);
                if (i.techStack?.length) label("Stack: " + i.techStack.join(", "));
                doc.moveDown(0.6);
            });
        }

        // ── Projects ─────────────────────────────────────────────────────
        if (projects.length) {
            sectionHeader("Projects");
            projects.forEach((p) => {
                doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold")
                    .text(p.title + (p.status === "in-progress" ? "  [In Progress]" : ""));
                if (p.tagline) label(p.tagline);
                if (p.description) body(p.description);
                if (p.techStack?.length) label("Tech: " + p.techStack.join(", "));
                const links = [p.githubUrl && `GitHub: ${p.githubUrl}`, p.liveUrl && `Live: ${p.liveUrl}`].filter(Boolean);
                if (links.length) doc.fillColor(BLUE).fontSize(9).text(links.join("   "), { lineGap: 2 });
                doc.moveDown(0.6);
            });
        }

        // ── Certificates ──────────────────────────────────────────────────
        if (certs.length) {
            sectionHeader("Certifications");
            certs.forEach((c) => {
                const date = c.issueDate ? new Date(c.issueDate).toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "";
                doc.fillColor(DARK).fontSize(10).font("Helvetica-Bold").text(`${c.title}  —  ${c.issuer}`);
                label(`${capitalize(c.category)}  |  ${date}${c.credentialUrl ? "   " + c.credentialUrl : ""}`);
                doc.moveDown(0.4);
            });
        }

        // ── Coding Stats ──────────────────────────────────────────────────
        const lc = user.codingStats?.leetcodeSolved || 0;
        const gfg = user.codingStats?.gfgSolved || 0;
        if (lc || gfg) {
            sectionHeader("Coding");
            const parts = [];
            if (lc) parts.push(`LeetCode: ${lc} solved`);
            if (gfg) parts.push(`GFG: ${gfg} solved`);
            if (user.githubUsername) parts.push(`GitHub: @${user.githubUsername}  |  ⭐ ${user.githubStats?.totalStars || 0}  |  ${user.githubStats?.totalRepos || 0} repos`);
            body(parts.join("   •   "));
            doc.moveDown(0.5);
        }

        // ── Footer ────────────────────────────────────────────────────────
        doc.fontSize(8).fillColor(GRAY)
            .text(`Generated by Fync  •  fync.io/@${user.username}  •  ${new Date().toLocaleDateString()}`,
                50, doc.page.height - 40, { align: "center" });

        doc.end();
    } catch (error) {
        console.error("generateResumePDF error:", error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: "PDF generation failed" });
        }
    }
};

const capitalize = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
