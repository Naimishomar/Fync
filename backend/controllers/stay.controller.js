import Stay from "../models/stay.model.js";
import User from "../models/user.model.js";
import { deleteFromR2 } from "../utils/r2.js";
import { mapLimit } from "../utils/r2Upload.js";
import { isExplicitlyBlocked, isObjectId, fileReport } from "./safety.controller.js";
import { MAX_ACTIVE, MAX_PHOTOS, PAGE, LIFE_MS, parseStay, renewError, listQuery, list } from "../utils/stayRules.js";

const CARD = "kind title rent area distanceKm forGender food amenities status expiresAt createdAt photos owner";
const EDITABLE = ["kind", "title", "rent", "deposit", "area", "distanceKm", "forGender", "food", "amenities", "moveIn", "budget", "habits", "description"];
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const live = () => ({ expiresAt: { $gt: new Date() } });
export const dropPhotos = (urls) => mapLimit(urls.filter(Boolean), 3, deleteFromR2);
/** Uploaded photo URLs. `upload` also admits PDFs; those are deleted, never stored. */
const uploaded = (req) => {
    const files = Array.isArray(req.files) ? req.files : [];
    dropPhotos(files.filter((f) => !f.mimetype?.startsWith("image/")).map((f) => f.path));
    return files.filter((f) => f.mimetype?.startsWith("image/")).map((f) => f.path).filter(Boolean);
};
const card = (s) => ({ ...s, photos: undefined, owner: undefined, photo: s.photos?.[0] || null });

/** GET /stays — my college's live listings. */
export const listStays = async (req, res) => {
    try {
        const college = req.user.college;
        if (!college) return res.json({ success: true, stays: [], next: null });
        const { filter, sort, cursorOf } = listQuery(req.query, college);
        const meDoc = await User.findById(req.user._id).select("blockedUsers").lean();
        if (meDoc?.blockedUsers?.length) filter.owner = { $nin: meDoc.blockedUsers };
        const rows = await Stay.find(filter).select(CARD).sort(sort).limit(PAGE).lean();
        // Owners who blocked me: only checked for this page's owners, so it stays bounded.
        const owners = [...new Set(rows.map((s) => String(s.owner)))];
        const blockingMe = owners.length
            ? new Set((await User.find({ _id: { $in: owners }, blockedUsers: req.user._id }).distinct("_id")).map(String))
            : new Set();
        res.json({
            success: true,
            stays: rows.filter((s) => !blockingMe.has(String(s.owner))).map(card),
            next: rows.length === PAGE ? cursorOf(rows[rows.length - 1]) : null,
        });
    } catch (err) {
        console.error("listStays:", err.message);
        fail(res, 500, "Could not load listings");
    }
};

/** GET /stays/mine — my listings that haven't expired, filled ones too. */
export const myStays = async (req, res) => {
    try {
        const rows = await Stay.find({ owner: req.user._id, ...live() }).select(CARD + " renewed").sort({ createdAt: -1 }).limit(20).lean();
        res.json({ success: true, stays: rows.map((s) => ({ ...card(s), renewed: s.renewed })), max: MAX_ACTIVE });
    } catch (err) {
        console.error("myStays:", err.message);
        fail(res, 500, "Could not load your listings");
    }
};

/** GET /stays/:id — full listing + owner card. Never phone/email. */
export const getStay = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 404, "Listing not found");
        const s = await Stay.findOne({ _id: req.params.id, college: req.user.college || null, ...live() }).lean();
        const mine = s && String(s.owner) === req.user.id;
        if (!s || (!mine && s.status !== "active")) return fail(res, 404, "Listing not found");
        if (!mine && await isExplicitlyBlocked(req.user.id, String(s.owner))) return fail(res, 404, "Listing not found");
        const owner = await User.findById(s.owner).select("name avatar year").lean();
        res.json({ success: true, stay: { ...s, owner: owner || { _id: s.owner, name: "Fync user" }, mine } });
    } catch (err) {
        console.error("getStay:", err.message);
        fail(res, 500, "Could not load listing");
    }
};

/** POST /stays (multipart, photos ≤4). Uploaded photos are dropped on any refusal. */
export const createStay = async (req, res) => {
    const photos = uploaded(req);
    const refuse = (code, msg) => { dropPhotos(photos); return fail(res, code, msg); };
    try {
        const college = req.user.college;
        if (!college) return refuse(400, "Add your college to your profile to list a place");
        const { stay, error } = parseStay(req.body || {});
        if (error) return refuse(400, error);
        const active = await Stay.countDocuments({ owner: req.user._id, status: "active", ...live() });
        if (active >= MAX_ACTIVE) return refuse(400, `You can have up to ${MAX_ACTIVE} active listings`);
        const doc = await Stay.create({
            ...stay, owner: req.user._id, college, photos: photos.slice(0, MAX_PHOTOS), expiresAt: new Date(Date.now() + LIFE_MS),
        });
        res.status(201).json({ success: true, stay: { _id: doc._id } });
    } catch (err) {
        console.error("createStay:", err.message);
        refuse(500, "Could not create listing");
    }
};

/**
 * PATCH /stays/:id — owner only. Fields are merged over the stored listing and
 * re-validated. Photos: `keep` lists the existing URLs to keep (send it to
 * change photos); new uploads append. Photos no longer kept are deleted.
 */
export const updateStay = async (req, res) => {
    const added = uploaded(req);
    const refuse = (code, msg) => { dropPhotos(added); return fail(res, code, msg); };
    try {
        if (!isObjectId(req.params.id)) return refuse(404, "Listing not found");
        const s = await Stay.findOne({ _id: req.params.id, owner: req.user._id, ...live() });
        if (!s) return refuse(404, "Listing not found");
        const body = req.body || {};
        const merged = Object.fromEntries(EDITABLE.map((k) => [k, k in body ? body[k] : s[k]]));
        const { stay, error } = parseStay(merged);
        if (error) return refuse(400, error);

        const status = body.status === "filled" || body.status === "active" ? body.status : s.status;
        if (status === "active" && s.status !== "active") {
            const active = await Stay.countDocuments({ owner: req.user._id, status: "active", ...live() });
            if (active >= MAX_ACTIVE) return refuse(400, `You can have up to ${MAX_ACTIVE} active listings`);
        }
        let photos = s.photos;
        let removed = [];
        if ("keep" in body || added.length) {
            const keep = "keep" in body ? new Set(list(body.keep)) : new Set(s.photos);
            const kept = s.photos.filter((p) => keep.has(p));
            photos = [...kept, ...added];
            if (photos.length > MAX_PHOTOS) return refuse(400, `Up to ${MAX_PHOTOS} photos`);
            removed = s.photos.filter((p) => !keep.has(p));
        }
        s.set({ ...stay, status, photos });
        await s.save();
        dropPhotos(removed);
        res.json({ success: true });
    } catch (err) {
        console.error("updateStay:", err.message);
        refuse(500, "Could not update listing");
    }
};

/** POST /stays/:id/renew — +30 days, once. */
export const renewStay = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 404, "Listing not found");
        const s = await Stay.findOne({ _id: req.params.id, owner: req.user._id }).select("expiresAt renewed").lean();
        const why = renewError(s);
        if (why) return fail(res, 400, why);
        const expiresAt = new Date(new Date(s.expiresAt).getTime() + LIFE_MS);
        const r = await Stay.updateOne({ _id: s._id, renewed: false }, { $set: { renewed: true, expiresAt } });
        if (!r.modifiedCount) return fail(res, 400, "You've already renewed this listing once");
        res.json({ success: true, expiresAt });
    } catch (err) {
        console.error("renewStay:", err.message);
        fail(res, 500, "Could not renew");
    }
};

/** DELETE /stays/:id — owner only, photos too. */
export const deleteStay = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 404, "Listing not found");
        const s = await Stay.findOneAndDelete({ _id: req.params.id, owner: req.user._id }).select("photos").lean();
        if (!s) return fail(res, 404, "Listing not found");
        dropPhotos(s.photos || []);
        res.json({ success: true });
    } catch (err) {
        console.error("deleteStay:", err.message);
        fail(res, 500, "Could not delete");
    }
};

/** POST /stays/:id/report { reason } — files a report against the owner. */
export const reportStay = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 404, "Listing not found");
        const s = await Stay.findOne({ _id: req.params.id, college: req.user.college || null }).select("owner title").lean();
        if (!s) return fail(res, 404, "Listing not found");
        const reason = `[Stay ${s._id}: ${s.title}] ${String(req.body?.reason || "Inappropriate listing").slice(0, 200)}`;
        const r = await fileReport({ reporterId: req.user.id, targetType: "user", targetId: String(s.owner), reason });
        res.status(r.status).json({ success: r.ok, message: r.message });
    } catch (err) {
        console.error("reportStay:", err.message);
        fail(res, 500, "Could not report");
    }
};
