# Affiliate Platform MVP

Graph-based affiliate tracking dashboard leveraging Neo4j's hub-and-spoke model for influencers with federated integrations to existing affiliate systems.

## Project Overview

This platform allows for tracking and managing affiliate relationships and their performance using a graph database model. It connects with Shopify through webhooks to track orders and attributes them to the appropriate affiliates.

## Getting Started

# Affiliate Platform Integration Guide

## Shopify Integration

This guide will help you set up the integration between your Shopify store and the Affiliate Platform.

### Prerequisites

1. A Shopify store (Basic plan or higher)
2. Admin access to your Shopify store
3. The Affiliate Platform API deployed and running

### Step 1: Create a Private App in Shopify

1. Log in to your Shopify admin
2. Go to Apps > Manage private apps
3. Click "Create new private app"
4. Fill in the details:
   - App name: Affiliate Platform
   - Emergency developer email: your email
5. Under "Admin API", set the following permissions:
   - Orders: Read access
   - Products: Read access
   - Customers: Read access
6. Click "Save"
7. Note the API key and Password that are generated

### Step 2: Configure Webhooks in Shopify

1. Go to Settings > Notifications > Webhooks
2. Click "Create webhook"
3. Configure the following webhooks, pointing to your Affiliate Platform API:
   - Event: Order creation
     - Format: JSON
     - URL: https://your-api-url.com/api/webhooks/order/created
   - Event: Order cancellation
     - Format: JSON
     - URL: https://your-api-url.com/api/webhooks/order/cancelled
   - Event: Order fulfillment
     - Format: JSON
     - URL: https://your-api-url.com/api/webhooks/order/fulfilled
   - Event: Product creation
     - Format: JSON
     - URL: https://your-api-url.com/api/webhooks/product/created
   - Event: Product update
     - Format: JSON
     - URL: https://your-api-url.com/api/webhooks/product/updated
   - Event: Product deletion
     - Format: JSON
     - URL: https://your-api-url.com/api/webhooks/product/deleted

### Step 3: Update Your .env Configuration

Add the following variables to your API's `.env` file:
SHOPIFY_SHOP_NAME=your-store-name
SHOPIFY_API_KEY=your-api-key
SHOPIFY_API_PASSWORD=your-api-password
SHOPIFY_WEBHOOK_SECRET=your-webhook-secret
SHOPIFY_SHOP_URL=https://your-store.myshopify.com

### Prerequisites

- Docker and Docker Compose
- Node.js (v18+)
- npm or yarn
- Firebase account for authentication

### Setup Instructions

1. Clone the repository:
   ```
   git clone https://github.com/yourusername/affiliate-platform.git
   cd affiliate-platform
   ```

2. Update environment variables:
   - Edit `.env` in the `api` directory
   - Edit `.env.local` in the `frontend` directory

3. Start the Neo4j database:
   ```
   docker-compose up -d neo4j
   ```

4. Wait for Neo4j to initialize, then run the database seed script:
   ```
   cd api
   npm run seed
   ```

5. Start the backend API:
   ```
   npm run dev
   ```

6. In a new terminal, start the frontend:
   ```
   cd frontend
   npm run dev
   ```

7. Access the application:
   - Frontend: http://localhost:3001
   - Backend API: http://localhost:3000
   - Neo4j Browser: http://localhost:7474 (username: neo4j, password: the one you specified)

## Key Features

- **Neo4j Graph Model**: Person and Product nodes with AFFILIATES and FOLLOWS relationships
- **Shopify Integration**: Webhook for orders/create to track referrals
- **Admin Dashboard**: Global snapshot cards, basic affiliate table, CSV export
- **Affiliate Dashboard**: Personal stats, simple product breakdown, profile editor
- **Authentication**: Firebase Auth with admin/affiliate role separation

## Project Structure

- `/api` - Backend Express API with Neo4j integration
- `/frontend` - Next.js frontend application
- `/docker-compose.yml` - Docker configuration for the stack

## Development Workflow

1. Make changes to the codebase
2. Test locally with `npm run dev`
3. Build for production with `npm run build`
4. Deploy using Docker Compose

## Deployment

For production deployment:

```bash
docker-compose -f docker-compose.yml -f docker-compose.prod.yml up -d
```

## License

This project is licensed under the MIT License - see the LICENSE file for details.
