import AffiliateProduct from "../models/affiliateProduct.model.js";
import AffiliateSale from "../models/affiliateSale.model.js";
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
        const { productId } = req.body;
        const userId = req.user.id;

        const product = await AffiliateProduct.findById(productId);
        if (!product) {
            return res.status(404).json({ success: false, message: "Product not found" });
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
            clickedAt: new Date()
        });

        res.status(200).json({ success: true, message: "Click tracked", saleId: sale._id });
    } catch (error) {
        console.error("Error tracking affiliate click:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

// Mock function to "complete" a sale (for demo purposes)
export const completeAffiliateSale = async (req, res) => {
    try {
        const { saleId, transactionId } = req.body;
        
        const sale = await AffiliateSale.findById(saleId);
        if (!sale) {
            return res.status(404).json({ success: false, message: "Sale record not found" });
        }

        sale.status = 'Completed';
        sale.transactionId = transactionId || `TXN_${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        sale.completedAt = new Date();
        await sale.save();

        res.status(200).json({ success: true, message: "Sale completed", sale });
    } catch (error) {
        console.error("Error completing affiliate sale:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
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
 * Permanent removal, refused while sales exist so commission history cannot be
 * silently destroyed — the caller is told to delist instead.
 */
export const deleteAffiliateProduct = async (req, res) => {
    try {
        const { id } = req.params;

        const salesCount = await AffiliateSale.countDocuments({ productId: id });
        if (salesCount > 0) {
            return res.status(409).json({
                success: false,
                message: `This product has ${salesCount} recorded sale${salesCount === 1 ? '' : 's'}. Delist it instead so the commission history is kept.`,
                salesCount
            });
        }

        const product = await AffiliateProduct.findByIdAndDelete(id);
        if (!product) return res.status(404).json({ success: false, message: "Product not found" });

        return res.status(200).json({ success: true, message: "Product deleted" });
    } catch (error) {
        console.error("Error deleting affiliate product:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};
