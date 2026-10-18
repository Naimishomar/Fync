import mongoose from "mongoose";
import { STATUSES } from "../../utils/giftRules.js";

const giftOrderSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: "GiftProduct" },
    // Snapshot: what was bought at what price, even if the product changes later.
    productSnapshot: { title: String, price: Number, image: String, deliveryDays: Number },
    customization: {
      photos: [String],
      text: String,
      options: { type: mongoose.Schema.Types.Mixed, default: {} },
    },
    // PII. select:false so it only leaves the database where a query opts in
    // (the buyer's own orders, the admin list).
    shipping: {
      type: {
        name: String, phone: String, line1: String, line2: String, landmark: String,
        city: String, state: String, pincode: String, surprise: Boolean, giftNote: String,
      },
      select: false,
    },
    amount: { type: Number, required: true }, // paise, server-computed
    status: { type: String, enum: STATUSES, default: "pending_payment", index: true },
    paymentOrderId: String, // razorpayOrderId of the PaymentOrder that paid it
    paidAt: Date,
    tracking: { courier: String, awb: String, url: String },
    statusHistory: [{ status: String, at: { type: Date, default: Date.now }, note: String, _id: false }],
  },
  { timestamps: true }
);

giftOrderSchema.index({ status: 1, createdAt: -1 });

export default mongoose.model("GiftOrder", giftOrderSchema);
