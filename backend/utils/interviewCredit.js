import PaymentOrder from "../models/paymentOrder.model.js";
import { redeemPaidOrder, PaymentError } from "./redeemOrder.js";

/**
 * A paid interview_session PaymentOrder that no session has used yet is the
 * student's credit. Verify (or the Razorpay webhook) marks it paid; /start
 * spends it. Kept apart from payment so a failed start never loses the money.
 */
const PURPOSE = "interview_session";
const unused = (userId) => ({
  user: userId,
  purpose: PURPOSE,
  status: "paid",
  "meta.credit": true,
  "meta.consumedAt": { $exists: false },
});

/**
 * Verify, idempotently: if the webhook (or an earlier verify) already settled
 * this exact payment, that is a success, not a 409 — the credit exists once.
 */
export const redeemInterviewOrder = async (args) => {
  try {
    return await redeemPaidOrder({ ...args, purpose: PURPOSE });
  } catch (e) {
    // 409 is only reachable after the signature checked out.
    if (!(e instanceof PaymentError) || e.status !== 409) throw e;
    const settled = await PaymentOrder.findOne({
      razorpayOrderId: args.orderId,
      user: args.userId,
      purpose: PURPOSE,
      razorpayPaymentId: args.paymentId,
    });
    if (!settled) throw e;
    return settled;
  }
};

export const findInterviewCredit = (userId) =>
  PaymentOrder.findOne(unused(userId)).sort({ paidAt: 1 }).lean();

/** Spend one credit atomically; null when there is none. */
export const claimInterviewCredit = (userId) =>
  PaymentOrder.findOneAndUpdate(
    unused(userId),
    { $set: { "meta.consumedAt": new Date() } },
    { new: true, sort: { paidAt: 1 } }
  );

/** Start failed after claiming: hand the credit back so a retry is free. */
export const releaseInterviewCredit = (credit) =>
  PaymentOrder.updateOne({ _id: credit._id }, { $unset: { "meta.consumedAt": 1 } });
