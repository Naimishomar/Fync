import express from 'express';
import { 
    addAffiliateProduct, 
    getAffiliateProducts, 
    getAffiliateProductDetails, 
    trackAffiliateClick, 
    completeAffiliateSale 
} from '../controllers/affiliate.controller.js';
import { authMiddleware } from '../middlewares/auth.middleware.js'; // Assuming this exists based on common backend structure

const router = express.Router();

// Publicly available products
router.get('/products', authMiddleware, getAffiliateProducts);
router.get('/products/:id', authMiddleware, getAffiliateProductDetails);

// Tracking clicks
router.post('/track', authMiddleware, trackAffiliateClick);

// Completing sales (mock for demo)
router.post('/complete', authMiddleware, completeAffiliateSale);

// Adding products (In real app should be admin authorized)
router.post('/add-product', authMiddleware, addAffiliateProduct);

export default router;
