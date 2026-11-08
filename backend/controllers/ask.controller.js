import AskMessage, { AskSettings } from "../models/askMessage.model.js";
import User from "../models/user.model.js";
import Report from "../models/report.model.js";
import redisClient from "../utils/redis.js";
import { sendPushNotification } from "../utils/notification.js";
import { isObjectId, takeReportSlot } from "./safety.controller.js";
import { BASE, PLAY_URL, cached } from "../routes/shareCard.route.js";
import { esc, truncate } from "../utils/shareCard.js";
import { renderAskCard } from "../utils/askCard.js";
import {
    USERNAME, LIMITS, MAX_LEN, DAY, TTL_DAYS, checkMessage, cleanText, senderHash, recentHashes,
    isBlockedSender, cardSig, sigOk, expiresAt,
} from "../utils/askRules.js";

const SECRET = process.env.JWT_SECRET || "fync";
const fail = (res, code, message) => res.status(code).json({ success: false, message });
const askLink = (username) => `${BASE}/ask/${encodeURIComponent(username)}`;
const cardUrl = (id) => `${BASE}/ask/card/${id}.png?k=${cardSig(String(id), SECRET)}`;
const liveFilter = (me, extra = {}) => ({ to: me, expiresAt: { $gt: new Date() }, ...extra });

const findRecipient = (username) => USERNAME.test(username)
    ? User.findOne({ username, isBanned: { $ne: true } }).select("name username avatar expoPushToken").lean()
    : null;

/** Fixed window counter. Throws when Redis is down: the caller fails closed. */
const hit = async (key, ttl, max) => {
    const n = await redisClient.incr(key);
    if (n === 1) await redisClient.expire(key, ttl);
    return n <= max;
};

// ---------- public web page ----------

const page = (res, status, { user, state, message }) => {
    const name = user ? truncate(user.name || user.username, 40) : "";
    const avatar = user?.avatar && /^https:\/\//.test(user.avatar) ? user.avatar : null;
    const title = user ? `Send ${name} an anonymous message` : "Link not found";
    const og = user ? `
<meta property="og:site_name" content="Fync"><meta property="og:type" content="website">
<meta property="og:title" content="${esc(title)}"><meta property="og:description" content="Ask me anything. 100% anonymous, gone in 7 days.">
<meta property="og:url" content="${esc(askLink(user.username))}"><meta property="og:image" content="${esc(`${BASE}/card/u/${user._id}.jpg`)}">
<meta name="twitter:card" content="summary_large_image">` : "";
    const getApp = `<a class="btn" href="${PLAY_URL}">Get your own link - download Fync</a>`;
    const body = !user
        ? `<h1>This link isn't active</h1><p>${esc(message || "The user may have paused their link.")}</p>${getApp}`
        : `<div class="card"><div class="head">${avatar ? `<img src="${esc(avatar)}" alt="">` : ""}<div><b>@${esc(user.username)}</b><small>send me anonymous messages!</small></div></div>
<div id="sent" ${state === "sent" ? "" : "hidden"}><h2>Sent! 🎉</h2><p>They'll never know it was you.</p>${getApp}<p><a href="${esc(askLink(user.username))}" class="link">Send another</a></p></div>
<form id="f" method="post" ${state === "sent" ? "hidden" : ""}>
<textarea name="text" maxlength="${MAX_LEN}" required placeholder="Ask me anything..."></textarea>
<input name="website" tabindex="-1" autocomplete="off" aria-hidden="true" class="hp">
<p id="err" class="err">${esc(message || "")}</p>
<button class="btn" type="submit">Send anonymously</button>
<p class="small">🔒 Anonymous. Messages disappear after 7 days.</p></form></div>`;
    res.set("Content-Security-Policy",
        "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src https:; connect-src 'self'; form-action 'self'; base-uri 'none'");
    res.status(status).type("html").send(`<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>${og}
<style>*{box-sizing:border-box}body{margin:0;min-height:100vh;font-family:system-ui,sans-serif;background:linear-gradient(160deg,#F97316,#FDBA74);color:#12100E;display:flex;align-items:center;justify-content:center;padding:20px}
main{width:100%;max-width:420px;text-align:center}.card{background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 10px 30px rgba(0,0,0,.12)}
.head{display:flex;align-items:center;gap:12px;padding:16px;text-align:left;border-bottom:1px solid #E7E2D9}.head img{width:48px;height:48px;border-radius:50%;object-fit:cover}
.head small{display:block;color:#57534E}form,#sent{padding:16px}textarea{width:100%;min-height:140px;border:1px solid #E7E2D9;border-radius:16px;padding:14px;font:inherit;font-size:17px;resize:none;background:#F5F2EC}
.btn{display:block;width:100%;margin-top:12px;padding:15px;border:0;border-radius:999px;background:#12100E;color:#fff;font:inherit;font-weight:700;font-size:16px;text-decoration:none;cursor:pointer}
.btn:disabled{opacity:.6}.err{color:#B91C1C;min-height:1em;margin:8px 0 0;font-size:14px}.small{color:#57534E;font-size:13px}.link{color:#57534E}
.hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}h1{color:#fff}main>p{color:#fff}[hidden]{display:none}</style>
</head><body><main>${body}</main>
<script>(function(){var f=document.getElementById('f');if(!f)return;f.addEventListener('submit',function(e){e.preventDefault();var b=f.querySelector('button'),er=document.getElementById('err');b.disabled=true;er.textContent='';
fetch(location.pathname,{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify({text:f.elements.text.value,website:f.elements.website.value})})
.then(function(r){return r.json()}).then(function(d){if(d.success){f.reset();f.hidden=true;document.getElementById('sent').hidden=false}else{er.textContent=d.message||'Could not send'}})
.catch(function(){er.textContent='Network error, try again'}).then(function(){b.disabled=false})})})();</script>
</body></html>`);
};

/** GET /ask/:username — the public "send me anonymous messages" page. */
export const askPage = async (req, res) => {
    try {
        const user = await findRecipient(String(req.params.username));
        if (!user) return page(res, 404, { message: "No one with that username on Fync." });
        const s = await AskSettings.findOne({ user: user._id }).select("paused").lean();
        if (s?.paused) return page(res, 404, {});
        page(res, 200, { user, state: req.query.sent ? "sent" : "form" });
    } catch (err) {
        console.error("askPage:", err.message);
        res.status(500).type("html").send("Something went wrong");
    }
};

/** POST /ask/:username { text, website } — JSON from the page script, or a plain form post. */
export const sendAsk = async (req, res) => {
    const json = req.is("application/json") || req.accepts(["html", "json"]) === "json";
    const reply = (status, message, user) => json
        ? res.status(status).json({ success: status < 300, message })
        : status < 300 ? res.redirect(303, `${req.originalUrl.split("?")[0]}?sent=1`) : page(res, user ? status : 404, { user, message });
    try {
        const user = await findRecipient(String(req.params.username));
        if (!user) return reply(404, "This link isn't active");
        const to = String(user._id);
        const ip = String(req.ip || "");
        const h = senderHash(ip, SECRET);
        try {
            // Counted before content checks so the filter can't be probed for free.
            if (!(await hit(`ask:rl:ipto:${h}:${to}`, 3600, LIMITS.ipTo))) return reply(429, "You've sent a lot here. Try again in an hour.", user);
            if (!(await hit(`ask:rl:ip:${h}`, 3600, LIMITS.ip))) return reply(429, "Too many messages. Try again in an hour.", user);
            if (!(await hit(`ask:rl:to:${to}`, 86400, LIMITS.to))) return reply(429, "Their inbox is full for today. Try tomorrow.", user);
        } catch {
            return reply(503, "Try again in a bit", user); // no Redis = no rate limits = fail closed
        }
        const s = await AskSettings.findOne({ user: user._id }).select("paused blocked").lean();
        if (s?.paused) return reply(404, "This link isn't active");
        const { text, error } = checkMessage({ text: req.body?.text, honeypot: req.body?.website });
        if (error) return reply(400, error, user);
        // Blocked senders get a normal "sent" so they can't tell (and route around it).
        if (isBlockedSender(s?.blocked, recentHashes(ip, SECRET))) return reply(201, "Sent", user);

        const now = new Date();
        await AskMessage.create({ to: user._id, text, senderHash: h, createdAt: now, expiresAt: expiresAt(now) });
        if (user.expoPushToken) {
            redisClient.set(`ask:push:${to}`, "1", { NX: true, EX: 300 }).then((ok) => ok && sendPushNotification(
                user.expoPushToken, "📩 New anonymous message", "Someone sent you a message. Tap to read it.",
                { type: "ask", screen: "AskInbox" },
            )).catch(() => {});
        }
        reply(201, "Sent", user);
    } catch (err) {
        console.error("sendAsk:", err.message);
        reply(500, "Could not send", null);
    }
};

/** GET /ask/card/:id.png?k= — answered Q&A story card, signed so ids can't be enumerated. */
export const askCard = async (req, res, next) => {
    try {
        const m = /^([a-f0-9]{24})\.png$/i.exec(String(req.params.file));
        if (!m || !sigOk(m[1], req.query.k, SECRET)) return res.status(404).end();
        const msg = await AskMessage.findOne({ _id: m[1], expiresAt: { $gt: new Date() }, answer: { $ne: null } })
            .select("text answer answeredAt to").populate("to", "username isBanned").lean();
        if (!msg?.to || msg.to.isBanned) return res.status(404).end();
        const buf = await cached(`ask:${msg._id}:${+new Date(msg.answeredAt)}`, () =>
            renderAskCard({ question: msg.text, answer: msg.answer, link: askLink(msg.to.username) }));
        res.type("image/png").set("Cache-Control", "public, max-age=600").send(buf);
    } catch (e) { next(e); }
};

// ---------- authed ----------

const shape = (m) => ({
    _id: m._id, text: m.text, answer: m.answer, answeredAt: m.answeredAt, createdAt: m.createdAt, expiresAt: m.expiresAt,
    cardUrl: m.answer ? cardUrl(m._id) : null,
});

/** GET /ask/inbox?before=<iso> — newest first, 50 per page. First page marks everything seen. */
export const inbox = async (req, res) => {
    try {
        const me = req.user._id;
        const before = req.query.before ? new Date(String(req.query.before)) : null;
        const extra = before && !isNaN(before) ? { createdAt: { $lt: before } } : {};
        const [items, s] = await Promise.all([
            AskMessage.find(liveFilter(me, extra)).sort({ createdAt: -1 }).limit(50)
                .select("text answer answeredAt createdAt expiresAt").lean(),
            before ? null : AskSettings.findOne({ user: me }).select("lastSeenAt").lean(),
        ]);
        let unread = 0;
        if (!before) {
            const seen = s?.lastSeenAt ? new Date(s.lastSeenAt) : new Date(0);
            unread = items.filter((m) => m.createdAt > seen).length;
            await AskSettings.updateOne({ user: me }, { $set: { lastSeenAt: new Date() } }, { upsert: true });
        }
        res.json({ success: true, unread, lastSeenAt: s?.lastSeenAt || null, messages: items.map(shape), hasMore: items.length === 50 });
    } catch (err) {
        console.error("ask inbox:", err.message);
        fail(res, 500, "Could not load messages");
    }
};

/** GET /ask/me — my link, paused flag, counts. */
export const askMe = async (req, res) => {
    try {
        const me = req.user._id;
        const s = await AskSettings.findOne({ user: me }).select("paused lastSeenAt").lean();
        const [total, answered, unread] = await Promise.all([
            AskMessage.countDocuments(liveFilter(me)),
            AskMessage.countDocuments(liveFilter(me, { answer: { $ne: null } })),
            AskMessage.countDocuments(liveFilter(me, s?.lastSeenAt ? { createdAt: { $gt: s.lastSeenAt } } : {})),
        ]);
        res.json({ success: true, link: askLink(req.user.username), paused: Boolean(s?.paused), total, answered, unread, ttlDays: TTL_DAYS });
    } catch (err) {
        console.error("askMe:", err.message);
        fail(res, 500, "Could not load your link");
    }
};

/** PUT /ask/settings { paused } */
export const askSettings = async (req, res) => {
    try {
        if (typeof req.body?.paused !== "boolean") return fail(res, 400, "paused must be true or false");
        await AskSettings.updateOne({ user: req.user._id }, { $set: { paused: req.body.paused } }, { upsert: true });
        res.json({ success: true, paused: req.body.paused });
    } catch (err) {
        console.error("askSettings:", err.message);
        fail(res, 500, "Could not save");
    }
};

/** POST /ask/:id/answer { answer } */
export const answerAsk = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid message");
        const answer = cleanText(req.body?.answer);
        if (!answer) return fail(res, 400, "Write an answer first");
        if (answer.length > MAX_LEN) return fail(res, 400, `Keep it under ${MAX_LEN} characters`);
        const m = await AskMessage.findOneAndUpdate(liveFilter(req.user._id, { _id: req.params.id }),
            { $set: { answer, answeredAt: new Date() } }, { new: true, projection: "text answer answeredAt createdAt expiresAt" }).lean();
        if (!m) return fail(res, 404, "This message has expired");
        res.json({ success: true, message: shape(m) });
    } catch (err) {
        console.error("answerAsk:", err.message);
        fail(res, 500, "Could not save answer");
    }
};

/** DELETE /ask/:id */
export const deleteAsk = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid message");
        await AskMessage.deleteOne({ _id: req.params.id, to: req.user._id });
        res.json({ success: true });
    } catch (err) {
        console.error("deleteAsk:", err.message);
        fail(res, 500, "Could not delete");
    }
};

/** POST /ask/:id/block — that sender can't reach me for 7 days; their messages go too. */
export const blockAsk = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid message");
        const me = req.user._id;
        const m = await AskMessage.findOne({ _id: req.params.id, to: me }).select("senderHash").lean();
        if (!m) return fail(res, 404, "Message not found");
        const now = new Date();
        await AskSettings.updateOne({ user: me }, { $pull: { blocked: { exp: { $lte: now } } } });
        await AskSettings.updateOne({ user: me },
            { $push: { blocked: { $each: [{ h: m.senderHash, exp: new Date(now.getTime() + TTL_DAYS * DAY) }], $slice: -500 } } },
            { upsert: true });
        await AskMessage.deleteMany({ to: me, senderHash: m.senderHash });
        res.json({ success: true });
    } catch (err) {
        console.error("blockAsk:", err.message);
        fail(res, 500, "Could not block");
    }
};

/**
 * POST /ask/:id/report { reason } — the sender is anonymous, so this is filed straight
 * as a Report (fileReport needs a known target user); the admin gets the text and the
 * sender hash, which links other reports from the same sender that day.
 */
export const reportAsk = async (req, res) => {
    try {
        if (!isObjectId(req.params.id)) return fail(res, 400, "Invalid message");
        const m = await AskMessage.findOne({ _id: req.params.id, to: req.user._id }).select("text senderHash").lean();
        if (!m) return fail(res, 404, "Message not found");
        try {
            if (!(await takeReportSlot(redisClient, req.user.id))) return fail(res, 429, "Too many reports. Try again later.");
        } catch { /* Redis down: accept the report, same as fileReport */ }
        await Report.create({
            reporter: req.user._id, targetType: "chat_message", targetId: `ask:${m._id}:${m.senderHash}`,
            snapshot: `[Ask me anything] ${m.text}`.slice(0, 2000),
            reason: `[Ask] ${String(req.body?.reason || "Inappropriate content").trim().slice(0, 280)}`,
        });
        res.status(201).json({ success: true, message: "Report submitted. Thanks for keeping Fync safe." });
    } catch (err) {
        console.error("reportAsk:", err.message);
        fail(res, 500, "Could not report");
    }
};
