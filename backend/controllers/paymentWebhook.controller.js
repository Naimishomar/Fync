import crypto from "crypto";
import PaymentOrder from "../models/paymentOrder.model.js";
import Subscription from "../models/subscription.model.js";
import { grantEntitlement } from "./payment.controller.js";
import { activateSubscription } from "./subscription.controller.js";
import { markGiftRefunded } from "./gift.controller.js";
import User from "../models/user.model.js";
import RegisterSpeakerSession from "../models/events/registerSpeakerSession.model.js";
import RegisterBootcamp from "../models/events/registerBootcamp.model.js";

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
  const order = await PaymentOrder.findOne({ razorpayOrderId: orderId }).lean();
  if (!order) return { handled: false };

  // Trust the amount we recorded at creation, not the one in the payload.
  if (Number(payment.amount) !== order.amount) {
    await PaymentOrder.updateOne({ _id: order._id, status: "created" }, { status: "failed" });
    console.error(
      `Webhook: amount mismatch on ${orderId} — expected ${order.amount}, got ${payment.amount}`
    );
    return { handled: true, mismatch: true };
  }

  // 'failed' too: an earlier attempt's payment.failed does not cancel a later
  // attempt on the same order that went through.
  const claimed = await PaymentOrder.findOneAndUpdate(
    { _id: order._id, status: { $in: ["created", "failed"] } },
    // settledBy: lets the create endpoint (redeemPaidOrder) still redeem it once.
    { status: "paid", razorpayPaymentId: payment.id, paidAt: new Date(), "meta.settledBy": "webhook" },
    { new: true }
  );

  // Already settled by the app's verify call, or by an earlier delivery of
  // this same webhook. Nothing to do, and that is a success.
  if (!claimed) return { handled: true, duplicate: true };

  await grantEntitlement(claimed);
  return { handled: true, granted: claimed.purpose };
};

/**
 * A refund takes back what the money bought, where that is a simple flip;
 * everything else is flagged on the order (meta.refundedAt) for the admin
 * ledger. Partial refunds are only flagged.
 */
const handleRefund = async (refund, payment) => {
  const paymentId = refund?.payment_id || payment?.id;
  if (!paymentId) return { handled: false };
  const full = payment
    ? Number(payment.amount_refunded) >= Number(payment.amount)
    : false;

  const order = await PaymentOrder.findOneAndUpdate(
    { razorpayPaymentId: paymentId },
    { $set: { "meta.refundedAt": new Date(), "meta.refundId": refund?.id, "meta.refundFull": full } },
    { new: true }
  );
  if (order && full) {
    if (order.purpose === "speaker_session" && order.meta?.registrationId) {
      await RegisterSpeakerSession.findByIdAndUpdate(order.meta.registrationId, { isPaid: false });
    }
    if (order.purpose === "bootcamp" && order.meta?.registrationId) {
      await RegisterBootcamp.findByIdAndUpdate(order.meta.registrationId, { isPaid: false });
    }
    if (order.purpose === "couple_gift" && order.meta?.giftOrderId) {
      await markGiftRefunded(order.meta.giftOrderId);
    }
  }

  if (full) {
    const sub = await Subscription.findOneAndUpdate(
      { razorpayPaymentId: paymentId, status: "active" },
      { status: "expired", endDate: new Date() },
      { new: true }
    );
    if (sub && !(await Subscription.exists({ user: sub.user, status: "active", endDate: { $gt: new Date() } }))) {
      await User.findByIdAndUpdate(sub.user, { is_subscribed: false });
    }
  }
  return { handled: true, refunded: Boolean(order) || full };
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

    if (type === "refund.processed") {
      const result = await handleRefund(event.payload?.refund?.entity, payment);
      return res.status(200).json({ success: true, ...result });
    }

    // Everything else is acknowledged so Razorpay stops retrying it.
    return res.status(200).json({ success: true, ignored: true });
  } catch (err) {
    // A 500 makes Razorpay retry, which is what we want for a transient fault.
    console.error("Razorpay webhook processing failed:", err);
    return res.status(500).json({ success: false });
  }
};
