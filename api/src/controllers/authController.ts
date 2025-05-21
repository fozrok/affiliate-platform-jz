// api/src/controllers/authController.ts

import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import neo4jConfig from '../config/neo4j';
import { v4 as uuidv4 } from 'uuid';

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
      return;
    }
    
    const session = neo4jConfig.session();
    
    try {
      const result = await session.run(`
        MATCH (p:Person {email: $email})
        RETURN p.id as id, p.email as email, p.password as password, p.name as name, p.role as role
      `, { email });
      
      if (result.records.length === 0) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }
      
      const user = result.records[0];
      const storedPassword = user.get('password');
      
      // Check password
      if (!storedPassword || !(await bcrypt.compare(password, storedPassword))) {
        res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
        return;
      }
      
      // Generate JWT
      const token = jwt.sign(
        {
          id: user.get('id'),
          email: user.get('email'),
          role: user.get('role')
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      res.status(200).json({
        success: true,
        data: {
          id: user.get('id'),
          name: user.get('name'),
          email: user.get('email'),
          role: user.get('role'),
          token
        }
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    
    if (!name || !email || !password) {
      res.status(400).json({
        success: false,
        message: 'Name, email, and password are required'
      });
      return;
    }
    
    const session = neo4jConfig.session();
    
    try {
      // Check if email already exists
      const emailCheck = await session.run(`
        MATCH (p:Person {email: $email})
        RETURN p.id as id
      `, { email });
      
      if (emailCheck.records.length > 0) {
        res.status(409).json({
          success: false,
          message: 'Email already registered'
        });
        return;
      }
      
      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Generate unique ID and affiliate code
      const id = uuidv4();
      const affiliateCode = `AFF${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      
      // Create new user
      await session.run(`
        CREATE (p:Person {
          id: $id,
          name: $name,
          email: $email,
          password: $hashedPassword,
          role: 'affiliate',
          level: 'bronze',
          affiliateCode: $affiliateCode,
          created_at: datetime()
        })
        RETURN p
      `, {
        id,
        name,
        email,
        hashedPassword,
        affiliateCode
      });
      
      // Generate JWT
      const token = jwt.sign(
        {
          id,
          email,
          role: 'affiliate'
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
      );
      
      res.status(201).json({
        success: true,
        data: {
          id,
          name,
          email,
          role: 'affiliate',
          token
        }
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const me = async (req: Request, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Not authenticated'
      });
      return;
    }
    
    const session = neo4jConfig.session();
    
    try {
      const result = await session.run(`
        MATCH (p:Person {id: $userId})
        RETURN p.id as id, p.name as name, p.email as email, p.role as role, p.level as level
      `, { userId: req.user.id });
      
      if (result.records.length === 0) {
        res.status(404).json({
          success: false,
          message: 'User not found'
        });
        return;
      }
      
      const user = result.records[0];
      
      res.status(200).json({
        success: true,
        data: {
          id: user.get('id'),
          name: user.get('name'),
          email: user.get('email'),
          role: user.get('role'),
          level: user.get('level')
        }
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Me endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get user data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export default {
  login,
  register,
  me
};
