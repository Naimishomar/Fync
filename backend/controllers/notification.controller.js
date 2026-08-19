import Notification from "../models/notification.model.js";
import User from "../models/user.model.js";
import { sendPushNotification, FCM_MULTICAST_LIMIT } from "../services/push.service.js";

const MAX_LIMIT = 50;
const DEFAULT_LIMIT = 20;

const parseLimit = (raw) => {
    const n = parseInt(raw, 10);
    if (!Number.isFinite(n) || n < 1) return DEFAULT_LIMIT;
    return Math.min(n, MAX_LIMIT);
};

/**
 * Keyset ("cursor") pagination instead of skip/limit.
 *
 * Offset paging was wrong here in two ways: a notification arriving between two
 * page requests shifts every later page down, so the client silently re-renders
 * a duplicate and skips a real one; and `skip` makes the database walk and
 * discard N documents, so page 50 costs fifty times page 1. Paging on
 * (createdAt, _id) is stable under inserts and reads straight off the index.
 *
 * `page` is still accepted so an already-shipped app build keeps working.
 */
export const getNotifications = async (req, res) => {
    try {
        const limit = parseLimit(req.query.limit);
        const query = { recipient: req.user.id };

        if (req.query.cursor) {
            // Cursor is "<createdAt ms>_<id>" from the previous page's last row.
            const [ms, id] = String(req.query.cursor).split("_");
            const createdAt = new Date(Number(ms));
            if (!Number.isNaN(createdAt.getTime()) && id) {
                query.$or = [
                    { createdAt: { $lt: createdAt } },
                    { createdAt, _id: { $lt: id } },
                ];
            }
        } else if (req.query.page) {
            // Legacy offset path, kept only for older clients.
            const page = Math.max(1, parseInt(req.query.page, 10) || 1);
            if (page > 1) {
                const skipped = await Notification.find({ recipient: req.user.id })
                    .sort({ createdAt: -1, _id: -1 })
                    .skip((page - 1) * limit - 1)
                    .limit(1)
                    .select("createdAt")
                    .lean();
                if (skipped.length === 0) {
                    return res.status(200).json({ success: true, notifications: [], nextCursor: null, hasMore: false });
                }
                query.createdAt = { $lte: skipped[0].createdAt };
            }
        }

        // Fetch one extra row instead of running a separate countDocuments over
        // the whole recipient's history just to compute a page total.
        const rows = await Notification.find(query)
            .sort({ createdAt: -1, _id: -1 })
            .limit(limit + 1)
            .populate("sender", "username name avatar")
            .populate("post", "image")
            .populate("shorts", "video")
            .lean();

        const hasMore = rows.length > limit;
        const notifications = hasMore ? rows.slice(0, limit) : rows;
        const last = notifications[notifications.length - 1];

        return res.status(200).json({
            success: true,
            notifications,
            hasMore,
            nextCursor: hasMore && last ? `${new Date(last.createdAt).getTime()}_${last._id}` : null,
        });
    } catch (error) {
        console.error("Get Notifications Error:", error);
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const getUnreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({
            recipient: req.user.id,
            isRead: false
        });
        return res.status(200).json({ success: true, count });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

export const markNotificationsRead = async (req, res) => {
    try {
        const filter = { recipient: req.user.id, isRead: false };

        // A client that only loaded the first page can pass the oldest id it
        // actually rendered, so scrolling away from unseen older notifications
        // no longer marks them read behind the user's back.
        if (req.body?.upTo) {
            const oldest = await Notification.findOne({ _id: req.body.upTo, recipient: req.user.id })
                .select("createdAt")
                .lean();
            if (oldest) filter.createdAt = { $gte: oldest.createdAt };
        }

        const result = await Notification.updateMany(filter, { $set: { isRead: true } });
        return res.status(200).json({ success: true, modified: result.modifiedCount });
    } catch (error) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};

/**
 * Admin broadcast: one message, every user, on their phone and in the app.
 *
 * Two things were missing. The push carried no branding or artwork, so it
 * landed as a bare grey system notification (see services/push.service.js), and
 * nothing was ever written to the notifications collection -- so a broadcast
 * existed only as a banner. Miss it and it was gone; Updates Center never knew
 * it happened. Both are fixed here.
 */
export const broadcastNotification = async (req, res) => {
    try {
        const { title, body, imageUrl } = req.body;

        if (!title?.trim() || !body?.trim()) {
            return res.status(400).json({ success: false, message: "Title and body are required." });
        }

        // Reply first. A broadcast to a large user base is minutes of work; the
        // admin should not be staring at a spinner, and an HTTP timeout must not
        // abandon it half-delivered.
        res.status(202).json({
            success: true,
            message: "Broadcast started. Delivery is in progress.",
        });

        (async () => {
            const cursor = User.find({})
                .select("fcmTokens")
                .lean()
                .cursor();

            const seenTokens = new Set();
            let tokenBatch = [];
            let recipientBatch = [];
            let sent = 0;
            let stored = 0;
            const deadTokens = [];

            const flushTokens = async () => {
                if (tokenBatch.length === 0) return;
                const batch = tokenBatch;
                tokenBatch = [];
                try {
                    const result = await sendPushNotification(batch, {
                        title,
                        body,
                        imageUrl: imageUrl || undefined,
                        data: { type: "broadcast" },
                        tag: "fync_broadcast",
                    });
                    if (result && typeof result === "object") {
                        sent += result.sent;
                        deadTokens.push(...result.deadTokens);
                    }
                } catch (err) {
                    // One failed batch must not abandon everyone else.
                    console.error("Broadcast batch failed:", err.message);
                }
            };

            const flushRecipients = async () => {
                if (recipientBatch.length === 0) return;
                const batch = recipientBatch;
                recipientBatch = [];
                try {
                    await Notification.insertMany(
                        batch.map((recipient) => ({
                            recipient,
                            sender: req.user.id,
                            type: "broadcast",
                            message: body,
                            imageUrl: imageUrl || "",
                        })),
                        { ordered: false }
                    );
                    stored += batch.length;
                } catch (err) {
                    console.error("Broadcast persist failed:", err.message);
                }
            };

            try {
                for await (const user of cursor) {
                    // Everyone gets the in-app record, including users with no
                    // device registered -- they will see it next time they open.
                    recipientBatch.push(user._id);
                    if (recipientBatch.length >= 1000) await flushRecipients();

                    for (const token of user.fcmTokens || []) {
                        if (!token || seenTokens.has(token)) continue;
                        seenTokens.add(token);
                        tokenBatch.push(token);
                        if (tokenBatch.length >= FCM_MULTICAST_LIMIT) await flushTokens();
                    }
                }
                await flushTokens();
                await flushRecipients();

                // Reinstalled devices keep a permanently failing token forever
                // otherwise, and every future broadcast wastes a slot on it.
                if (deadTokens.length > 0) {
                    await User.updateMany(
                        { fcmTokens: { $in: deadTokens } },
                        { $pull: { fcmTokens: { $in: deadTokens } } }
                    );
                }

                console.log(`Broadcast complete: ${sent} pushed, ${stored} stored, ${deadTokens.length} dead tokens pruned`);
            } catch (err) {
                console.error("Broadcast Notification Error:", err);
            }
        })();
    } catch (error) {
        console.error("Broadcast Notification Error:", error);
        if (!res.headersSent) {
            return res.status(500).json({ success: false, message: "Server error" });
        }
    }
};
