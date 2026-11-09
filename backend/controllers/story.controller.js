import mongoose from "mongoose";
import Story from "../models/story.model.js";
import User from "../models/user.model.js";
import { deleteFromR2 } from "../utils/r2.js";

const MAX_ACTIVE = 20;
const HEX = /^#[0-9a-f]{6}$/i;
const live = () => ({ expiresAt: { $gt: new Date() } });

export const createStory = async (req, res) => {
    const image = req.files?.image?.[0]?.path || null;
    const video = req.files?.video?.[0]?.path || null;
    const dropUploads = () => { if (image) deleteFromR2(image); if (video) deleteFromR2(video); };
    try {
        const text = String(req.body.text || "").trim().slice(0, 300);
        const ask = req.body.ask === true || req.body.ask === "true";
        // Multipart sends it as a JSON string.
        let music = null;
        try {
            const m = typeof req.body.music === "string" ? JSON.parse(req.body.music) : req.body.music;
            if (m && /^[A-Za-z0-9]{1,20}$/.test(String(m.id))) {
                music = { id: String(m.id), title: String(m.title || "").slice(0, 120), artist: String(m.artist || "").slice(0, 80) };
            }
        } catch { /* bad music field: post without it */ }
        if (!image && !video && !text && !ask) {
            return res.status(400).json({ success: false, message: "Add a photo, a video or some text" });
        }
        const active = await Story.countDocuments({ user: req.user._id, ...live() });
        if (active >= MAX_ACTIVE) {
            dropUploads();
            return res.status(429).json({ success: false, message: `You can have up to ${MAX_ACTIVE} stories at a time` });
        }
        const story = await Story.create({
            user: req.user._id,
            college: req.user.college || null,
            image,
            video,
            text,
            bg: HEX.test(req.body.bg) ? req.body.bg : undefined,
            ask,
            music: video ? null : music, // a video has its own sound
        });
        res.status(201).json({ success: true, story });
    } catch (error) {
        dropUploads();
        console.error("createStory:", error.message);
        res.status(500).json({ success: false, message: "Could not post story" });
    }
};

/**
 * Live stories from the viewer's college (and their own), grouped per author:
 * own first, then authors with unseen stories (newest first), then seen ones.
 * Viewer lists never leave the server, only the author's own counts.
 */
export const getStoryFeed = async (req, res) => {
    try {
        const me = String(req.user._id);
        const college = req.user.college;
        const [stories, meDoc] = await Promise.all([
            Story.find({ ...(college ? { $or: [{ college }, { user: req.user._id }] } : { user: req.user._id }), ...live() })
                .sort({ createdAt: 1 })
                .populate("user", "name username avatar blockedUsers")
                .lean(),
            User.findById(req.user._id).select("blockedUsers").lean(),
        ]);
        const iBlocked = new Set((meDoc?.blockedUsers || []).map(String));

        const groups = new Map();
        for (const s of stories) {
            const author = s.user;
            if (!author) continue;
            const aid = String(author._id);
            if (aid !== me && (iBlocked.has(aid) || (author.blockedUsers || []).some((b) => String(b) === me))) continue;
            if (!groups.has(aid)) {
                groups.set(aid, {
                    user: { _id: aid, name: author.name, username: author.username, avatar: author.avatar },
                    isMine: aid === me,
                    stories: [],
                });
            }
            const viewers = (s.viewers || []).map(String);
            groups.get(aid).stories.push({
                _id: s._id,
                image: s.image,
                video: s.video,
                text: s.text,
                bg: s.bg,
                ask: !!s.ask,
                music: s.music || null,
                createdAt: s.createdAt,
                expiresAt: s.expiresAt,
                seen: aid === me || viewers.includes(me),
                ...(aid === me ? { viewCount: viewers.length } : {}),
            });
        }

        const list = [...groups.values()].map((g) => ({
            ...g,
            allSeen: g.stories.every((s) => s.seen),
            latest: g.stories[g.stories.length - 1].createdAt,
        }));
        list.sort((a, b) =>
            (b.isMine - a.isMine) || (a.allSeen - b.allSeen) || (new Date(b.latest) - new Date(a.latest)));

        res.json({ success: true, groups: list });
    } catch (error) {
        console.error("getStoryFeed:", error.message);
        res.status(500).json({ success: false, message: "Could not load stories" });
    }
};

export const viewStory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid id" });
        // Only someone the story is shown to can count as a viewer.
        await Story.updateOne(
            { _id: id, user: { $ne: req.user._id }, college: req.user.college || "__none__", ...live() },
            { $addToSet: { viewers: req.user._id } },
        );
        res.json({ success: true });
    } catch (error) {
        console.error("viewStory:", error.message);
        res.status(500).json({ success: false, message: "Could not mark seen" });
    }
};

export const getStoryViewers = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid id" });
        const story = await Story.findOne({ _id: id, user: req.user._id })
            .populate("viewers", "name username avatar")
            .lean();
        if (!story) return res.status(404).json({ success: false, message: "Story not found" });
        res.json({ success: true, viewers: (story.viewers || []).reverse() });
    } catch (error) {
        console.error("getStoryViewers:", error.message);
        res.status(500).json({ success: false, message: "Could not load viewers" });
    }
};

export const deleteStory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ success: false, message: "Invalid id" });
        const story = await Story.findOneAndDelete({ _id: id, user: req.user._id });
        if (!story) return res.status(404).json({ success: false, message: "Story not found" });
        await Promise.all([story.image, story.video].filter(Boolean).map(deleteFromR2));
        res.json({ success: true });
    } catch (error) {
        console.error("deleteStory:", error.message);
        res.status(500).json({ success: false, message: "Could not delete story" });
    }
};
