import express, { Application, Request, Response, NextFunction } from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import neo4jConfig from './config/neo4j';

// Route imports
import webhookRoutes from './routes/webhookRoutes';
import authRoutes from './routes/authRoutes';
import affiliateRoutes from './routes/affiliateRoutes';
import productRoutes from './routes/productRoutes';
import adminRoutes from './routes/adminRoutes';

dotenv.config();

const app: Application = express();
const PORT = process.env.PORT || 3000;

// Verify Neo4j connection
neo4jConfig.verifyConnectivity();

// Middleware
app.use(helmet());
app.use(cors());

// Special raw body parser for Shopify webhooks
app.use('/api/webhooks', bodyParser.raw({ type: 'application/json' }));
app.use(bodyParser.json());
// Store raw body for webhook verification
app.use('/api/webhooks', (req: Request, res: Response, next: NextFunction) => {
  req.rawBody = req.body;
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);
app.use('/api/affiliates', affiliateRoutes);
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
