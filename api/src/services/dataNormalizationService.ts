// api/src/services/dataNormalizationService.ts

import neo4jConfig from '../config/neo4j';
import { Session } from 'neo4j-driver';

interface ShopifyProduct {
  id: number;
  title: string;
  body_html: string;
  vendor: string;
  product_type: string;
  created_at: string;
  updated_at: string;
  variants: ShopifyProductVariant[];
  tags: string;
  // Other fields...
}

interface ShopifyProductVariant {
  id: number;
  product_id: number;
  title: string;
  price: string;
  sku: string;
  // Other fields...
}

interface ShopifyOrder {
  id: number;
  name: string;
  total_price: string;
  financial_status: string;
  fulfillment_status: string | null;
  customer: ShopifyCustomer;
  line_items: ShopifyLineItem[];
  created_at: string;
  updated_at: string;
  processed_at: string;
  note_attributes: Array<{name: string, value: string}>;
  // Other fields...
}

interface ShopifyCustomer {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  // Other fields...
}

interface ShopifyLineItem {
  id: number;
  product_id: number;
  variant_id: number;
  title: string;
  quantity: number;
  price: string;
  // Other fields...
}

class DataNormalizationService {
  
  // Normalize and import product data
  async normalizeProducts(products: ShopifyProduct[]): Promise<void> {
    const session = neo4jConfig.session();
    
    try {
      // Process products in batches
      const batchSize = 50;
      for (let i = 0; i < products.length; i += batchSize) {
        const batch = products.slice(i, i + batchSize);
        await this.processBatchOfProducts(session, batch);
        console.log(`Processed ${Math.min(i + batchSize, products.length)} of ${products.length} products`);
      }
    } catch (error) {
      console.error('Error normalizing products:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
  
  private async processBatchOfProducts(session: Session, products: ShopifyProduct[]): Promise<void> {
    const tx = session.beginTransaction();
    
    try {
      for (const product of products) {
        // Create/update product node
        await tx.run(`
          MERGE (p:Product {id: $productId})
          ON CREATE SET
            p.name = $productName,
            p.description = $productDescription,
            p.type = $productType,
            p.vendor = $productVendor,
            p.tags = $productTags,
            p.shopify_created_at = datetime($createdAt),
            p.created_at = datetime()
          ON MATCH SET
            p.name = $productName,
            p.description = $productDescription,
            p.type = $productType,
            p.vendor = $productVendor,
            p.tags = $productTags,
            p.shopify_updated_at = datetime($updatedAt),
            p.updated_at = datetime()
        `, {
          productId: product.id.toString(),
          productName: product.title,
          productDescription: product.body_html,
          productType: product.product_type,
          productVendor: product.vendor,
          productTags: product.tags,
          createdAt: product.created_at,
          updatedAt: product.updated_at
        });
        
        // Process each variant
        for (const variant of product.variants) {
          await tx.run(`
            MATCH (p:Product {id: $productId})
            MERGE (v:ProductVariant {id: $variantId})
            ON CREATE SET
              v.title = $variantTitle,
              v.price = toFloat($variantPrice),
              v.sku = $variantSku,
              v.created_at = datetime()
            ON MATCH SET
              v.title = $variantTitle,
              v.price = toFloat($variantPrice),
              v.sku = $variantSku,
              v.updated_at = datetime()
            MERGE (p)-[r:HAS_VARIANT]->(v)
          `, {
            productId: product.id.toString(),
            variantId: variant.id.toString(),
            variantTitle: variant.title,
            variantPrice: variant.price,
            variantSku: variant.sku
          });
        }
        
        // Create product categories based on product_type
        if (product.product_type) {
          await tx.run(`
            MERGE (c:Category {name: $categoryName})
            ON CREATE SET c.created_at = datetime()
            WITH c
            MATCH (p:Product {id: $productId})
            MERGE (p)-[r:IN_CATEGORY]->(c)
          `, {
            categoryName: product.product_type,
            productId: product.id.toString()
          });
        }
      }
      
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
  
  // Normalize and import order data
  async normalizeOrders(orders: ShopifyOrder[]): Promise<void> {
    const session = neo4jConfig.session();
    
    try {
      // Process orders in batches
      const batchSize = 50;
      for (let i = 0; i < orders.length; i += batchSize) {
        const batch = orders.slice(i, i + batchSize);
        await this.processBatchOfOrders(session, batch);
        console.log(`Processed ${Math.min(i + batchSize, orders.length)} of ${orders.length} orders`);
      }
    } catch (error) {
      console.error('Error normalizing orders:', error);
      throw error;
    } finally {
      await session.close();
    }
  }
  
  private async processBatchOfOrders(session: Session, orders: ShopifyOrder[]): Promise<void> {
    const tx = session.beginTransaction();
    
    try {
      for (const order of orders) {
        // Create customer if it doesn't exist
        if (order.customer) {
          await tx.run(`
            MERGE (c:Customer {id: $customerId})
            ON CREATE SET
              c.email = $customerEmail,
              c.firstName = $customerFirstName,
              c.lastName = $customerLastName,
              c.created_at = datetime()
            ON MATCH SET
              c.email = $customerEmail,
              c.firstName = $customerFirstName,
              c.lastName = $customerLastName,
              c.updated_at = datetime()
          `, {
            customerId: order.customer.id.toString(),
            customerEmail: order.customer.email,
            customerFirstName: order.customer.first_name,
            customerLastName: order.customer.last_name
          });
        }
        
        // Create order
        await tx.run(`
          MERGE (o:Order {id: $orderId})
          ON CREATE SET
            o.name = $orderName,
            o.total = toFloat($orderTotal),
            o.status = $orderStatus,
            o.fulfillment_status = $fulfillmentStatus,
            o.shopify_created_at = datetime($createdAt),
            o.processed_at = datetime($processedAt),
            o.created_at = datetime()
          ON MATCH SET
            o.name = $orderName,
            o.total = toFloat($orderTotal),
            o.status = $orderStatus,
            o.fulfillment_status = $fulfillmentStatus,
            o.shopify_updated_at = datetime($updatedAt),
            o.updated_at = datetime()
        `, {
          orderId: order.id.toString(),
          orderName: order.name,
          orderTotal: order.total_price,
          orderStatus: order.financial_status || 'unknown',
          fulfillmentStatus: order.fulfillment_status || 'unfulfilled',
          createdAt: order.created_at,
          updatedAt: order.updated_at,
          processedAt: order.processed_at
        });
        
        // Link customer to order if customer exists
        if (order.customer) {
          await tx.run(`
            MATCH (c:Customer {id: $customerId})
            MATCH (o:Order {id: $orderId})
            MERGE (c)-[r:PLACED]->(o)
            ON CREATE SET r.date = datetime($processedAt)
          `, {
            customerId: order.customer.id.toString(),
            orderId: order.id.toString(),
            processedAt: order.processed_at
          });
        }
        
        // Process line items
        for (const item of order.line_items) {
          // Link order to product variant
          await tx.run(`
            MATCH (o:Order {id: $orderId})
            
            // Find or create the product if it doesn't exist yet
            MERGE (p:Product {id: $productId})
            ON CREATE SET
              p.name = $productTitle,
              p.created_at = datetime()
            
            // Find or create the variant
            MERGE (v:ProductVariant {id: $variantId})
            ON CREATE SET
              v.title = $variantTitle,
              v.price = toFloat($variantPrice),
              v.created_at = datetime()
            
            // Ensure product-variant relationship
            MERGE (p)-[pv:HAS_VARIANT]->(v)
            
            // Create order-variant relationship with line item details
            MERGE (o)-[r:INCLUDES]->(v)
            ON CREATE SET
              r.quantity = toInteger($quantity),
              r.price = toFloat($price),
              r.total = toFloat($lineTotal),
              r.created_at = datetime($createdAt)
          `, {
            orderId: order.id.toString(),
            productId: item.product_id.toString(),
            variantId: item.variant_id.toString(),
            productTitle: item.title.split(' - ')[0], // Remove variant info from title
            variantTitle: item.title,
            variantPrice: item.price,
            quantity: item.quantity,
            price: item.price,
            lineTotal: parseFloat(item.price) * item.quantity,
            createdAt: order.created_at
          });
        }
        
        // Process affiliate code if present in note attributes
        const affiliateAttr = order.note_attributes?.find(
          attr => attr.name === 'affiliate_code' || attr.name === 'affiliateCode'
        );
        
        if (affiliateAttr?.value) {
          await this.processAffiliateAttribution(tx, order.id.toString(), affiliateAttr.value, order.processed_at);
        }
      }
      
      await tx.commit();
    } catch (error) {
      await tx.rollback();
      throw error;
    }
  }
  
  // Handle affiliate attribution
  private async processAffiliateAttribution(
    tx: any, 
    orderId: string, 
    affiliateCode: string, 
    processedAt: string
  ): Promise<void> {
    // Find affiliate by code and connect to order
    const affiliateResult = await tx.run(`
      MATCH (a:Person {affiliateCode: $affiliateCode})
      MATCH (o:Order {id: $orderId})
      MERGE (a)-[r:REFERRED]->(o)
      ON CREATE SET 
        r.date = datetime($processedAt),
        r.commission = 0, // Will calculate actual commission later
        r.tier = 'primary'
      RETURN a.id as affiliateId
    `, {
      affiliateCode,
      orderId,
      processedAt
    });
    
    if (affiliateResult.records.length === 0) {
      return; // No affiliate found with this code
    }
    
    const affiliateId = affiliateResult.records[0].get('affiliateId');
    
    // Calculate commissions based on order items and affiliate level
    await tx.run(`
      // Match the order and all included product variants
      MATCH (a:Person {id: $affiliateId})-[ref:REFERRED]->(o:Order {id: $orderId})
      MATCH (o)-[inc:INCLUDES]->(v:ProductVariant)
      
      // Calculate commission for each product
      WITH a, ref, o, v, inc
      
      // Try to find specific product commission rate for this affiliate
      OPTIONAL MATCH (a)-[aff:AFFILIATES]->(p:Product)-[:HAS_VARIANT]->(v)
      
      // Calculate the line item commission
      WITH a, ref, o, v, inc,
        CASE
          WHEN aff.commission_rate IS NOT NULL THEN aff.commission_rate
          // Default rates by affiliate level
          WHEN a.level = 'gold' THEN 0.15
          WHEN a.level = 'silver' THEN 0.1
          WHEN a.level = 'bronze' THEN 0.05
          ELSE 0.03
        END AS commissionRate
      
      // Sum up all commissions for the order
      WITH ref, SUM(inc.total * commissionRate) AS totalCommission
      
      // Update the referral relationship with the total commission
      SET ref.commission = totalCommission
    `, {
      affiliateId,
      orderId
    });
    
    // Handle multi-tier attribution
    await tx.run(`
      MATCH (affiliate:Person {id: $affiliateId})-[:FOLLOWS]->(influencer:Person)
      MATCH (affiliate)-[r1:REFERRED]->(o:Order {id: $orderId})
      MERGE (influencer)-[r2:INFLUENCED]->(o)
      ON CREATE SET 
        r2.date = datetime($processedAt),
        r2.tier = 'secondary',
        r2.commission = r1.commission * 0.1 // 10% of primary commission
    `, {
      affiliateId,
      orderId,
      processedAt
    });
  }
}

export default new DataNormalizationService();
