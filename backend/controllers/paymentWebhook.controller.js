import crypto from "crypto";
import PaymentOrder from "../models/paymentOrder.model.js";
import Subscription from "../models/subscription.model.js";
import { grantEntitlement } from "./payment.controller.js";
import { activateSubscription } from "./subscription.controller.js";

/**
 * Razorpay webhook — the safety net under every payment.
 *
 * The app calling /payment/verify is the happy path, and it usually works. But
 * the money moves at Razorpay, not here: if the student's screen locks, the
 * network drops, or the process is killed between paying and calling back, the
 * charge succeeded and nothing was granted. Razorpay tells us anyway, and
 * keeps telling us until we answer 200.
 *
 * Two rules follow from that:
 *   - It must be idempotent. Retries are normal, not exceptional.
 *   - It must answer 200 for anything it understood, even a duplicate.
 *     A non-200 makes Razorpay retry for hours.
 */

/**
 * The signature covers the exact bytes Razorpay sent. `express.json()` would
 * consume them and re-stringifying the parsed object does not reliably
 * reproduce the original, so this route is mounted with `express.raw`.
 */
const signatureMatches = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest();
  let received;
  try {
    received = Buffer.from(String(signature ?? ""), "hex");
  } catch {
    return false;
  }
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
};

/** Settle a PaymentOrder from a captured payment, exactly once. */
const settleOrder = async (orderId, payment) => {
  const claimed = await PaymentOrder.findOneAndUpdate(
    { razorpayOrderId: orderId, status: "created" },
    { status: "paid", razorpayPaymentId: payment.id, paidAt: new Date() },
    { new: true }
  );

  // Already settled by the app's verify call, or by an earlier delivery of
  // this same webhook. Nothing to do, and that is a success.
  if (!claimed) return { handled: true, duplicate: true };

  // Trust the amount we recorded at creation, not the one in the payload.
  if (Number(payment.amount) !== claimed.amount) {
    await PaymentOrder.updateOne({ _id: claimed._id }, { status: "failed" });
    console.error(
      `Webhook: amount mismatch on ${orderId} — expected ${claimed.amount}, got ${payment.amount}`
    );
    return { handled: true, mismatch: true };
  }

  await grantEntitlement(claimed);
  return { handled: true, granted: claimed.purpose };
};

/** Subscriptions live in their own collection, keyed by the same order id. */
const settleSubscription = async (orderId, payment) => {
  const subscription = await Subscription.findOne({ razorpayOrderId: orderId });
  if (!subscription) return { handled: false };
  if (subscription.status !== "pending") return { handled: true, duplicate: true };

  const claimed = await activateSubscription(subscription, payment.id);
  return { handled: true, granted: claimed ? "subscription" : undefined, duplicate: !claimed };
};

export const razorpayWebhook = async (req, res) => {
  // `express.raw` leaves a Buffer here; anything else means the route was
  // mounted after a body parser and the signature can never verify.
  const raw = Buffer.isBuffer(req.body) ? req.body : null;
  if (!raw) {
    console.error("Razorpay webhook: raw body missing — check the route is mounted before express.json()");
    return res.status(500).json({ success: false });
  }

  if (!signatureMatches(raw, req.headers["x-razorpay-signature"])) {
    // Deliberately terse: an attacker learns nothing about why.
    return res.status(400).json({ success: false });
  }

  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).json({ success: false });
  }

  try {
    const type = event.event;
    const payment = event.payload?.payment?.entity;

    if (type === "payment.captured" || type === "order.paid") {
      if (!payment?.order_id) return res.status(200).json({ success: true, ignored: true });

      let result = await settleOrder(payment.order_id, payment);
      if (!result.handled || result.duplicate) {
        // Not one of ours as a PaymentOrder — it may be a subscription.
        const sub = await settleSubscription(payment.order_id, payment);
        if (sub.handled) result = sub;
      }
      return res.status(200).json({ success: true, ...result });
    }

    if (type === "payment.failed") {
      if (payment?.order_id) {
        // Only a still-open order. A paid one that later reports failed needs
        // a human, not an automatic downgrade of something already granted.
        await PaymentOrder.updateOne(
          { razorpayOrderId: payment.order_id, status: "created" },
          { status: "failed" }
        );
      }
      return res.status(200).json({ success: true });
    }

    // Everything else is acknowledged so Razorpay stops retrying it.
    return res.status(200).json({ success: true, ignored: true });
  } catch (err) {
    // A 500 makes Razorpay retry, which is what we want for a transient fault.
    console.error("Razorpay webhook processing failed:", err);
    return res.status(500).json({ success: false });
  }
};
