// Fync Gifts: the pure rules — price, customization limits, address, status flow.
// Everything here runs at the trust boundary; the client's word is never taken.

export const STATUSES = ["pending_payment", "paid", "in_production", "shipped", "delivered", "cancelled", "refunded"];

// pending_payment -> paid happens only through the payment path, never by hand.
const NEXT = {
  pending_payment: ["paid", "cancelled"],
  paid: ["in_production", "cancelled", "refunded"],
  in_production: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"],
  delivered: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
};
export const canTransition = (from, to) => (NEXT[from] || []).includes(to);
export const ADMIN_STATUSES = STATUSES.filter((s) => s !== "pending_payment" && s !== "paid");

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * Normalise the admin-entered customization schema so the rest of the code can
 * trust its shape. Option values are { label, add } with `add` in paise.
 */
export const normalizeSchema = (c = {}) => {
  const photos = c.photos && Number(c.photos.max) > 0
    ? { min: Math.max(0, Math.min(Number(c.photos.min) || 0, 30)), max: Math.min(Number(c.photos.max), 30) }
    : null;
  if (photos && photos.min > photos.max) photos.min = photos.max;
  const text = c.text && Number(c.text.maxLen) > 0
    ? { label: str(c.text.label, 60) || "Message", maxLen: Math.min(Number(c.text.maxLen), 500), required: !!c.text.required }
    : null;
  const options = (Array.isArray(c.options) ? c.options : []).slice(0, 5).map((o) => ({
    name: str(o?.name, 40),
    values: (Array.isArray(o?.values) ? o.values : []).slice(0, 12).map((v) =>
      typeof v === "string"
        ? { label: str(v, 40), add: 0 }
        : { label: str(v?.label, 40), add: Math.max(0, Math.round(Number(v?.add) || 0)) }
    ).filter((v) => v.label),
  })).filter((o) => o.name && o.values.length);
  return { photos, text, options };
};

/**
 * Check a buyer's customization against the product's schema.
 * `photoPrefix` (our R2 public URL) stops anyone pointing an order at an
 * arbitrary host. Returns { ok, value } or { ok: false, error }.
 */
export const validateCustomization = (schema, input = {}, photoPrefix) => {
  const s = normalizeSchema(schema);
  const fail = (error) => ({ ok: false, error });

  const photos = Array.isArray(input.photos) ? input.photos : [];
  const max = s.photos?.max ?? 0;
  const min = s.photos?.min ?? 0;
  if (photos.length > max) return fail(max ? `Up to ${max} photos` : "This gift takes no photos");
  if (photos.length < min) return fail(`Add at least ${min} photo${min === 1 ? "" : "s"}`);
  for (const p of photos) {
    if (typeof p !== "string" || p.length > 500 || !/^https:\/\//.test(p)) return fail("Invalid photo");
    if (photoPrefix && !p.startsWith(photoPrefix)) return fail("Invalid photo");
  }

  let text = "";
  if (s.text) {
    text = typeof input.text === "string" ? input.text.trim() : "";
    if (text.length > s.text.maxLen) return fail(`${s.text.label} is too long (max ${s.text.maxLen})`);
    if (s.text.required && !text) return fail(`${s.text.label} is required`);
  }

  const picked = input.options && typeof input.options === "object" ? input.options : {};
  const options = {};
  for (const o of s.options) {
    const label = picked[o.name];
    const v = o.values.find((x) => x.label === label);
    if (!v) return fail(`Choose ${o.name}`);
    options[o.name] = v.label;
  }
  return { ok: true, value: { photos, text, options } };
};

/** Base price + every chosen option's surcharge, in paise. */
export const priceFor = (product, options = {}) => {
  const s = normalizeSchema(product.customization);
  let total = Number(product.price);
  for (const o of s.options) {
    const v = o.values.find((x) => x.label === options[o.name]);
    if (v) total += v.add;
  }
  if (!Number.isInteger(total) || total <= 0) throw new Error("Invalid price");
  return total;
};

const ADDRESS_LIMITS = { name: 60, line1: 150, line2: 150, landmark: 80, city: 60, state: 60, giftNote: 200 };

/** Shipping address (PII). Required fields, hard length caps, Indian phone + pincode. */
export const validateAddress = (a = {}) => {
  const v = {};
  for (const [k, max] of Object.entries(ADDRESS_LIMITS)) {
    const raw = typeof a[k] === "string" ? a[k].trim() : "";
    if (raw.length > max) return { ok: false, error: `${k} is too long` };
    v[k] = raw;
  }
  for (const k of ["name", "line1", "city", "state"]) {
    if (!v[k]) return { ok: false, error: `${k === "line1" ? "Address" : k[0].toUpperCase() + k.slice(1)} is required` };
  }
  const phone = String(a.phone ?? "").replace(/\D/g, "").replace(/^(91|0)(?=\d{10}$)/, "");
  if (!/^[6-9]\d{9}$/.test(phone)) return { ok: false, error: "Enter a valid 10-digit mobile number" };
  const pincode = String(a.pincode ?? "").trim();
  if (!/^[1-9]\d{5}$/.test(pincode)) return { ok: false, error: "Enter a valid 6-digit pincode" };
  return { ok: true, value: { ...v, phone, pincode, surprise: a.surprise === true } };
};
