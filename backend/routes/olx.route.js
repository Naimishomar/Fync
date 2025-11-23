import express from 'express';
import { sellProduct, updateProduct, listedProductsByUser, deleteProduct, getAllProducts, detailsOfParticularProduct } from '../controllers/olx.controller.js';
import { upload } from '../utils/cloudinary.js';
import { authMiddleware } from '../middlewares/auth.middleware.js';
const router = express.Router();

router.post('/sell', upload.array('product_image'), authMiddleware, sellProduct);
router.get('/user/products', authMiddleware, listedProductsByUser);
router.post('/update', authMiddleware, upload.fields([{ name: 'product_image', maxCount: 1 }]), updateProduct);
router.delete('/:id', authMiddleware, deleteProduct);
router.get('/products', authMiddleware, getAllProducts);
router.get('/:product_id', authMiddleware, detailsOfParticularProduct);

export default router;