// api/src/scripts/scheduledSync.ts

import cron from 'node-cron';
import shopifyService from '../services/shopifyService';
import dataNormalizationService from '../services/dataNormalizationService';
import neo4jConfig from '../config/neo4j';

// Verify database connection
neo4jConfig.verifyConnectivity()
  .then(() => {
    console.log('Starting scheduled sync service');
    
    // Sync products daily at 1 AM
    cron.schedule('0 1 * * *', async () => {
      try {
        console.log('Running scheduled product sync');
        const products = await shopifyService.getAllResources('/products.json', 'products');
        await dataNormalizationService.normalizeProducts(products);
        console.log(`Successfully synced ${products.length} products`);
      } catch (error) {
        console.error('Scheduled product sync failed:', error);
      }
    });
    
    // Sync orders every 2 hours
    cron.schedule('0 */2 * * *', async () => {
      try {
        console.log('Running scheduled order sync');
        
        // Only sync orders from the last 3 days
        const threeDaysAgo = new Date();
        threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
        
        const params = {
          created_at_min: threeDaysAgo.toISOString()
        };
        
        const orders = await shopifyService.getOrders(params);
        await dataNormalizationService.normalizeOrders(orders.orders);
        console.log(`Successfully synced ${orders.orders.length} orders`);
      } catch (error) {
        console.error('Scheduled order sync failed:', error);
      }
    });
  })
  .catch(err => {
    console.error('Failed to start scheduled sync service:', err);
    process.exit(1);
  });
