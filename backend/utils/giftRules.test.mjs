// Run: node utils/giftRules.test.mjs
import assert from "node:assert/strict";
import { canTransition, priceFor, validateCustomization, validateAddress, normalizeSchema } from "./giftRules.js";

// ── status flow ─────────────────────────────────────────────────────────────
assert.ok(canTransition("pending_payment", "paid"));
assert.ok(canTransition("paid", "in_production"));
assert.ok(canTransition("in_production", "shipped"));
assert.ok(canTransition("shipped", "delivered"));
assert.ok(canTransition("delivered", "refunded"));
assert.ok(!canTransition("pending_payment", "shipped"), "cannot ship an unpaid order");
assert.ok(!canTransition("delivered", "in_production"), "no going backwards");
assert.ok(!canTransition("refunded", "paid"), "refunded is terminal");
assert.ok(!canTransition("bogus", "paid"));

// ── price ───────────────────────────────────────────────────────────────────
const mug = {
  price: 39900,
  customization: {
    photos: { min: 1, max: 2 },
    text: { label: "Name on mug", maxLen: 20 },
    options: [{ name: "Size", values: [{ label: "Regular", add: 0 }, { label: "Large", add: 10000 }] }, { name: "Colour", values: ["White", "Black"] }],
  },
};
assert.equal(priceFor(mug, { Size: "Regular", Colour: "White" }), 39900);
assert.equal(priceFor(mug, { Size: "Large", Colour: "Black" }), 49900);
assert.equal(priceFor(mug, { Size: "Huge" }), 39900, "unknown option adds nothing (validation rejects it separately)");
assert.throws(() => priceFor({ price: 0, customization: {} }, {}));
assert.equal(priceFor({ price: 100, customization: { options: [{ name: "X", values: [{ label: "a", add: -500 }] }] } }, { X: "a" }), 100, "negative surcharge clamped");

// ── customization ───────────────────────────────────────────────────────────
const R2 = "https://cdn.fync.in";
const ok = validateCustomization(mug.customization, { photos: [`${R2}/a.webp`], text: " Riya ", options: { Size: "Large", Colour: "White" } }, R2);
assert.equal(ok.ok, true);
assert.equal(ok.value.text, "Riya");
assert.deepEqual(ok.value.options, { Size: "Large", Colour: "White" });
assert.equal(validateCustomization(mug.customization, { photos: [], options: { Size: "Large", Colour: "White" } }, R2).ok, false, "min photos");
assert.equal(validateCustomization(mug.customization, { photos: [1, 2, 3].map((i) => `${R2}/${i}`), options: { Size: "Large", Colour: "White" } }, R2).ok, false, "max photos");
assert.equal(validateCustomization(mug.customization, { photos: ["https://evil.example/x.jpg"], options: { Size: "Large", Colour: "White" } }, R2).ok, false, "foreign host");
assert.equal(validateCustomization(mug.customization, { photos: [`${R2}/a`], text: "x".repeat(21), options: { Size: "Large", Colour: "White" } }, R2).ok, false, "text too long");
assert.equal(validateCustomization(mug.customization, { photos: [`${R2}/a`], options: { Size: "Large" } }, R2).ok, false, "option missing");
assert.equal(validateCustomization(mug.customization, { photos: [`${R2}/a`], options: { Size: "Huge", Colour: "White" } }, R2).ok, false, "option value not offered");
assert.equal(validateCustomization({}, { photos: [`${R2}/a`] }, R2).ok, false, "no photos allowed");
assert.equal(normalizeSchema({ photos: { min: 9, max: 3 } }).photos.min, 3);

// ── address ─────────────────────────────────────────────────────────────────
const addr = { name: "Riya", phone: "+91 98765 43210", line1: "Hostel 4, Room 12", city: "Pune", state: "MH", pincode: "411001" };
const a = validateAddress(addr);
assert.equal(a.ok, true);
assert.equal(a.value.phone, "9876543210");
assert.equal(a.value.surprise, false);
assert.equal(validateAddress({ ...addr, surprise: "yes" }).value.surprise, false, "only literal true");
assert.equal(validateAddress({ ...addr, phone: "12345" }).ok, false);
assert.equal(validateAddress({ ...addr, phone: "5876543210" }).ok, false, "IN mobiles start 6-9");
assert.equal(validateAddress({ ...addr, pincode: "011001" }).ok, false);
assert.equal(validateAddress({ ...addr, pincode: "41100" }).ok, false);
assert.equal(validateAddress({ ...addr, city: "" }).ok, false);
assert.equal(validateAddress({ ...addr, line1: "x".repeat(151) }).ok, false);
assert.equal(validateAddress({ ...addr, name: { $gt: "" } }).ok, false, "non-string treated as missing");

console.log("giftRules ok");
