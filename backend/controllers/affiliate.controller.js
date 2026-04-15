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
        const { category, search } = req.query;
        let query = { isAvailable: true };

        if (category) {
            query.category = category;
        }

        if (search) {
            query.name = { $regex: search, $options: 'i' };
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
