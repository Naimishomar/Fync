import mongoose from "mongoose";

const giftProductSchema = new mongoose.Schema(
  {
    // Seeded products carry a slug so concurrent first-run seeds cannot duplicate.
    slug: { type: String, unique: true, sparse: true },
    title: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, default: "", maxlength: 1000 },
    images: { type: [String], default: [] },
    price: { type: Number, required: true, min: 100 }, // paise
    category: { type: String, default: "other", trim: true, maxlength: 30 },
    // { photos: {min,max}, text: {label,maxLen,required}, options: [{name, values:[{label, add}]}] }
    customization: { type: mongoose.Schema.Types.Mixed, default: {} },
    deliveryDays: { type: Number, default: 7, min: 1, max: 60 },
    active: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

export default mongoose.model("GiftProduct", giftProductSchema);
