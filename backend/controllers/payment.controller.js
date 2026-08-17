import Razorpay from "razorpay";
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
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: "Missing payment details" });
    }

    const expected = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest();
    const received = Buffer.from(String(razorpay_signature), "hex");
    // Constant-time compare; timingSafeEqual throws on a length mismatch.
    if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
      return res.status(400).json({ success: false, message: "Invalid payment signature" });
    }

    // Atomically claim the order. A replayed request finds status already
    // 'paid' and matches nothing, so the entitlement is granted exactly once.
    const order = await PaymentOrder.findOneAndUpdate(
      { razorpayOrderId: razorpay_order_id, user: req.user.id, status: "created" },
      { status: "paid", razorpayPaymentId: razorpay_payment_id, paidAt: new Date() },
      { new: true }
    );

    if (!order) {
      const existing = await PaymentOrder.findOne({ razorpayOrderId: razorpay_order_id }).lean();
      if (existing && existing.status === "paid") {
        // Already processed — report success without granting anything again.
        return res.json({ success: true, alreadyProcessed: true });
      }
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Confirm with Razorpay that the money actually arrived, and in full. The
    // signature only proves the ids came from Razorpay, not that it was captured.
    const payment = await razorpay.payments.fetch(razorpay_payment_id);
    const captured = payment.status === "captured" || payment.status === "authorized";
    if (!captured || Number(payment.amount) !== order.amount) {
      await PaymentOrder.updateOne({ _id: order._id }, { status: "failed" });
      return res.status(400).json({ success: false, message: "Payment not captured for the expected amount" });
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
const grantEntitlement = async (order) => {
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

