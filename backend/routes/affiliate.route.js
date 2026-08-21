import express from 'express';
import { 
    addAffiliateProduct, 
    getAffiliateProducts, 
    getAffiliateProductDetails, 
    trackAffiliateClick, 
    completeAffiliateSale,
    setAffiliateProductAvailability,
    deleteAffiliateProduct
} from '../controllers/affiliate.controller.js';
import { authMiddleware, isAdmin } from '../middlewares/auth.middleware.js'; // Assuming this exists based on common backend structure

const router = express.Router();

// Publicly available products
router.get('/products', authMiddleware, getAffiliateProducts);
router.get('/products/:id', authMiddleware, getAffiliateProductDetails);

// Tracking clicks
router.post('/track', authMiddleware, trackAffiliateClick);

// Completing sales (mock for demo)
router.post('/complete', authMiddleware, completeAffiliateSale);

// Managing products (admin authorized)
router.post('/add-product', authMiddleware, isAdmin, addAffiliateProduct);
router.patch('/products/:id/availability', authMiddleware, isAdmin, setAffiliateProductAvailability);
router.delete('/products/:id', authMiddleware, isAdmin, deleteAffiliateProduct);

export default router;
