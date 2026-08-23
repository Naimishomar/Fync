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
 * Claim a paid order for `purpose`, or throw a PaymentError explaining why not.
 *
 * The claim is a single conditional update, so two concurrent requests cannot
 * both win it. Pass `purpose` to bind the receipt to one product; omit it only
 * where the caller reads `order.purpose` itself to decide what to grant.
 */
export const redeemPaidOrder = async ({
  orderId,
  paymentId,
  signature,
  userId,
  purpose,
  // Seam so the money path can be tested without reaching Razorpay.
  fetchPayment = (id) => razorpay().payments.fetch(id),
}) => {
  if (!orderId || !paymentId || !signature) {
    throw new PaymentError("Missing payment details");
  }
  if (!verifySignature(orderId, paymentId, signature)) {
    throw new PaymentError("Invalid payment signature");
  }

  const claim = { razorpayOrderId: orderId, user: userId, status: "created" };
  if (purpose) claim.purpose = purpose;

  const order = await PaymentOrder.findOneAndUpdate(
    claim,
    { status: "paid", razorpayPaymentId: paymentId, paidAt: new Date() },
    { new: true }
  );

  if (!order) {
    // Say precisely what went wrong, without confirming the existence of
    // another user's order.
    const existing = await PaymentOrder.findOne({ razorpayOrderId: orderId }).lean();
    if (!existing || String(existing.user) !== String(userId)) {
      throw new PaymentError("Order not found", 404);
    }
    if (purpose && existing.purpose !== purpose) {
      throw new PaymentError("That payment was made for something else", 400);
    }
    if (existing.status === "paid") {
      throw new PaymentError("This payment has already been used", 409);
    }
    if (existing.status === "failed") {
      throw new PaymentError("That payment did not go through", 400);
    }
    throw new PaymentError("Order not found", 404);
  }

  // The signature proves the ids are genuine; only Razorpay knows whether the
  // money was actually captured, and for how much.
  const payment = await fetchPayment(paymentId);
  const captured = payment.status === "captured" || payment.status === "authorized";
  const rightOrder = String(payment.order_id) === String(orderId);
  if (!captured || !rightOrder || Number(payment.amount) !== order.amount) {
    await PaymentOrder.updateOne({ _id: order._id }, { status: "failed" });
    throw new PaymentError("Payment not captured for the expected amount");
  }

  return order;
};

/**
 * Hand the order back when whatever it paid for could not be delivered, so the
 * student can retry instead of paying twice.
 */
export const releaseOrder = (order) =>
  PaymentOrder.updateOne(
    { _id: order._id, status: "paid" },
    { status: "created", $unset: { razorpayPaymentId: 1, paidAt: 1 } }
  );
