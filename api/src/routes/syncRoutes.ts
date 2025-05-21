// api/src/routes/syncRoutes.ts

import express from 'express';
import syncController from '../controllers/syncController';
import { isAdmin } from '../middleware/auth';

const router = express.Router();

// All sync routes require admin authentication
router.use(isAdmin);

// Data sync routes
router.post('/products', syncController.syncProducts);
router.post('/orders', syncController.syncOrders);

// Webhook management
router.post('/webhooks/setup', syncController.setupWebhooks);
router.get('/webhooks', syncController.getWebhooks);

export default router;
