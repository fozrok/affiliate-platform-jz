import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import neo4jConfig from '../config/neo4j';

const router = express.Router();

// Shopify webhook verification middleware
const verifyShopifyWebhook = (req: Request, res: Response, next: NextFunction) => {
  const hmacHeader = req.headers['x-shopify-hmac-sha256'] as string;
  const body = req.rawBody; // Raw body from earlier middleware
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET || '';
  
  const hmac = crypto
    .createHmac('sha256', secret)
    .update(body, 'utf8')
    .digest('base64');
  
  if (hmac === hmacHeader) {
    // Parse the raw JSON body for our route handlers
    req.body = JSON.parse(body.toString());
    next();
  } else {
    res.status(401).send('Invalid webhook signature');
  }
};

// Order creation webhook handler
router.post(
  '/order/created',
  verifyShopifyWebhook,
  async (req: Request, res: Response) => {
    const session = neo4jConfig.session();
    try {
      const {
        id: orderId,
        total_price: totalPrice,
        line_items: lineItems,
        customer,
        note_attributes,
      } = req.body;
      
      // Find affiliate code from order notes
      const affiliateCode = note_attributes?.find(
        (attr: any) => attr.name === 'affiliate_code'
      )?.value;
      
      if (!affiliateCode) {
        // No affiliate code found, just acknowledge the webhook
        res.status(200).send('Order processed without affiliate');
        return;
      }
      
      // Create order node
      await session.run(
        `
        CREATE (o:Order {
          id: $orderId,
          total: toFloat($totalPrice),
          status: 'created',
          date: datetime(),
          customerEmail: $customerEmail
        })
      `,
        {
          orderId: orderId.toString(),
          totalPrice,
          customerEmail: customer.email,
        }
      );
      
      // (…additional Cypher to link order to products or affiliates…)
      
      res.status(200).send('Order processed successfully');
    } catch (error) {
      console.error('Error processing Shopify webhook:', error);
      res.status(500).send('Internal server error');
    } finally {
      await session.close();
    }
  }
);

export default router;
