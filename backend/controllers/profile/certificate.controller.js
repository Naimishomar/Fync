import Certificate from "../../models/profile/certificate.model.js";

// ─── Add Certificate ──────────────────────────────────────────────────────────
export const createCertificate = async (req, res) => {
    try {
        const { title, issuer, issueDate, expiryDate, credentialUrl, imageUrl, credentialId, category, source, isPublic } = req.body;
        if (!title || !issuer) return res.status(400).json({ success: false, message: "title and issuer are required" });

        const cert = await Certificate.create({
            user: req.user._id,
            title, issuer,
            issueDate: issueDate ? new Date(issueDate) : null,
            expiryDate: expiryDate ? new Date(expiryDate) : null,
            credentialUrl, 
            imageUrl: req.file?.path || imageUrl, 
            credentialId,
            category: category || "other",
            source: source || "manual",
            isPublic: isPublic !== false
        });

        return res.status(201).json({ success: true, message: "Certificate added!", cert });
    } catch (error) {
        console.error("createCertificate error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Get User Certificates ────────────────────────────────────────────────────
export const getUserCertificates = async (req, res) => {
    try {
        const targetUserId = req.params.userId;
        const isOwner = req.user?._id?.toString() === targetUserId;

        const filter = { user: targetUserId };
        if (!isOwner) filter.isPublic = true;

        const certs = await Certificate.find(filter).sort({ issueDate: -1 });
        return res.json({ success: true, certs });
    } catch (error) {
        console.error("getUserCertificates error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Update Certificate ───────────────────────────────────────────────────────
export const updateCertificate = async (req, res) => {
    try {
        const cert = await Certificate.findById(req.params.id);
        if (!cert) return res.status(404).json({ success: false, message: "Not found" });
        if (cert.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        const allowed = ["title", "issuer", "issueDate", "expiryDate", "credentialUrl", "imageUrl", "credentialId", "category", "source", "isPublic"];
        allowed.forEach((f) => { if (req.body[f] !== undefined) cert[f] = req.body[f]; });
        
        if (req.file) {
            cert.imageUrl = req.file.path;
        }

        await cert.save();

        return res.json({ success: true, cert });
    } catch (error) {
        console.error("updateCertificate error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

// ─── Delete Certificate ───────────────────────────────────────────────────────
export const deleteCertificate = async (req, res) => {
    try {
        const cert = await Certificate.findById(req.params.id);
        if (!cert) return res.status(404).json({ success: false, message: "Not found" });
        if (cert.user.toString() !== req.user._id.toString())
            return res.status(403).json({ success: false, message: "Not authorized" });

        await cert.deleteOne();
        return res.json({ success: true, message: "Deleted" });
    } catch (error) {
        console.error("deleteCertificate error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
