// api/src/controllers/affiliateController.ts

import { Request, Response } from 'express';
import shopifyAnalyticsService from '../services/shopifyAnalyticsService';
import neo4jConfig from '../config/neo4j';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const affiliateId = req.user?.id;
    
    if (!affiliateId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or not an affiliate'
      });
      return;
    }
    
    const { from, to } = req.query;
    const dateRange = from && to ? { from: from as string, to: to as string } : undefined;
    
    const stats = await shopifyAnalyticsService.getAffiliatePerformance(affiliateId, dateRange);
    
    if (stats.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Affiliate not found'
      });
      return;
    }
    
    res.status(200).json({
      success: true,
      data: stats[0]
    });
  } catch (error) {
    console.error('Error getting affiliate dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get affiliate statistics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const affiliateId = req.user?.id;
    
    if (!affiliateId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or not an affiliate'
      });
      return;
    }
    
    const session = neo4jConfig.session();
    
    try {
      // Get products available for affiliation
      const result = await session.run(`
        // Match all products
        MATCH (p:Product)
        WHERE (p.deleted IS NULL OR p.deleted = false)
        
        // Check if this affiliate already affiliates with the product
        OPTIONAL MATCH (a:Person {id: $affiliateId})-[aff:AFFILIATES]->(p)
        
        // Get product stats
        OPTIONAL MATCH (o:Order)-[:INCLUDES]->(:ProductVariant)<-[:HAS_VARIANT]-(p)
        WHERE o.status <> 'cancelled'
        
        WITH p, aff,
             count(DISTINCT o) as totalOrders,
             sum(o.total) as totalRevenue
        
        // Get affiliate-specific stats for this product
        OPTIONAL MATCH (a:Person {id: $affiliateId})-[:REFERRED]->(o:Order)-[:INCLUDES]->(:ProductVariant)<-[:HAS_VARIANT]-(p)
        WHERE o.status <> 'cancelled'
        
        WITH p, aff, totalOrders, totalRevenue,
             count(DISTINCT o) as affiliateOrders,
             sum(o.total) as affiliateRevenue
        
        // Return product data with affiliate relationship info
        RETURN p.id as productId,
               p.name as productName,
               p.description as productDescription,
               p.type as productType,
               p.price as productPrice,
               aff.commission_rate as commissionRate,
               CASE WHEN aff IS NOT NULL THEN true ELSE false END as isAffiliated,
               totalOrders,
               totalRevenue,
               affiliateOrders,
               affiliateRevenue
        ORDER BY isAffiliated DESC, totalOrders DESC
      `, { affiliateId });
      
      const products = result.records.map(record => {
        return {
          id: record.get('productId'),
          name: record.get('productName'),
          description: record.get('productDescription'),
          type: record.get('productType'),
          price: record.get('productPrice'),
          isAffiliated: record.get('isAffiliated'),
          commissionRate: record.get('commissionRate'),
          stats: {
            totalOrders: record.get('totalOrders').toNumber(),
            totalRevenue: record.get('totalRevenue') ? record.get('totalRevenue').toNumber() : 0,
            affiliateOrders: record.get('affiliateOrders').toNumber(),
            affiliateRevenue: record.get('affiliateRevenue') ? record.get('affiliateRevenue').toNumber() : 0
          }
        };
      });
      
      res.status(200).json({
        success: true,
        data: products
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Error getting affiliate products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get affiliate products',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const affiliateId = req.user?.id;
    
    if (!affiliateId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or not an affiliate'
      });
      return;
    }
    
    const session = neo4jConfig.session();
    
    try {
      const result = await session.run(`
        MATCH (a:Person {id: $affiliateId})
        
        // Get followers
        OPTIONAL MATCH (follower:Person)-[:FOLLOWS]->(a)
        
        // Get people this affiliate follows
        OPTIONAL MATCH (a)-[:FOLLOWS]->(following:Person)
        
        RETURN a.id as id,
               a.name as name,
               a.email as email,
               a.level as level,
               a.affiliateCode as affiliateCode,
               a.bio as bio,
               a.social as social,
               a.website as website,
               a.created_at as createdAt,
               count(DISTINCT follower) as followerCount,
               count(DISTINCT following) as followingCount
      `, { affiliateId });
      
      if (result.records.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Affiliate not found'
        });
        return;
      }
      
      const record = result.records[0];
      
      res.status(200).json({
        success: true,
        data: {
          id: record.get('id'),
          name: record.get('name'),
          email: record.get('email'),
          level: record.get('level'),
          affiliateCode: record.get('affiliateCode'),
          bio: record.get('bio'),
          social: record.get('social'),
          website: record.get('website'),
          createdAt: record.get('createdAt'),
          followers: record.get('followerCount').toNumber(),
          following: record.get('followingCount').toNumber()
        }
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Error getting affiliate profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get affiliate profile',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const updateProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const affiliateId = req.user?.id;
    
    if (!affiliateId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or not an affiliate'
      });
      return;
    }
    
    const { name, bio, social, website } = req.body;
    
    const session = neo4jConfig.session();
    
    try {
      await session.run(`
        MATCH (a:Person {id: $affiliateId})
        SET a.name = $name,
            a.bio = $bio,
            a.social = $social,
            a.website = $website,
            a.updated_at = datetime()
      `, {
        affiliateId,
        name,
        bio,
        social,
        website
      });
      
      res.status(200).json({
        success: true,
        message: 'Profile updated successfully'
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Error updating affiliate profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update affiliate profile',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const generateReferralLink = async (req: Request, res: Response): Promise<void> => {
  try {
    const affiliateId = req.user?.id;
    
    if (!affiliateId) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated or not an affiliate'
      });
      return;
    }
    
    const { productId } = req.body;
    
    if (!productId) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
      return;
    }
    
    const session = neo4jConfig.session();
    
    try {
      // Get affiliate code
      const result = await session.run(`
        MATCH (a:Person {id: $affiliateId})
        RETURN a.affiliateCode as affiliateCode
      `, { affiliateId });
      
      if (result.records.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Affiliate not found'
        });
        return;
      }
      
      const affiliateCode = result.records[0].get('affiliateCode');
      
      // Create affiliate relationship if it doesn't exist
      await session.run(`
        MATCH (a:Person {id: $affiliateId})
        MATCH (p:Product {id: $productId})
        MERGE (a)-[r:AFFILIATES]->(p)
        ON CREATE SET r.commission_rate = CASE
                          WHEN a.level = 'gold' THEN 0.15
                          WHEN a.level = 'silver' THEN 0.1
                          WHEN a.level = 'bronze' THEN 0.05
                          ELSE 0.03
                       END,
                      r.date_created = datetime()
      `, {
        affiliateId,
        productId
      });
      
      // Generate a referral link
      const shopUrl = process.env.SHOPIFY_SHOP_URL || 'https://your-store.myshopify.com';
      const referralLink = `${shopUrl}/products/${productId}?affiliate=${affiliateCode}`;
      
      res.status(200).json({
        success: true,
        data: {
          referralLink,
          affiliateCode
        }
      });
