// api/src/services/shopifyService.ts

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ShopifyConfig {
  shopName: string;
  apiKey: string;
  password: string;
  apiVersion: string;
}

class ShopifyService {
  private baseUrl: string;
  private authHeader: string;
  
  constructor(config: ShopifyConfig) {
    this.baseUrl = `https://${config.shopName}.myshopify.com/admin/api/${config.apiVersion}`;
    this.authHeader = Buffer.from(`${config.apiKey}:${config.password}`).toString('base64');
  }

  private async request<T>(endpoint: string, method: string = 'GET', data?: any): Promise<T> {
    try {
      const response = await axios({
        method,
        url: `${this.baseUrl}${endpoint}`,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Basic ${this.authHeader}`
        },
        data
      });
      
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response) {
        console.error(`Shopify API error (${error.response.status}): ${JSON.stringify(error.response.data)}`);
      } else {
        console.error('Shopify API error:', error);
      }
      throw error;
    }
  }

  // Products
  async getProducts(params: any = {}): Promise<any> {
    return this.request('/products.json', 'GET', { params });
  }

  async getProductById(productId: string): Promise<any> {
    return this.request(`/products/${productId}.json`);
  }

  // Orders
  async getOrders(params: any = {}): Promise<any> {
    return this.request('/orders.json', 'GET', { params });
  }

  async getOrderById(orderId: string): Promise<any> {
    return this.request(`/orders/${orderId}.json`);
  }

  // Customers
  async getCustomers(params: any = {}): Promise<any> {
    return this.request('/customers.json', 'GET', { params });
  }

  async getCustomerById(customerId: string): Promise<any> {
    return this.request(`/customers/${customerId}.json`);
  }

  // Webhooks
  async createWebhook(topic: string, address: string): Promise<any> {
    return this.request('/webhooks.json', 'POST', {
      webhook: {
        topic,
        address,
        format: 'json'
      }
    });
  }

  async listWebhooks(): Promise<any> {
    return this.request('/webhooks.json');
  }

  // Pagination helper method
  async getAllResources<T>(endpoint: string, resourceName: string): Promise<T[]> {
    let allResources: T[] = [];
    let nextPageParams: any = null;
    let page = 1;
    
    do {
      const response: any = await this.request(endpoint, 'GET', { params: nextPageParams });
      allResources = [...allResources, ...response[resourceName]];
      
      // Check if there are more pages
      nextPageParams = null;
      if (response.links?.next) {
        nextPageParams = { page_info: this.extractPageInfoFromLink(response.links.next) };
        page++;
      }
      
      console.log(`Retrieved page ${page} of ${resourceName}, got ${response[resourceName].length} items`);
    } while (nextPageParams);
    
    return allResources;
  }
  
  private extractPageInfoFromLink(link: string): string {
    const match = link.match(/page_info=([^&]*)/);
    return match ? match[1] : '';
  }
}

// Initialize with environment variables
const shopifyService = new ShopifyService({
  shopName: process.env.SHOPIFY_SHOP_NAME || '',
  apiKey: process.env.SHOPIFY_API_KEY || '',
  password: process.env.SHOPIFY_API_PASSWORD || '',
  apiVersion: process.env.SHOPIFY_API_VERSION || '2023-07'
});

export default shopifyService;
