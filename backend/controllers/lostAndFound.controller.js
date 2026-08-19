import LostAndFound from "../models/lostAndFound.model.js";
import { deleteFromR2 } from "../utils/r2.js";

export const createFoundItem = async (req, res) => {
    try {
        const { item, place } = req.body;
        if (!item || !place) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        let productImage = "";
        if (req.file) {
            productImage = req.file.path;
        }
        const lostAndFound = await LostAndFound.create({
            item,
            image: productImage,
            lostOrFound: "found",
            found_or_lost_by: req.user.id,
            place,
            college: req.user.college
        });
        return res.status(200).json({ success: true, message: "Lost and Found created successfully", lostAndFound });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const createLostItem = async (req, res) => {
    try {
        const { item, place } = req.body;
        if (!item) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }
        let productImage = "";
        if (req.file) {
            productImage = req.file.path;
        }
        const lostAndFound = await LostAndFound.create({
            item,
            image: productImage,
            lostOrFound: "lost",
            found_or_lost_by: req.user.id,
            place,
            college: req.user.college
        })
        return res.status(200).json({ success: true, message: "Lost and Found created successfully", lostAndFound });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const getFoundItems = async (req, res) => {
    try {
        // Was unbounded: every found item ever posted for the college, no sort, no
        // lean, on a collection with no index. Newest 100 is what the screen shows.
        const items = await LostAndFound.find({ college: req.user.college, lostOrFound: "found" })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("found_or_lost_by", "name username avatar")
            .lean();
        return res.status(200).json({ success: true, message: "Items fetched successfully", items });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getLostItems = async (req, res) => {
    try {
        // Was unbounded: every lost item ever posted for the college, no sort, no
        // lean, on a collection with no index. Newest 100 is what the screen shows.
        const items = await LostAndFound.find({ college: req.user.college, lostOrFound: "lost" })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate("found_or_lost_by", "name username avatar")
            .lean();
        return res.status(200).json({ success: true, message: "Items fetched successfully", items });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const claimedFoundItem = async (req, res) => {
    try {
        const { id } = req.params;
        const { claimed_by } = req.body;
        const item = await LostAndFound.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }
        if (item.found_or_lost_by.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        item.is_found_item_claimed = true;
        item.claimed_by = claimed_by;
        item.claimed_at = new Date();
        await item.save();
        return res.status(200).json({ success: true, message: "Item claimed successfully", item });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const claimedLostItem = async (req, res) => {
    try {
        const { id } = req.params;
        const item = await LostAndFound.findById(id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }
        if (item.found_or_lost_by.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        item.is_lost_item_found = true;
        item.claimed_at = new Date();
        await item.save();
        return res.status(200).json({ success: true, message: "Item claimed successfully", item });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}

export const deleteLostAndFoundItem = async (req, res) => {
    try {
        const item = await LostAndFound.findById(req.params.id);
        if (!item) {
            return res.status(404).json({ success: false, message: "Item not found" });
        }
        if (item.found_or_lost_by.toString() !== req.user.id.toString()) {
            return res.status(403).json({ success: false, message: "Not authorized" });
        }
        if (item.image) {
            await deleteFromR2(item.image);
        }
        await LostAndFound.findByIdAndDelete(req.params.id);
        return res.status(200).json({ success: true, message: "Item deleted successfully", item });
    } catch (error) {
        console.log("Internal server error", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
}