// api/src/routes/authRoutes.ts

import express from 'express';
import authController from '../controllers/authController';
import { verifyToken } from '../middleware/auth';

const router = express.Router();

// Public auth routes
router.post('/login', authController.login);
router.post('/register', authController.register);

// Protected route
router.get('/me', verifyToken, authController.me);

export default router;
