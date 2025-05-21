// api/src/controllers/syncController.ts

import { Request, Response } from 'express';
import shopifyService from '../services/shopifyService';
import dataNormalizationService from '../services/dataNormalizationService';

export const syncProducts = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Starting product sync...');
    
    // Get all products from Shopify
    const products = await shopifyService.getAllResources<any>('/products.json', 'products');
    console.log(`Retrieved ${products.length} products from Shopify`);
    
    // Normalize and import products
    await dataNormalizationService.normalizeProducts(products);
    
    res.status(200).json({
      success: true,
      message: `Successfully synced ${products.length} products`,
    });
  } catch (error) {
    console.error('Error syncing products:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync products',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const syncOrders = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Starting order sync...');
    
    // Get params for filtering orders
    const { since, status } = req.query;
    const params: any = {};
    
    if (since) {
      params.created_at_min = since;
    } else {
      // Default to last 30 days if no date provided
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      params.created_at_min = thirtyDaysAgo.toISOString();
    }
    
    if (status) {
      params.status = status;
    }
    
    // Get orders from Shopify
    const orders = await shopifyService.getAllResources<any>('/orders.json', 'orders');
    console.log(`Retrieved ${orders.length} orders from Shopify`);
    
    // Normalize and import orders
    await dataNormalizationService.normalizeOrders(orders);
    
    res.status(200).json({
      success: true,
      message: `Successfully synced ${orders.length} orders`,
    });
  } catch (error) {
    console.error('Error syncing orders:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to sync orders',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const setupWebhooks = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Setting up Shopify webhooks...');
    
    const { baseUrl } = req.body;
    if (!baseUrl) {
      res.status(400).json({
        success: false,
        message: 'baseUrl is required in the request body'
      });
      return;
    }
    
    // Define webhook topics to register
    const webhooks = [
      { topic: 'orders/create', path: '/webhooks/order/created' },
      { topic: 'orders/cancelled', path: '/webhooks/order/cancelled' },
      { topic: 'orders/fulfilled', path: '/webhooks/order/fulfilled' },
      { topic: 'products/create', path: '/webhooks/product/created' },
      { topic: 'products/update', path: '/webhooks/product/updated' },
      { topic: 'products/delete', path: '/webhooks/product/deleted' }
    ];
    
    const results = [];
    
    // Register each webhook
    for (const webhook of webhooks) {
      try {
        const result = await shopifyService.createWebhook(
          webhook.topic,
          `${baseUrl}${webhook.path}`
        );
        results.push({
          topic: webhook.topic,
          success: true,
          id: result.webhook?.id
        });
      } catch (error) {
        results.push({
          topic: webhook.topic,
          success: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    res.status(200).json({
      success: true,
      message: 'Webhook setup completed',
      results
    });
  } catch (error) {
    console.error('Error setting up webhooks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set up webhooks',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getWebhooks = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Retrieving registered webhooks...');
    
    const webhooks = await shopifyService.listWebhooks();
    
    res.status(200).json({
      success: true,
      webhooks: webhooks.webhooks || []
    });
  } catch (error) {
    console.error('Error retrieving webhooks:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve webhooks',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export default {
  syncProducts,
  syncOrders,
  setupWebhooks,
  getWebhooks
};
