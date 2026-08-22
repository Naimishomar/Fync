import express from 'express';
import { 
    addAffiliateProduct, 
    getAffiliateProducts, 
    getAffiliateProductDetails, 
    trackAffiliateClick, 
    completeAffiliateSale,
    setAffiliateProductAvailability,
    deleteAffiliateProduct,
    createShareLink,
    resolveShareLink,
    getMyShares
} from '../controllers/affiliate.controller.js';
import { authMiddleware, isAdmin } from '../middlewares/auth.middleware.js'; // Assuming this exists based on common backend structure
import { upload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';

const router = express.Router();

// Publicly available products
router.get('/products', authMiddleware, getAffiliateProducts);
router.get('/products/:id', authMiddleware, getAffiliateProductDetails);

// Tracking clicks
router.post('/track', authMiddleware, trackAffiliateClick);

// Sale confirmation. The controller requires either an admin caller or a valid
// HMAC signature; authMiddleware alone let any logged-in user settle any sale.
router.post('/complete', authMiddleware, completeAffiliateSale);

// Share & Earn — attribution only for now; no money is computed or paid here.
router.post('/share', authMiddleware, createShareLink);
router.get('/share/:code', authMiddleware, resolveShareLink);
router.get('/my-shares', authMiddleware, getMyShares);

// Managing products (admin authorized)
// Accepts the product photo as a file so an admin can pick from their gallery
// instead of hunting for a hotlinkable URL. upload.single is a no-op for a
// plain JSON body, so posting an image URL still works.
router.post(
    '/add-product',
    authMiddleware,
    isAdmin,
    upload.single('image'),
    r2UploadMiddleware({ __single__: 'affiliate' }),
    addAffiliateProduct,
);
router.patch('/products/:id/availability', authMiddleware, isAdmin, setAffiliateProductAvailability);
router.delete('/products/:id', authMiddleware, isAdmin, deleteAffiliateProduct);

export default router;
