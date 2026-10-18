import { uploadToR2 } from "../utils/r2.js";
import mongoose from "mongoose";
import GiftProduct from "../models/gift/giftProduct.model.js";
import GiftOrder from "../models/gift/giftOrder.model.js";
import User from "../models/user.model.js";
import { sendPushNotification } from "../utils/notification.js";
import { canTransition, ADMIN_STATUSES, normalizeSchema, validateCustomization, validateAddress, priceFor } from "../utils/giftRules.js";

/**
 * Fync Gifts. Ordering is two calls: POST /gifts/orders records the order as
 * pending_payment with a server-computed amount, then the client pays through
 * the one payment path (POST /payment/order { purpose: "couple_gift",
 * giftOrderId }). /payment/verify and the Razorpay webhook both reach
 * grantEntitlement -> markGiftPaid, which flips it to paid exactly once.
 */

const R = (n) => n * 100;
const ART = (p) => "https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/" + encodeURI(p);

// First-run catalog. Prices in paise — edit here before first launch, or any
// time afterwards from Admin Portal → Gift Shop (the DB copy wins once seeded).
const SEED_PRODUCTS = [
  {
    slug: "photo-album", title: "Memories Photo Album", category: "Albums", price: R(899), deliveryDays: 7,
    description: "A hardbound 20-page album of your favourite moments together, printed on matte photo paper.",
    images: [ART("assets/Camera with flash/3D/camera_with_flash_3d.png")],
    customization: { photos: { min: 10, max: 20 }, text: { label: "Cover title", maxLen: 40 }, options: [{ name: "Cover", values: [{ label: "Matte", add: 0 }, { label: "Leather", add: R(300) }] }] },
  },
  {
    slug: "custom-mug", title: "Couple Photo Mug", category: "Mugs", price: R(349), deliveryDays: 5,
    description: "Ceramic 330ml mug with your photo and a line only the two of you get.",
    images: [ART("assets/Hot beverage/3D/hot_beverage_3d.png")],
    customization: { photos: { min: 1, max: 2 }, text: { label: "Text on mug", maxLen: 30 }, options: [{ name: "Type", values: [{ label: "White", add: 0 }, { label: "Magic (reveals when hot)", add: R(150) }] }] },
  },
  {
    slug: "polaroid-set", title: "Polaroid Print Set", category: "Prints", price: R(299), deliveryDays: 5,
    description: "Retro polaroid-style prints with a handwritten-font caption strip. Comes with fairy lights and clips.",
    images: [ART("assets/Camera/3D/camera_3d.png")],
    customization: { photos: { min: 10, max: 30 }, text: { label: "Caption (printed on every print)", maxLen: 25 }, options: [{ name: "Pack", values: [{ label: "10 prints", add: 0 }, { label: "20 prints", add: R(150) }, { label: "30 prints", add: R(280) }] }] },
  },
  {
    slug: "couple-keychain", title: "Couple Keychain Pair", category: "Keepsakes", price: R(249), deliveryDays: 6,
    description: "Two matching keychains that fit together — engraved with your initials or a date.",
    images: [ART("assets/Key/3D/key_3d.png")],
    customization: { text: { label: "Engraving (initials/date)", maxLen: 16, required: true }, options: [{ name: "Finish", values: [{ label: "Steel", add: 0 }, { label: "Wood", add: R(50) }] }] },
  },
  {
    slug: "framed-print", title: "Framed Photo Print", category: "Prints", price: R(599), deliveryDays: 6,
    description: "Your photo, framed and ready for the wall or desk, with an optional quote.",
    images: [ART("assets/Framed picture/3D/framed_picture_3d.png")],
    customization: { photos: { min: 1, max: 1 }, text: { label: "Quote under photo", maxLen: 60 }, options: [{ name: "Size", values: [{ label: "A5", add: 0 }, { label: "A4", add: R(200) }] }, { name: "Frame", values: [{ label: "Black", add: 0 }, { label: "White", add: 0 }, { label: "Wood", add: R(100) }] }] },
  },
  {
    slug: "gift-hamper", title: "Date Night Hamper", category: "Hampers", price: R(1299), deliveryDays: 4,
    description: "Chocolates, a scented candle, a mini photo print and a handwritten card — boxed and ribboned.",
    images: [ART("assets/Wrapped gift/3D/wrapped_gift_3d.png")],
    customization: { photos: { min: 0, max: 1 }, text: { label: "Card message", maxLen: 200 }, options: [{ name: "Theme", values: [{ label: "Classic red", add: 0 }, { label: "Pastel", add: 0 }] }] },
  },
];

let seeding;
const seedOnce = () =>
  (seeding ??= (async () => {
    if (await GiftProduct.estimatedDocumentCount()) return;
    // ordered:false + unique slug: a second worker seeding at the same moment
    // just collides on the slugs instead of doubling the catalog.
    await GiftProduct.insertMany(SEED_PRODUCTS, { ordered: false }).catch((e) => {
      if (e?.code !== 11000 && !e?.writeErrors) throw e;
    });
  })().catch((e) => { seeding = undefined; throw e; }));

// Customization photos must be ones we uploaded (see utils/r2.js getR2PublicUrl).
const photoPrefix = () => {
  const base = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, "");
  return base ? `${base}/` : undefined;
};
// Upload responses go out through mediaUrlMiddleware, so the app holds
// MEDIA_PUBLIC_URL/... links; map them back to the stored R2 form before checking.
const toR2Url = (u) => {
  const media = process.env.MEDIA_PUBLIC_URL?.trim().replace(/\/$/, "");
  const r2 = process.env.R2_PUBLIC_URL?.trim().replace(/\/$/, "");
  return typeof u === "string" && media && r2 && u.startsWith(`${media}/`) ? r2 + u.slice(media.length) : u;
};
const bad = (res, message, code = 400) => res.status(code).json({ success: false, message });
const isId = (id) => mongoose.isValidObjectId(id);

/* ------------------------------------------------------------------ public */

export const listProducts = async (req, res, next) => {
  try {
    await seedOnce();
    const products = await GiftProduct.find({ active: true }).select("-slug").sort({ createdAt: 1 }).lean();
    res.json({ success: true, products });
  } catch (e) { next(e); }
};

export const getProduct = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Not found", 404);
    const product = await GiftProduct.findOne({ _id: req.params.id, active: true }).select("-slug").lean();
    if (!product) return bad(res, "This gift is no longer available", 404);
    res.json({ success: true, product });
  } catch (e) { next(e); }
};

/** Photos for a customization (or an admin's product images). */
export const uploadPhotos = (req, res) => {
  // The shared multer filter also passes PDFs; a gift photo has to be an image.
  const urls = (req.files || []).filter((f) => /^image\//.test(f.mimetype)).map((f) => f.path).filter(Boolean);
  if (!urls.length) return bad(res, "Upload a JPG, PNG or WebP photo");
  res.json({ success: true, urls });
};

const EXT = { "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/heic": ".heic", "image/heif": ".heif" };

/** Full-resolution print photo: stored byte-for-byte, plus a `_sm` preview. */
export const uploadPrintPhoto = async (req, res, next) => {
  try {
    const f = req.file;
    if (!f) return bad(res, "Upload a JPG, PNG, WebP or HEIC photo");
    const ext = EXT[String(f.mimetype).toLowerCase()];
    if (!ext) return bad(res, "Upload a JPG, PNG, WebP or HEIC photo");
    const url = await uploadToR2(f.buffer, "gift_prints", `photo${ext}`, f.mimetype, { keepOriginal: true });
    res.json({ success: true, url, urls: [url] });
  } catch (e) { next(e); }
};

export const createGiftOrder = async (req, res, next) => {
  try {
    const { productId, customization, shipping } = req.body || {};
    if (!isId(productId)) return bad(res, "Choose a gift");
    const product = await GiftProduct.findOne({ _id: productId, active: true }).lean();
    if (!product) return bad(res, "This gift is no longer available");

    if (Array.isArray(customization?.photos)) customization.photos = customization.photos.map(toR2Url);
    const c = validateCustomization(product.customization, customization, photoPrefix());
    if (!c.ok) return bad(res, c.error);
    const a = validateAddress(shipping);
    if (!a.ok) return bad(res, a.error);

    const amount = priceFor(product, c.value.options);
    const order = await GiftOrder.create({
      buyer: req.user.id,
      product: product._id,
      productSnapshot: { title: product.title, price: product.price, image: product.images?.[0], deliveryDays: product.deliveryDays },
      customization: c.value,
      shipping: a.value,
      amount,
      statusHistory: [{ status: "pending_payment" }],
    });
    res.status(201).json({ success: true, giftOrderId: order._id, amount });
  } catch (e) { next(e); }
};

/** The buyer's own orders. Unpaid drafts are left out. */
export const myGiftOrders = async (req, res, next) => {
  try {
    const orders = await GiftOrder.find({ buyer: req.user.id, status: { $ne: "pending_payment" } })
      .select("+shipping").sort({ createdAt: -1 }).limit(100).lean();
    res.json({ success: true, orders });
  } catch (e) { next(e); }
};

/* ---------------------------------------------------------- payment hook */

/**
 * Called from grantEntitlement, by /payment/verify and by the webhook — often
 * both for one payment. The pending_payment filter makes the second a no-op.
 */
export const markGiftPaid = async (paymentOrder) => {
  const now = new Date();
  const updated = await GiftOrder.findOneAndUpdate(
    { _id: paymentOrder.meta?.giftOrderId, buyer: paymentOrder.user, amount: paymentOrder.amount, status: "pending_payment" },
    { $set: { status: "paid", paidAt: now, paymentOrderId: paymentOrder.razorpayOrderId }, $push: { statusHistory: { status: "paid", at: now } } },
    { new: true }
  );
  return Boolean(updated);
};

/** Full refund seen by the webhook. */
export const markGiftRefunded = (giftOrderId) =>
  GiftOrder.updateOne(
    { _id: giftOrderId, status: { $in: ["paid", "in_production", "shipped", "delivered", "cancelled"] } },
    { $set: { status: "refunded" }, $push: { statusHistory: { status: "refunded", at: new Date(), note: "Refund processed" } } }
  );

/* ------------------------------------------------------------------- admin */

const cleanProduct = (b = {}) => {
  const out = {};
  if (b.title !== undefined) out.title = String(b.title).trim().slice(0, 80);
  if (b.description !== undefined) out.description = String(b.description).slice(0, 1000);
  if (b.category !== undefined) out.category = String(b.category).trim().slice(0, 30) || "other";
  if (b.price !== undefined) {
    const p = Math.round(Number(b.price));
    if (!Number.isInteger(p) || p < 100) throw new Error("Price must be at least ₹1 (100 paise)");
    out.price = p;
  }
  if (b.deliveryDays !== undefined) out.deliveryDays = Math.min(60, Math.max(1, Math.round(Number(b.deliveryDays) || 7)));
  if (b.images !== undefined) out.images = (Array.isArray(b.images) ? b.images : []).filter((u) => typeof u === "string" && /^https:\/\//.test(u)).slice(0, 8);
  if (b.customization !== undefined) out.customization = normalizeSchema(b.customization);
  if (b.active !== undefined) out.active = b.active === true;
  return out;
};

export const adminListProducts = async (req, res, next) => {
  try {
    await seedOnce();
    res.json({ success: true, products: await GiftProduct.find().sort({ createdAt: 1 }).lean() });
  } catch (e) { next(e); }
};

export const adminCreateProduct = async (req, res, next) => {
  try {
    let data;
    try { data = cleanProduct(req.body); } catch (e) { return bad(res, e.message); }
    if (!data.title || !data.price) return bad(res, "Title and price are required");
    res.status(201).json({ success: true, product: await GiftProduct.create(data) });
  } catch (e) { next(e); }
};

export const adminUpdateProduct = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Not found", 404);
    let data;
    try { data = cleanProduct(req.body); } catch (e) { return bad(res, e.message); }
    if (data.title === "") return bad(res, "Title is required");
    const product = await GiftProduct.findByIdAndUpdate(req.params.id, { $set: data }, { new: true, runValidators: true });
    if (!product) return bad(res, "Not found", 404);
    res.json({ success: true, product });
  } catch (e) { next(e); }
};

// Orders keep their own snapshot, so deleting a product never breaks one.
export const adminDeleteProduct = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Not found", 404);
    await GiftProduct.deleteOne({ _id: req.params.id });
    res.json({ success: true });
  } catch (e) { next(e); }
};

/** Paid orders only, newest first. `before` = last row's createdAt for the next page. */
export const adminListOrders = async (req, res, next) => {
  try {
    const { status, before } = req.query;
    const filter = { status: { $ne: "pending_payment" } };
    if (typeof status === "string" && status && status !== "pending_payment") filter.status = status;
    const at = before ? new Date(String(before)) : null;
    if (at && !Number.isNaN(at.getTime())) filter.createdAt = { $lt: at };
    const rows = await GiftOrder.find(filter)
      .select("+shipping")
      .populate("buyer", "name username email avatar college")
      .sort({ createdAt: -1 }).limit(31).lean();
    res.json({ success: true, orders: rows.slice(0, 30), hasMore: rows.length > 30 });
  } catch (e) { next(e); }
};

const STATUS_PUSH = {
  in_production: "is being made 🎨",
  shipped: "has shipped 🚚",
  delivered: "was delivered 💝",
  cancelled: "was cancelled",
  refunded: "was refunded",
};

export const adminUpdateOrder = async (req, res, next) => {
  try {
    if (!isId(req.params.id)) return bad(res, "Not found", 404);
    const { status, tracking, note } = req.body || {};
    const order = await GiftOrder.findOne({ _id: req.params.id, status: { $ne: "pending_payment" } });
    if (!order) return bad(res, "Not found", 404);

    const statusChanged = status && status !== order.status;
    if (statusChanged) {
      if (!ADMIN_STATUSES.includes(status) || !canTransition(order.status, status)) {
        return bad(res, `Cannot move an order from ${order.status} to ${status}`);
      }
      order.status = status;
      order.statusHistory.push({ status, at: new Date(), note: typeof note === "string" ? note.slice(0, 200) : undefined });
    }
    if (tracking && typeof tracking === "object") {
      const t = (v, n) => (typeof v === "string" ? v.trim().slice(0, n) : undefined);
      const url = t(tracking.url, 300);
      if (url && !/^https?:\/\//.test(url)) return bad(res, "Tracking link must start with http(s)://");
      order.tracking = { courier: t(tracking.courier, 60), awb: t(tracking.awb, 60), url };
    }
    await order.save();

    if (statusChanged && STATUS_PUSH[status]) {
      const buyer = await User.findById(order.buyer).select("expoPushToken").lean();
      if (buyer?.expoPushToken) {
        const extra = status === "shipped" && order.tracking?.awb ? ` ${order.tracking.courier || "AWB"} ${order.tracking.awb}` : "";
        sendPushNotification(buyer.expoPushToken, "Fync Gifts", `Your ${order.productSnapshot?.title || "gift"} ${STATUS_PUSH[status]}.${extra}`, { type: "gift_order", orderId: String(order._id) })
          .catch(() => {});
      }
    }
    res.json({ success: true, order });
  } catch (e) { next(e); }
};
