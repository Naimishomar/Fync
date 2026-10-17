import crypto from "crypto";
import Razorpay from "razorpay";
import PaymentOrder from "../models/paymentOrder.model.js";

/**
 * Redeeming a Razorpay payment, exactly once, for exactly the thing it paid for.
 *
 * A valid signature only proves that Razorpay issued those two ids. It says
 * nothing about *what* was bought, *how much* arrived, or whether the same
 * receipt has already been spent. Endpoints that checked the signature alone
 * could be paid once — for the cheapest item in the catalog — and then handed
 * that receipt to any other paid feature, repeatedly.
 */

// Lazily built: index.js loads dotenv, and this module is imported from
// controllers that may be pulled in first.
let client;
const razorpay = () =>
  (client ??= new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  }));

export class PaymentError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

/** Constant-time, so a wrong signature leaks nothing through timing. */
export const verifySignature = (orderId, paymentId, signature) => {
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest();

  let received;
  try {
    received = Buffer.from(String(signature), "hex");
  } catch {
    return false;
  }
  // timingSafeEqual throws on a length mismatch, so guard first.
  return received.length === expected.length && crypto.timingSafeEqual(expected, received);
};

/**
 * Razorpay can report a payment as only `authorized`: the card was charged but
 * the money is not ours until it is captured, and an uncaptured authorization
 * is refunded automatically after a few days. Capture it here so "paid" always
 * means captured. True only for a captured payment.
 */
export const ensureCaptured = async (
  payment,
  capture = (id, amount, currency) => razorpay().payments.capture(id, amount, currency)
) => {
  if (payment?.status === "captured") return true;
  if (payment?.status !== "authorized") return false;
  try {
    const done = await capture(payment.id, payment.amount, payment.currency || "INR");
    return done?.status === "captured";
  } catch (e) {
    // Auto-capture got there first.
    if (/already been captured/i.test(e?.error?.description || e?.message || "")) return true;
    throw e;
  }
};

/**
 * Claim a paid order for `purpose`, or throw a PaymentError explaining why not.
 *
 * Pass `purpose` to bind the receipt to one product; omit it only where the
 * caller reads `order.purpose` itself to decide what to grant (/payment/verify).
 *
 * With a purpose, being *paid* and being *used* are separate: the Razorpay
 * webhook may settle the order before the app calls the create endpoint, so a
 * paid order for this same payment that nothing has consumed yet is still
 * redeemable — but only if it carries `meta.settledBy` (stamped by the webhook
 * and by releaseOrder). Orders delivered before that marker existed are paid
 * with no consumedAt too, and must stay spent. Consumption is `meta.consumedAt`, set atomically, so two
 * concurrent requests cannot both win it. Orders marked `meta.credit`
 * (interview sessions) are consumed elsewhere and are never stamped here.
 */
export const redeemPaidOrder = async ({
  orderId,
  paymentId,
  signature,
  userId,
  purpose,
  // Seams so the money path can be tested without reaching Razorpay.
  fetchPayment = (id) => razorpay().payments.fetch(id),
  capturePayment,
}) => {
  if (!orderId || !paymentId || !signature) {
    throw new PaymentError("Missing payment details");
  }
  if (!verifySignature(orderId, paymentId, signature)) {
    throw new PaymentError("Invalid payment signature");
  }

  // Say precisely what went wrong, without confirming the existence of
  // another user's order.
  const existing = await PaymentOrder.findOne({ razorpayOrderId: orderId }).lean();
  if (!existing || String(existing.user) !== String(userId)) {
    throw new PaymentError("Order not found", 404);
  }
  if (purpose && existing.purpose !== purpose) {
    throw new PaymentError("That payment was made for something else", 400);
  }
  const spent = () => new PaymentError("This payment has already been used", 409);
  if (existing.status === "paid" &&
      (!purpose || existing.razorpayPaymentId !== paymentId ||
       existing.meta?.consumedAt || !existing.meta?.settledBy)) {
    throw spent();
  }

  // The signature proves the ids are genuine; only Razorpay knows whether the
  // money was actually captured, and for how much. Asked before claiming, so a
  // Razorpay outage leaves nothing half-claimed.
  const payment = await fetchPayment(paymentId);
  const rightOrder = String(payment?.order_id) === String(orderId);
  if (!rightOrder || Number(payment?.amount) !== existing.amount ||
      !(await ensureCaptured(payment, capturePayment))) {
    throw new PaymentError("Payment not captured for the expected amount");
  }

  const now = new Date();
  const consume = purpose && !existing.meta?.credit ? { "meta.consumedAt": now } : {};

  // 'failed' is claimable too: a payment.failed webhook for one attempt does
  // not stop a later attempt on the same order from succeeding.
  let order = await PaymentOrder.findOneAndUpdate(
    { _id: existing._id, user: existing.user, status: { $in: ["created", "failed"] } },
    { $set: { status: "paid", razorpayPaymentId: paymentId, paidAt: now, ...consume } },
    { new: true }
  );
  if (!order && purpose) {
    // Already settled (by the webhook, or released after a failed delivery)
    // with this same payment, and not yet used.
    order = await PaymentOrder.findOneAndUpdate(
      {
        _id: existing._id, status: "paid", razorpayPaymentId: paymentId,
        "meta.settledBy": { $exists: true },
        "meta.consumedAt": { $exists: false },
      },
      { $set: { ...consume } },
      { new: true }
    );
  }
  if (!order) throw spent();
  return order;
};

/**
 * Hand the order back when whatever it paid for could not be delivered, so the
 * student can retry with the same receipt instead of paying twice. The money
 * did arrive, so it stays paid — only the consumption is undone.
 */
export const releaseOrder = (order) =>
  PaymentOrder.updateOne(
    { _id: order._id, status: "paid" },
    { $set: { "meta.settledBy": "release" }, $unset: { "meta.consumedAt": 1 } }
  );

/**
 * The still-open Razorpay order already raised for this registration, so a
 * re-register resumes the same checkout. Deleting the registration and raising
 * a new order orphaned the old one: a payment that still landed on it had no
 * registration left to unlock. Null when there is nothing to reuse.
 */
export const findOpenOrder = async ({ purpose, userId, registrationId, amount }) => {
  const open = await PaymentOrder.findOne({
    purpose,
    user: userId,
    amount,
    "meta.registrationId": String(registrationId),
    status: { $in: ["created", "failed"] },
  }).sort({ createdAt: -1 }).lean();
  if (!open) return null;
  return razorpay().orders.fetch(open.razorpayOrderId).catch(() => null);
};
