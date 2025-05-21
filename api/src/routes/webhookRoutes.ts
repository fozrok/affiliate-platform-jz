import express from 'express';
import crypto from 'crypto';
import neo4jConfig from '../config/neo4j';

const router = express.Router();

// Middleware to verify Shopify HMAC
const verifyShopifyWebhook: express.RequestHandler = (req, res, next) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
  const body: Buffer = req.rawBody;
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('base64');

  if (hmac === hmacHeader) {
    next();
  } else {
    res.status(401).send('Invalid webhook signature');
  }
};

// Log webhook receipt for debugging
const logWebhook: express.RequestHandler = (req, res, next) => {
  console.log(`Received webhook: ${req.path}`);
  console.log(`Headers: ${JSON.stringify(req.headers)}`);
  next();
};

// Handle order creation webhooks
router.post('/order/created', verifyShopifyWebhook, logWebhook, async (req, res) => {
  const session = neo4jConfig.session();
  try {
    const {
      id: orderId,
      total_price: totalPrice,
      line_items: lineItems,
      customer,
      note_attributes,
      financial_status,
      processed_at,
    } = req.body;

    console.log(`Processing order ${orderId} with ${lineItems.length} items`);

    // Find affiliate code in note attributes
    const noteAttrs = Array.isArray(note_attributes) ? note_attributes : [];
    const affiliateCode = noteAttrs.find(
      (attr: any) => attr.name === 'affiliate_code' || attr.name === 'affiliateCode'
    )?.value;

    if (!affiliateCode) {
      console.log(`Order ${orderId} has no affiliate code`);
      res.status(200).send('Order processed without affiliate');
      return;
    }

    console.log(`Found affiliate code: ${affiliateCode}`);

    // Create order node
    await session.run(
      `MERGE (o:Order {id: $orderId})
       ON CREATE SET
         o.total = toFloat($totalPrice),
         o.status = $status,
         o.date = datetime($processedAt),
         o.customerEmail = $customerEmail,
         o.createdAt = datetime()`,
      {
        orderId: orderId.toString(),
        totalPrice,
        status: financial_status || 'created',
        processedAt: processed_at || new Date().toISOString(),
        customerEmail: customer?.email || 'unknown',
      }
    );

    // Find the affiliate by code and link to the order
    const affiliateResult = await session.run(`
      MATCH (a:Person {affiliateCode: $affiliateCode})
      MATCH (o:Order {id: $orderId})
      MERGE (a)-[r:REFERRED]->(o)
      ON CREATE SET 
        r.date = datetime(),
        r.commission = 0, // Will calculate actual commission later
        r.tier = 'primary'
      RETURN a.id as affiliateId, a.level as affiliateLevel
    `, {
      affiliateCode,
      orderId: orderId.toString()
    });

    if (affiliateResult.records.length === 0) {
      console.log(`No affiliate found with code: ${affiliateCode}`);
      res.status(200).send(`Order processed but no affiliate found with code: ${affiliateCode}`);
      return;
    }

    const affiliateId = affiliateResult.records[0].get('affiliateId');
    const affiliateLevel = affiliateResult.records[0].get('affiliateLevel');
    
    console.log(`Linked order to affiliate: ${affiliateId} (${affiliateLevel})`);

    // Process each line item (product) in the order
    let totalCommission = 0;
    
    for (const item of lineItems) {
      const productId = item.product_id.toString();
      const variantId = item.variant_id?.toString() || 'default';
      const price = parseFloat(item.price);
      const quantity = parseInt(item.quantity, 10);
      
      // Find or create product
      await session.run(`
        MERGE (p:Product {id: $productId})
        ON CREATE SET 
          p.name = $productName,
          p.price = toFloat($productPrice),
          p.type = 'shopify_product',
          p.created_at = datetime()
        ON MATCH SET
          p.name = $productName,
          p.price = toFloat($productPrice),
          p.updated_at = datetime()
      `, {
        productId,
        productName: item.title,
        productPrice: price
      });

      // Link order to product
      await session.run(`
        MATCH (o:Order {id: $orderId})
        MATCH (p:Product {id: $productId})
        MERGE (o)-[r:INCLUDES]->(p)
        ON CREATE SET 
          r.quantity = toInteger($quantity),
          r.variant_id = $variantId,
          r.price = toFloat($price),
          r.total = toFloat($lineTotal)
      `, {
        orderId: orderId.toString(),
        productId,
        variantId,
        quantity,
        price,
        lineTotal: price * quantity
      });
      
      // Calculate commission based on affiliate level and product
      // Check if this affiliate has a specific commission rate for this product
      const commissionResult = await session.run(`
        MATCH (a:Person {id: $affiliateId})-[aff:AFFILIATES]->(p:Product {id: $productId})
        RETURN aff.commission_rate as rate
        UNION
        MATCH (a:Person {id: $affiliateId})
        WHERE NOT EXISTS {(a)-[:AFFILIATES]->(:Product {id: $productId})}
        // Default commission rates by affiliate level if no specific rate exists
        RETURN 
          CASE a.level
            WHEN 'gold' THEN 0.15
            WHEN 'silver' THEN 0.1
            WHEN 'bronze' THEN 0.05
            ELSE 0.02
          END as rate
        LIMIT 1
      `, {
        affiliateId,
        productId
      });
      
      const commissionRate = commissionResult.records.length > 0 
        ? parseFloat(commissionResult.records[0].get('rate').toString()) 
        : 0.05; // Fallback rate
      
      const lineCommission = price * quantity * commissionRate;
      totalCommission += lineCommission;
      
      console.log(`Calculated commission for product ${productId}: $${lineCommission.toFixed(2)} (${commissionRate * 100}%)`);
    }
    
    // Update the total commission for this referral
    await session.run(`
      MATCH (a:Person {id: $affiliateId})-[r:REFERRED]->(o:Order {id: $orderId})
      SET r.commission = toFloat($commission)
    `, {
      affiliateId,
      orderId: orderId.toString(),
      commission: totalCommission
    });
    
    console.log(`Updated total commission for order ${orderId}: $${totalCommission.toFixed(2)}`);

    // Handle multi-tier attribution (if the affiliate follows another influencer)
    const multiTierResult = await session.run(`
      MATCH (affiliate:Person {id: $affiliateId})-[:FOLLOWS]->(influencer:Person)
      MATCH (o:Order {id: $orderId})
      MERGE (influencer)-[r:INFLUENCED]->(o)
      ON CREATE SET 
        r.date = datetime(),
        r.tier = 'secondary',
        r.commission = toFloat($secondaryCommission)
      RETURN influencer.id as influencerId
    `, {
      affiliateId,
      orderId: orderId.toString(),
      secondaryCommission: totalCommission * 0.1 // 10% of primary commission goes to the influencer
    });
    
    if (multiTierResult.records.length > 0) {
      const influencerId = multiTierResult.records[0].get('influencerId');
      console.log(`Created secondary attribution to influencer: ${influencerId}`);
    }

    res.status(200).send('Order processed successfully');
  } catch (error) {
    console.error('Error processing Shopify webhook:', error);
    res.status(500).send('Internal server error');
  } finally {
    await session.close();
  }
});

// Handle order cancellation
router.post('/order/cancelled', verifyShopifyWebhook, logWebhook, async (req, res) => {
  const session = neo4jConfig.session();
  try {
    const { id: orderId } = req.body;
    
    // Update order status
    await session.run(`
      MATCH (o:Order {id: $orderId})
      SET o.status = 'cancelled',
          o.cancelled_at = datetime()
    `, {
      orderId: orderId.toString()
    });
    
    // Adjust commissions to zero
    await session.run(`
      MATCH (p:Person)-[r:REFERRED|INFLUENCED]->(o:Order {id: $orderId})
      SET r.commission = 0,
          r.status = 'cancelled'
    `, {
      orderId: orderId.toString()
    });
    
    console.log(`Cancelled order ${orderId} and zeroed commissions`);
    res.status(200).send('Order cancellation processed');
  } catch (error) {
    console.error('Error processing order cancellation:', error);
    res.status(500).send('Internal server error');
  } finally {
    await session.close();
  }
});

// Handle order fulfillment (shipping)
router.post('/order/fulfilled', verifyShopifyWebhook, logWebhook, async (req, res) => {
  const session = neo4jConfig.session();
  try {
    const { id: orderId } = req.body;
    
    // Update order status
    await session.run(`
      MATCH (o:Order {id: $orderId})
      SET o.status = 'fulfilled',
          o.fulfilled_at = datetime()
    `, {
      orderId: orderId.toString()
    });
    
    console.log(`Marked order ${orderId} as fulfilled`);
    res.status(200).send('Order fulfillment processed');
  } catch (error) {
    console.error('Error processing order fulfillment:', error);
    res.status(500).send('Internal server error');
  } finally {
    await session.close();
  }
});


// api/src/routes/webhookRoutes.ts

// Add these routes to your existing webhookRoutes.ts file

// Handle product creation
router.post('/product/created', verifyShopifyWebhook, logWebhook, async (req, res) => {
  const session = neo4jConfig.session();
  try {
    const product = req.body;
    
    // Normalize and import the single product
    await dataNormalizationService.normalizeProducts([product]);
    
    res.status(200).send('Product created successfully');
  } catch (error) {
    console.error('Error processing product creation webhook:', error);
    res.status(500).send('Internal server error');
  } finally {
    await session.close();
  }
});

// Handle product updates
router.post('/product/updated', verifyShopifyWebhook, logWebhook, async (req, res) => {
  const session = neo4jConfig.session();
  try {
    const product = req.body;
    
    // Normalize and import the updated product
    await dataNormalizationService.normalizeProducts([product]);
    
    res.status(200).send('Product updated successfully');
  } catch (error) {
    console.error('Error processing product update webhook:', error);
    res.status(500).send('Internal server error');
  } finally {
    await session.close();
  }
});

// Handle product deletion
router.post('/product/deleted', verifyShopifyWebhook, logWebhook, async (req, res) => {
  const session = neo4jConfig.session();
  try {
    const { id: productId } = req.body;
    
    // Mark product as deleted
    await session.run(`
      MATCH (p:Product {id: $productId})
      SET p.deleted = true,
          p.deleted_at = datetime()
    `, {
      productId: productId.toString()
    });
    
    res.status(200).send('Product deletion processed');
  } catch (error) {
    console.error('Error processing product deletion webhook:', error);
    res.status(500).send('Internal server error');
  } finally {
    await session.close();
  }
});


// Testing endpoint - can be removed in production
router.get('/test', (req, res) => {
  res.status(200).json({
    status: 'Webhook routes operational',
    endpoints: [
      '/webhook/order/created',
      '/webhook/order/cancelled',
      '/webhook/order/fulfilled'
    ]
  });
});

export default router;
