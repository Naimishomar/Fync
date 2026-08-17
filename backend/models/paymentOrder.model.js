import mongoose from "mongoose";

// Orders are recorded the moment we ask Razorpay to create one, so that at
// verification time we can answer three questions the signature alone cannot:
// who this order belongs to, what it was supposed to cost, and whether it has
// already been redeemed.
const paymentOrderSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },

    // What is being bought. The price comes from the server-side catalog keyed
    // by this value — never from the request body.
    purpose: { type: String, required: true },

    // Amount in paise, exactly as sent to Razorpay.
    amount: { type: Number, required: true },
    currency: { type: String, default: "INR" },

    // Server-validated context needed to grant the entitlement (community id,
    // plan, registration id). Read from here at verify time, never from the
    // notes echoed back by Razorpay, which originate on the client.
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },

    // 'created' -> 'paid' is a one-way atomic transition; it is what makes a
    // replayed verify request a no-op instead of a second entitlement.
    status: {
      type: String,
      enum: ["created", "paid", "failed"],
      default: "created",
      index: true,
    },
    razorpayPaymentId: { type: String },
    paidAt: { type: Date },
  },
  { timestamps: true }
);

// Sweeps unpaid orders so abandoned checkouts don't accumulate forever.
paymentOrderSchema.index({ createdAt: -1 });

const PaymentOrder = mongoose.model("PaymentOrder", paymentOrderSchema);
export default PaymentOrder;
