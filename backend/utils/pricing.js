import Community from "../models/community/community.model.js";

// The single source of truth for what anything costs.
//
// Previously the client posted `{ amount }` to /payment/order and the server
// used it verbatim, then granted entitlements from `notes` the client had also
// supplied. A user could order ₹1 with notes claiming a yearly Community Spark
// and receive it. Prices now live here; the request only names a purpose.
//
// All amounts are in paise.
const RUPEES = (n) => n * 100;

const PLAN_PRICES = { monthly: RUPEES(99), yearly: RUPEES(999) };

export const CATALOG = {
  notice_boost: {
    price: () => RUPEES(49),
    meta: () => ({}),
  },

  funding_listing: {
    price: () => RUPEES(249),
    meta: () => ({}),
  },

  community_creation: {
    price: ({ plan }) => PLAN_PRICES[plan],
    meta: ({ plan, name }) => ({ plan, name: String(name || "").slice(0, 120) }),
  },

  community_spark: {
    price: ({ plan }) => PLAN_PRICES[plan],
    // The community must exist and the buyer must own it, otherwise anyone
    // could top up someone else's — or a deleted — community.
    meta: async ({ plan, communityId }, userId) => {
      if (!communityId) throw new Error("communityId is required");
      const community = await Community.findById(communityId).select("creator").lean();
      if (!community) throw new Error("Community not found");
      if (String(community.creator) !== String(userId)) {
        throw new Error("You can only renew a community you own");
      }
      return { plan, communityId: String(communityId) };
    },
  },
};

/**
 * Resolve a purchase request into the amount to charge and the server-trusted
 * context to store against the order.
 * Throws on anything it cannot price — never falls back to a client amount.
 */
export const resolvePurchase = async (purpose, options = {}, userId) => {
  const entry = CATALOG[purpose];
  if (!entry) throw new Error(`Unknown purchase type: ${purpose}`);

  if (options.plan !== undefined && !PLAN_PRICES[options.plan]) {
    throw new Error("Invalid plan");
  }

  const amount = entry.price(options);
  if (!Number.isInteger(amount) || amount <= 0) {
    throw new Error(`No price configured for ${purpose}`);
  }

  const meta = await entry.meta(options, userId);
  return { amount, meta };
};
