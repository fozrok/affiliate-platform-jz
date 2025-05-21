// api/src/routes/productRoutes.ts

import express from 'express';
import productController from '../controllers/productController';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// All product routes require authentication
router.use(verifyToken);

router.get('/', productController.getProducts);
router.get('/:id', productController.getProductById);

export default router;
