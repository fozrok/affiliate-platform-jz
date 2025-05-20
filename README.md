# Affiliate Platform MVP

Graph-based affiliate tracking dashboard leveraging Neo4j's hub-and-spoke model for influencers with federated integrations to existing affiliate systems.

## Project Overview

This platform allows for tracking and managing affiliate relationships and their performance using a graph database model. It connects with Shopify through webhooks to track orders and attributes them to the appropriate affiliates.

## Getting Started

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
