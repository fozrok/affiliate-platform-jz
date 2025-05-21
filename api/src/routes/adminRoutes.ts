// api/src/routes/adminRoutes.ts

import express from 'express';
import adminController from '../controllers/adminController';
import { isAdmin } from '../middleware/auth';

const router = express.Router();

// All admin routes require admin authentication
router.use(isAdmin);

// Dashboard and analytics
router.get('/stats', adminController.getDashboardStats);
router.get('/affiliates', adminController.getAffiliates);
router.get('/products/performance', adminController.getProductPerformance);
router.get('/trends', adminController.getTrends);

// Export related routes can be added here
router.get('/export/affiliates', (req, res) => {
  // This can be implemented to generate CSV exports
  res.status(501).json({ message: 'Not implemented yet' });
});

export default router;
