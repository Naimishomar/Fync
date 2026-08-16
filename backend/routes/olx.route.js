import express from 'express';
import { sellProduct, updateProduct, listedProductsByUser, deleteProduct, getAllProducts, detailsOfParticularProduct } from '../controllers/olx.controller.js';
import { upload } from '../utils/r2.js';
import { r2UploadMiddleware } from '../utils/r2Upload.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.post('/sell', authMiddleware, upload.array('image'), r2UploadMiddleware({ image: 'olx' }), sellProduct);
router.get('/user/products', authMiddleware, listedProductsByUser);
router.post('/update', authMiddleware, upload.fields([{ name: 'product_image', maxCount: 1 }]), r2UploadMiddleware({ product_image: 'olx' }), updateProduct);
router.post('/delete/:id', authMiddleware, deleteProduct);
router.get('/products', authMiddleware, getAllProducts);
router.get('/:product_id', authMiddleware, detailsOfParticularProduct);

export default router;