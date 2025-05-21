// api/src/middleware/auth.ts

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import neo4jConfig from '../config/neo4j';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: string;
      };
    }
  }
}

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Verify JWT token
export const verifyToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ message: 'No token provided' });
      return;
    }
    
    const token = authHeader.split(' ')[1];
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      
      // Verify that user exists in database
      const session = neo4jConfig.session();
      
      try {
        const result = await session.run(`
          MATCH (p:Person {id: $userId})
          RETURN p.id as id, p.email as email, p.role as role
        `, { userId: decoded.id });
        
        if (result.records.length === 0) {
          res.status(401).json({ message: 'Invalid token: User not found' });
          return;
        }
        
        // Set user object on request
        const record = result.records[0];
        req.user = {
          id: record.get('id'),
          email: record.get('email'),
          role: record.get('role')
        };
        
        next();
      } finally {
        await session.close();
      }
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
      return;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Check if user is an admin
export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await verifyToken(req, res, () => {
      if (req.user?.role !== 'admin') {
        res.status(403).json({ message: 'Admin access required' });
        return;
      }
      
      next();
    });
  } catch (error) {
    console.error('isAdmin middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Check if user is an affiliate
export const isAffiliate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    await verifyToken(req, res, () => {
      if (req.user?.role !== 'affiliate' && req.user?.role !== 'admin') {
        res.status(403).json({ message: 'Affiliate access required' });
        return;
      }
      
      next();
    });
  } catch (error) {
    console.error('isAffiliate middleware error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// Parse raw body for webhook verification
export const parseRawBody = (req: Request, res: Response, next: NextFunction): void => {
  let data = '';
  
  req.setEncoding('utf8');
  
  req.on('data', chunk => {
    data += chunk;
  });
  
  req.on('end', () => {
    (req as any).rawBody = Buffer.from(data);
    
    if (data) {
      try {
        req.body = JSON.parse(data);
      } catch (e) {
        console.error('Error parsing webhook body as JSON:', e);
      }
    }
    
    next();
  });
};
