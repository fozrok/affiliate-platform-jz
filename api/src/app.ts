// api/src/app.ts
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import next from 'next';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import morgan from 'morgan';
import neo4jConfig from './config/neo4j';
import { parseRawBody } from './middleware/auth';

// Route imports
import webhookRoutes from './routes/webhookRoutes';
import authRoutes from './routes/authRoutes';
import affiliateRoutes from './routes/affiliateRoutes';
import productRoutes from './routes/productRoutes';
import adminRoutes from './routes/adminRoutes';
import syncRoutes from './routes/syncRoutes';

dotenv.config();

// Initialize Next.js app
type NextConfig = { dev: boolean; dir: string };
const dev = process.env.NODE_ENV !== 'production';
const nextApp = next({
  dev,
  dir: path.resolve(__dirname, '..', '..', 'frontend'),
});

const handle = nextApp.getRequestHandler();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Global middleware
app.use(helmet());
app.use(cors());
app.use(morgan('dev')); // Added logging middleware

// Use JSON parser for all routes except webhooks
app.use((req, res, next) => {
  if (req.path.startsWith('/api/webhooks')) {
    parseRawBody(req, res, next);
  } else {
    bodyParser.json({ 
      verify: (req: any, _, buf) => { req.rawBody = buf; } 
    })(req, res, next);
  }
});

// Mount auth & webhook routes
app.use('/api/auth', authRoutes);
app.use('/api/webhooks', webhookRoutes);

// Mount other API routes
app.use('/api/affiliates', affiliateRoutes); // Original route path
app.use('/api/affiliate', affiliateRoutes);  // New dashboard routes path
app.use('/api/products', productRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/sync', syncRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
});

// Verify Neo4j connectivity before starting server
neo4jConfig.verifyConnectivity()
  .then(() => {
    console.log('✅ Connected to Neo4j database');
    
    // Initialize Next.js and start server after DB verification
    nextApp.prepare().then(() => {
      // All other routes handled by Next.js
      app.all('*', (req: Request, res: Response) => handle(req, res));
      
      // Start server
      app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
      });
    }).catch(err => {
      console.error('Error preparing Next.js app:', err);
      process.exit(1);
    });
  })
  .catch(err => {
    console.error('Failed to connect to Neo4j:', err);
    process.exit(1);
  });

export default app;
