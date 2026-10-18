import Razorpay from "razorpay";
import mongoose from "mongoose";
import User from "../models/user.model.js";
import dotenv from "dotenv";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { Jimp } from "jimp";
import jsQR from "jsqr";
import RegisterSpeakerSession from "../models/events/registerSpeakerSession.model.js";
import RegisterBootcamp from "../models/events/registerBootcamp.model.js";
import Community from "../models/community/community.model.js";
import PaymentOrder from "../models/paymentOrder.model.js";
import { resolvePurchase } from "../utils/pricing.js";
import { redeemPaidOrder, PaymentError } from "../utils/redeemOrder.js";
import { markGiftPaid } from "./gift.controller.js";
dotenv.config({ quiet: true });

// resolvePurchase throws plain Errors for anything the caller got wrong; this
// keeps those as 400s instead of 500s.
class PriceError extends Error {}


const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export const createOrder = async (req, res, next) => {
  try {
    const { purpose, ...options } = req.body;

    // The amount is resolved from the server-side catalog. It used to be taken
    // straight from req.body, so any price could be sent for any product.
    let priced;
    try {
      priced = await resolvePurchase(purpose, options, req.user.id);
    } catch (e) {
      throw Object.assign(new PriceError(e.message), { cause: e });
    }
    const { amount, meta } = priced;

    const order = await razorpay.orders.create({
      amount,
      currency: "INR",
      // Must be unique per order; the old `receipt_${Math.random()*10000}`
      // collided roughly once every hundred orders.
      receipt: `rcpt_${randomUUID()}`,
      notes: { purpose, userId: req.user.id },
    });

    await PaymentOrder.create({
      razorpayOrderId: order.id,
      user: req.user.id,
      purpose,
      amount,
      meta,
    });

    // Only what the checkout sheet needs.
    res.json({ id: order.id, amount: order.amount, currency: order.currency, receipt: order.receipt });
  } catch (err) {
    if (err instanceof PriceError) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

export const verifyOrder = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // One implementation of "is this receipt real, unspent, and for this
    // user" — shared with the funding, notice and interview endpoints, which
    // each used to carry their own weaker copy.
    let order;
    try {
      order = await redeemPaidOrder({
        orderId: razorpay_order_id,
        paymentId: razorpay_payment_id,
        signature: razorpay_signature,
        userId: req.user.id,
        // No purpose: this endpoint reads order.purpose to decide what to grant.
      });
    } catch (e) {
      if (e instanceof PaymentError) {
        // A replayed verify is the normal double-tap case, not an error the
        // student should see.
        if (e.status === 409) return res.json({ success: true, alreadyProcessed: true });
        return res.status(e.status).json({ success: false, message: e.message });
      }
      throw e;
    }

    // Entitlements are granted from `order.meta`, which the server wrote at
    // creation time — not from the notes echoed back by Razorpay, which
    // originate on the client and were previously trusted.
    await grantEntitlement(order);

    res.json({ success: true, orderId: order.razorpayOrderId, purpose: order.purpose });
  } catch (err) {
    next(err);
  }
};

// Applies whatever the user just paid for. Runs before the response so a
// failure surfaces as an error instead of a success with nothing delivered.
export const grantEntitlement = async (order) => {
  const { purpose, meta } = order;

  if (purpose === "community_spark") {
    const community = await Community.findById(meta.communityId);
    if (!community) return;
    const now = new Date();
    const days = meta.plan === "yearly" ? 365 : 30;
    const current = community.subscription?.expiryDate;
    // Stack onto remaining time rather than truncating it.
    const base = current && new Date(current) > now ? new Date(current) : now;
    community.subscription.expiryDate = new Date(base.getTime() + days * 86400000);
    community.subscription.status = "active";
    community.subscription.lastPaymentDate = now;
    await community.save();
    return;
  }

  if (purpose === "speaker_session" && meta.registrationId) {
    await RegisterSpeakerSession.findByIdAndUpdate(meta.registrationId, { isPaid: true });
    return;
  }

  if (purpose === "bootcamp" && meta.registrationId) {
    await RegisterBootcamp.findByIdAndUpdate(meta.registrationId, { isPaid: true });
    return;
  }

  // Idempotent: verify and the webhook both land here for the same payment.
  if (purpose === "couple_gift" && meta.giftOrderId) {
    await markGiftPaid(order);
  }
};

export const scanQRImage = async (req, res) => {
  try {
    console.log("📸 scanQRImage: Processing file...");
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, message: "No image provided" });
    }

    const image = await Jimp.read(req.file.buffer);
    const { width: originalWidth, height: originalHeight } = image.bitmap;
    console.log(`📸 scanQRImage: Original Dim=${originalWidth}x${originalHeight}`);

    // Helper to run jsQR with specific settings
    const attemptScan = (img, allowInversion = false) => {
      const { width, height, data } = img.bitmap;
      const clampedData = new Uint8ClampedArray(data);
      return jsQR(clampedData, width, height, {
        inversionAttempts: allowInversion ? "attemptBoth" : "dontInvert",
      });
    };

    // STAGE 1: Fast scan (Original)
    let qrCode = attemptScan(image);

    // STAGE 2: Optimized Resize (800-1000px is usually the goldilocks zone for jsQR)
    if (!qrCode && originalWidth > 1000) {
      console.log("📸 scanQRImage: Retrying with moderate resize...");
      qrCode = attemptScan(image.clone().resize({ w: 800 }));
    }

    // STAGE 3: High Contrast + Grayscale
    if (!qrCode) {
      console.log("📸 scanQRImage: Retrying with high-contrast grayscale...");
      qrCode = attemptScan(image.clone().greyscale().contrast(0.4));
    }

    // STAGE 4: Small Scan (For very busy images)
    if (!qrCode) {
      console.log("📸 scanQRImage: Retrying with low-res high-contrast...");
      qrCode = attemptScan(image.clone().resize({ w: 500 }).greyscale().contrast(0.5));
    }

    // STAGE 5: The "Kitchen Sink" (Inversion + Blur + Sharpness check)
    if (!qrCode) {
      console.log("📸 scanQRImage: Final attempt with inversion check...");
      // Some dark mode apps might invert the QR pattern
      qrCode = attemptScan(image.clone().greyscale().contrast(0.6), true);
    }

    if (qrCode) {
      console.log("✅ QR Decoded:", qrCode.data);
      return res.status(200).json({ success: true, data: qrCode.data });
    } else {
      console.log("❌ No QR detected after 5 distinct preprocessing stages.");
      return res.status(400).json({
        success: false,
        message: "No QR code could be read. Please ensure the QR is well-lit, clearly visible, and not covered by shadows."
      });
    }
  } catch (error) {
    console.error("🔥 Scan QR Error:", error);
    res.status(500).json({ success: false, message: "Failed to process the QR image. Please try another photo." });
  }
};


/**
 * GET /payment/admin/orders — the payment ledger behind the admin portal.
 *
 * Cursor-paged rather than skip/limit: payments arrive while an admin is
 * scrolling, and every new one shifts a skip window by a row, so page 2 would
 * repeat a payment page 1 already showed and silently drop another. The cursor
 * is the last row's (createdAt, _id), so the next page continues from a fixed
 * point no matter what lands meanwhile.
 */
export const listOrdersForAdmin = async (req, res, next) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const { status, purpose, search, cursor } = req.query;

    const filter = {};
    if (status && ["created", "paid", "failed"].includes(status)) filter.status = status;
    if (purpose) filter.purpose = purpose;

    // Support queries like "a student says they paid but got nothing" — the
    // reference they can read off their bank statement is the payment id.
    if (search) {
      const term = String(search).trim();
      if (term) {
        const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const rx = new RegExp(escaped, "i");
        const matchingUsers = await User.find({
          $or: [{ name: rx }, { username: rx }, { email: rx }],
        })
          .select("_id")
          .limit(50)
          .lean();

        filter.$or = [
          { razorpayOrderId: rx },
          { razorpayPaymentId: rx },
          ...(matchingUsers.length ? [{ user: { $in: matchingUsers.map((u) => u._id) } }] : []),
        ];
      }
    }

    // Keyset pagination. `_id` breaks ties so two payments in the same
    // millisecond cannot hide each other.
    if (cursor) {
      try {
        const [ts, id] = Buffer.from(String(cursor), "base64").toString("utf8").split("|");
        const at = new Date(ts);
        if (!Number.isNaN(at.getTime()) && mongoose.isValidObjectId(id)) {
          filter.$and = [
            ...(filter.$and ?? []),
            {
              $or: [
                { createdAt: { $lt: at } },
                { createdAt: at, _id: { $lt: new mongoose.Types.ObjectId(id) } },
              ],
            },
          ];
        }
      } catch {
        // A malformed cursor just starts from the top rather than 500ing.
      }
    }

    // One extra row tells us whether another page exists without a count.
    const rows = await PaymentOrder.find(filter)
      .populate("user", "name username email avatar college")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;

    const nextCursor = hasMore && page.length
      ? Buffer.from(
          `${new Date(page[page.length - 1].createdAt).toISOString()}|${page[page.length - 1]._id}`
        ).toString("base64")
      : null;

    res.json({
      success: true,
      orders: page.map((o) => ({
        _id: o._id,
        // What the student can quote from their statement.
        orderId: o.razorpayOrderId,
        paymentId: o.razorpayPaymentId ?? null,
        status: o.status,
        purpose: o.purpose,
        amount: o.amount,
        currency: o.currency ?? "INR",
        meta: o.meta ?? {},
        user: o.user
          ? {
              _id: o.user._id,
              name: o.user.name,
              username: o.user.username,
              email: o.user.email,
              avatar: o.user.avatar,
              college: o.user.college,
            }
          : null,
        createdAt: o.createdAt,
        paidAt: o.paidAt ?? null,
      })),
      nextCursor,
      hasMore,
    });
  } catch (err) {
    next(err);
  }
};

/** GET /payment/admin/stats — headline numbers for the portal. */
export const paymentStatsForAdmin = async (req, res, next) => {
  try {
    const since = new Date();
    since.setDate(since.getDate() - 30);

    // One pass over the collection instead of five counts.
    const [facet] = await PaymentOrder.aggregate([
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 }, amount: { $sum: "$amount" } } }],
          revenue30d: [
            { $match: { status: "paid", paidAt: { $gte: since } } },
            { $group: { _id: null, amount: { $sum: "$amount" }, count: { $sum: 1 } } },
          ],
          byPurpose: [
            { $match: { status: "paid" } },
            { $group: { _id: "$purpose", count: { $sum: 1 }, amount: { $sum: "$amount" } } },
            { $sort: { amount: -1 } },
          ],
        },
      },
    ]);

    const bucket = (name) => facet.byStatus.find((s) => s._id === name) ?? { count: 0, amount: 0 };
    const paid = bucket("paid");

    res.json({
      success: true,
      stats: {
        pending: bucket("created").count,
        successful: paid.count,
        failed: bucket("failed").count,
        // Paise everywhere, like the rest of the payment code.
        grossCollected: paid.amount,
        last30Days: {
          amount: facet.revenue30d[0]?.amount ?? 0,
          count: facet.revenue30d[0]?.count ?? 0,
        },
        byPurpose: facet.byPurpose.map((p) => ({ purpose: p._id, count: p.count, amount: p.amount })),
      },
    });
  } catch (err) {
    next(err);
  }
};
