import crypto from "crypto";
import AffiliateProduct from "../models/affiliateProduct.model.js";
import AffiliateSale from "../models/affiliateSale.model.js";
import AffiliateShare from "../models/affiliateShare.model.js";
import User from "../models/user.model.js";

// Add a new affiliate product (Admin only)
export const addAffiliateProduct = async (req, res) => {
    try {
        const { name, description, price, originalPrice, image, category, affiliateLink, commissionRate, brand } = req.body;
        
        if (!name || !description || !price || !image || !category || !affiliateLink) {
            return res.status(400).json({ success: false, message: "Missing required fields" });
        }

        const product = await AffiliateProduct.create({
            name,
            description,
            price,
            originalPrice,
            image,
            category,
            affiliateLink,
            commissionRate,
            brand
        });

        res.status(201).json({ success: true, message: "Product added successfully", product });
    } catch (error) {
        console.error("Error adding affiliate product:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get all affiliate products
export const getAffiliateProducts = async (req, res) => {
    try {
        const { category, search, includeDelisted } = req.query;

        // Shoppers only ever see live products. An admin managing the catalogue
        // has to see delisted ones too, or a product could be hidden with no way
        // left in the UI to bring it back.
        const isAdminRequest = req.user?.user_access === 'admin' && includeDelisted === 'true';
        let query = isAdminRequest ? {} : { isAvailable: true };

        if (category) {
            query.category = category;
        }

        if (search) {
            // A user-supplied string goes straight into a regex otherwise, so
            // characters like ( or * make it throw or scan pathologically.
            const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            query.name = { $regex: safe, $options: 'i' };
        }

        const products = await AffiliateProduct.find(query).sort({ createdAt: -1 });
        res.status(200).json({ success: true, products });
    } catch (error) {
        console.error("Error fetching affiliate products:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Get product details
export const getAffiliateProductDetails = async (req, res) => {
    try {
        const product = await AffiliateProduct.findById(req.params.id);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }
        res.status(200).json({ success: true, product });
    } catch (error) {
        console.error("Error fetching product details:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Track a click/potential sale
export const trackAffiliateClick = async (req, res) => {
    try {
        const { productId, shareCode } = req.body;
        const userId = req.user.id;

        const product = await AffiliateProduct.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
        }

        // Attribution is recorded now so phase 2 has honest history to pay
        // against. A sharer buying through their own link earns nothing, so it
        // is stored unattributed rather than credited to them.
        let sharer = null;
        if (shareCode) {
            const share = await AffiliateShare.findOne({ code: shareCode }).select('sharer').lean();
            if (share && String(share.sharer) !== String(userId)) sharer = share.sharer;
        }

        // Create a pending sale record
        // In a real system, this would be updated by a webhook from the affiliate partner
        const sale = await AffiliateSale.create({
            userId,
            productId,
            orderValue: product.price,
            commission: (product.price * (product.commissionRate || 0)) / 100,
            status: 'Pending',
            affiliateSource: product.brand || "Internal",
            sharer,
            shareCode: sharer ? shareCode : null,
            clickedAt: new Date()
        });

        res.status(200).json({ success: true, message: "Click tracked", saleId: sale._id });
    } catch (error) {
        console.error("Error tracking affiliate click:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Mock function to "complete" a sale (for demo purposes)
/**
 * Marks a sale confirmed. Machine-to-machine, or an admin reconciling by hand.
 *
 * This used to sit behind authMiddleware alone, so ANY logged-in user could
 * POST any saleId and mark it Completed. That was only a vanity number while
 * Fync keeps the commission — but the moment a share-and-earn payout is
 * attached to it, it becomes a self-serve withdraw button: share your own link
 * to create a Pending sale, call this, get paid for a purchase that never
 * happened. Locking it now, before money is attached, not after.
 *
 * Signature: HMAC-SHA256 over `saleId|transactionId`, hex, in x-affiliate-signature.
 */
export const completeAffiliateSale = async (req, res) => {
    try {
        const { saleId, transactionId, orderValue, commission } = req.body;
        if (!saleId || !transactionId) {
            return res.status(400).json({ success: false, message: "saleId and transactionId are required" });
        }

        const isAdminCaller = req.user?.user_access === 'admin';

        if (!isAdminCaller) {
            const secret = process.env.AFFILIATE_WEBHOOK_SECRET;
            // Fail closed. An unset secret must not mean "anyone may call this".
            if (!secret) {
                return res.status(503).json({ success: false, message: "Sale confirmation is not configured." });
            }

            const supplied = String(req.get('x-affiliate-signature') || '');
            let received;
            try {
                received = Buffer.from(supplied, 'hex');
            } catch {
                return res.status(401).json({ success: false, message: "Invalid signature" });
            }
            const expected = crypto
                .createHmac('sha256', secret)
                .update(`${saleId}|${transactionId}`)
                .digest();

            // Constant-time compare; timingSafeEqual throws on a length mismatch.
            if (received.length !== expected.length || !crypto.timingSafeEqual(expected, received)) {
                return res.status(401).json({ success: false, message: "Invalid signature" });
            }
        }

        // Atomically claim the sale. A replayed webhook — networks retry — finds
        // nothing still Pending and changes nothing, so this is exactly-once.
        const update = {
            status: 'Completed',
            transactionId: String(transactionId),
            completedAt: new Date(),
        };
        // Real figures come from the network. The values stored at click time are
        // an estimate: list price, assuming the tap became a full-price purchase.
        if (typeof orderValue === 'number' && orderValue >= 0) update.orderValue = orderValue;
        if (typeof commission === 'number' && commission >= 0) update.commission = commission;

        const sale = await AffiliateSale.findOneAndUpdate(
            { _id: saleId, status: 'Pending' },
            { $set: update },
            { new: true }
        );

        if (!sale) {
            const exists = await AffiliateSale.findById(saleId).select('status').lean();
            if (!exists) return res.status(404).json({ success: false, message: "Sale record not found" });
            // Already settled: report success so a retrying webhook stops retrying.
            return res.status(200).json({ success: true, message: `Sale already ${exists.status}`, idempotent: true });
        }

        return res.status(200).json({ success: true, message: "Sale completed", sale });
    } catch (error) {
        // A duplicate transactionId trips the unique index — the same network
        // order arriving under a second saleId, which must not create a payout.
        if (error?.code === 11000) {
            return res.status(409).json({ success: false, message: "That transaction is already recorded." });
        }
        console.error("Error completing affiliate sale:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Delist rather than delete: an AffiliateSale references the product, so removing
 * the row would orphan every commission record that points at it. Hidden products
 * stop appearing in the store but their sales history stays intact.
 */
export const setAffiliateProductAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const { isAvailable } = req.body;
        if (typeof isAvailable !== 'boolean') {
            return res.status(400).json({ success: false, message: "isAvailable must be true or false" });
        }

        const product = await AffiliateProduct.findByIdAndUpdate(
            id,
            { isAvailable },
            { new: true }
        );
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        return res.status(200).json({
            success: true,
            message: isAvailable ? "Product is live again" : "Product delisted",
            product
        });
    } catch (error) {
        console.error("Error updating affiliate product:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/**
 * Permanent removal. Any product can be deleted, including one with recorded
 * sales — the admin owns the catalogue.
 *
 * The AffiliateSale rows are deliberately kept: each one stores its own
 * orderValue, commission and affiliateSource, so the financial record stays
 * intact and auditable after the product document is gone. Cascading the delete
 * would erase earnings history, which is the one thing that must not vanish
 * because someone tidied up a listing.
 */
export const deleteAffiliateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const product = await AffiliateProduct.findByIdAndDelete(id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        const salesCount = await AffiliateSale.countDocuments({ productId: id });

        return res.status(200).json({
            success: true,
            message: salesCount > 0
                ? `Deleted. ${salesCount} sale${salesCount === 1 ? '' : 's'} kept in the commission record.`
                : "Product deleted.",
            deletedId: id,
            salesCount
        });
    } catch (error) {
        console.error("Error deleting affiliate product:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};


// ─── Share & Earn (phase 1: attribution only, no payouts) ────────────────────

const SHARE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // no look-alikes: 0/o, 1/l/i

/** Short code from real randomness — Math.random() is predictable and these are public. */
const mintCode = () =>
    Array.from(crypto.randomBytes(8))
        .map((b) => SHARE_ALPHABET[b % SHARE_ALPHABET.length])
        .join('');

/**
 * Returns this user's link for a product, creating it on first use.
 *
 * Idempotent by (sharer, product): tapping Share twice must not mint a second
 * code, or the click counts split across links and the sharer sees half their
 * traffic.
 */
export const createShareLink = async (req, res) => {
    try {
        const { productId } = req.body;
        if (!productId) return res.status(400).json({ success: false, message: "productId is required" });

        const product = await AffiliateProduct.findById(productId).select('name isAvailable').lean();
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });
        if (!product.isAvailable) {
            return res.status(409).json({ success: false, message: "That product is no longer listed." });
        }

        const existing = await AffiliateShare.findOne({ sharer: req.user.id, product: productId }).lean();
        if (existing) {
            return res.status(200).json({ success: true, share: existing, url: shareUrl(existing.code) });
        }

        // Retry on the astronomically unlikely code collision rather than 500.
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                const share = await AffiliateShare.create({
                    code: mintCode(),
                    sharer: req.user.id,
                    product: productId,
                });
                return res.status(201).json({ success: true, share, url: shareUrl(share.code) });
            } catch (err) {
                if (err?.code !== 11000) throw err;
                // A duplicate on (sharer, product) means a concurrent request won.
                const raced = await AffiliateShare.findOne({ sharer: req.user.id, product: productId }).lean();
                if (raced) return res.status(200).json({ success: true, share: raced, url: shareUrl(raced.code) });
            }
        }
        return res.status(500).json({ success: false, message: "Could not create a share link" });
    } catch (error) {
        console.error("Error creating share link:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

const shareUrl = (code) => `${process.env.APP_DEEP_LINK_SCHEME || 'fync'}://s/${code}`;

/** Resolves a code to its product and counts the tap. */
export const resolveShareLink = async (req, res) => {
    try {
        const { code } = req.params;
        const share = await AffiliateShare.findOne({ code });
        if (!share) return res.status(404).json({ success: false, message: "That link is no longer valid." });

        const isSelf = String(share.sharer) === String(req.user.id);
        await AffiliateShare.updateOne(
            { _id: share._id },
            { $inc: isSelf ? { selfClicks: 1 } : { clicks: 1 }, $set: { lastClickedAt: new Date() } }
        );

        const product = await AffiliateProduct.findById(share.product).lean();
        if (!product) return res.status(404).json({ success: false, message: "That product is no longer listed." });

        return res.status(200).json({ success: true, product, shareCode: code, isSelf });
    } catch (error) {
        console.error("Error resolving share link:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

/** The sharer's own stats. Deliberately reports taps, never money. */
export const getMyShares = async (req, res) => {
    try {
        const shares = await AffiliateShare.find({ sharer: req.user.id })
            .sort({ createdAt: -1 })
            .limit(100)
            .populate('product', 'name image price isAvailable')
            .lean();

        const totalClicks = shares.reduce((n, s) => n + (s.clicks || 0), 0);
        return res.status(200).json({ success: true, shares, totalClicks });
    } catch (error) {
        console.error("Error fetching shares:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};
