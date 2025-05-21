// api/src/controllers/productController.ts

import { Request, Response } from 'express';
import neo4jConfig from '../config/neo4j';

export const getProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    const session = neo4jConfig.session();
    
    try {
      const result = await session.run(`
        MATCH (p:Product)
        WHERE (p.deleted IS NULL OR p.deleted = false)
        
        // Get variants
        OPTIONAL MATCH (p)-[:HAS_VARIANT]->(v:ProductVariant)
        
        // Get product stats
        OPTIONAL MATCH (o:Order)-[:INCLUDES]->(:ProductVariant)<-[:HAS_VARIANT]-(p)
        WHERE o.status <> 'cancelled'
        
        WITH p, collect(v {.id, .title, .price, .sku}) as variants,
             count(DISTINCT o) as totalOrders,
             sum(o.total) as totalRevenue
        
        // Get affiliate count for this product
        OPTIONAL MATCH (a:Person)-[:AFFILIATES]->(p)
        
        RETURN p.id as productId,
               p.name as productName,
               p.description as productDescription,
               p.type as productType,
               p.vendor as productVendor,
               p.tags as productTags,
               variants,
               totalOrders,
               totalRevenue,
               count(a) as affiliateCount
        ORDER BY totalOrders DESC
      `);
      
      const products = result.records.map(record => {
        return {
          id: record.get('productId'),
          name: record.get('productName'),
          description: record.get('productDescription'),
          type: record.get('productType'),
          vendor: record.get('productVendor'),
          tags: record.get('productTags'),
          variants: record.get('variants'),
          stats: {
            totalOrders: record.get('totalOrders').toNumber(),
            totalRevenue: record.get('totalRevenue') ? record.get('totalRevenue').toNumber() : 0,
            affiliateCount: record.get('affiliateCount').toNumber()
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
    console.error('Error getting products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get products',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getProductById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Product ID is required'
      });
      return;
    }
    
    const session = neo4jConfig.session();
    
    try {
      const result = await session.run(`
        MATCH (p:Product {id: $productId})
        WHERE (p.deleted IS NULL OR p.deleted = false)
        
        // Get variants
        OPTIONAL MATCH (p)-[:HAS_VARIANT]->(v:ProductVariant)
        
        // Get product stats
        OPTIONAL MATCH (o:Order)-[:INCLUDES]->(:ProductVariant)<-[:HAS_VARIANT]-(p)
        WHERE o.status <> 'cancelled'
        
        WITH p, collect(v {.id, .title, .price, .sku}) as variants,
             count(DISTINCT o) as totalOrders,
             sum(o.total) as totalRevenue
        
        // Get affiliates for this product
        OPTIONAL MATCH (a:Person)-[aff:AFFILIATES]->(p)
        
        WITH p, variants, totalOrders, totalRevenue,
             collect({
               id: a.id,
               name: a.name,
               level: a.level,
               commission_rate: aff.commission_rate
             }) as affiliates
        
        RETURN p.id as productId,
               p.name as productName,
               p.description as productDescription,
               p.type as productType,
               p.vendor as productVendor,
               p.tags as productTags,
               p.shopify_created_at as createdAt,
               p.shopify_updated_at as updatedAt,
               variants,
               affiliates,
               totalOrders,
               totalRevenue
      `, { productId: id });
      
      if (result.records.length === 0) {
        res.status(404).json({
          success: false,
          message: 'Product not found'
        });
        return;
      }
      
      const record = result.records[0];
      
      res.status(200).json({
        success: true,
        data: {
          id: record.get('productId'),
          name: record.get('productName'),
          description: record.get('productDescription'),
          type: record.get('productType'),
          vendor: record.get('productVendor'),
          tags: record.get('productTags'),
          createdAt: record.get('createdAt'),
          updatedAt: record.get('updatedAt'),
          variants: record.get('variants'),
          affiliates: record.get('affiliates'),
          stats: {
            totalOrders: record.get('totalOrders').toNumber(),
            totalRevenue: record.get('totalRevenue') ? record.get('totalRevenue').toNumber() : 0
          }
        }
      });
    } finally {
      await session.close();
    }
  } catch (error) {
    console.error('Error getting product by ID:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get product',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export default {
  getProducts,
  getProductById
};
