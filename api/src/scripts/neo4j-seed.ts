import neo4jConfig from '../config/neo4j';
console.log('Using Neo4j URI:', process.env.NEO4J_URI);
console.log('Using Neo4j User:', process.env.NEO4J_USER);
console.log('Using Neo4j Password:', process.env.NEO4J_PASSWORD);
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const setupDatabase = async (): Promise<void> => {
  const session = neo4jConfig.session();

  try {
    console.log('Setting up Neo4j database...');

    // Create constraints
    await session.run(`
      CREATE CONSTRAINT Person_id IF NOT EXISTS FOR (p:Person) REQUIRE p.id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT Product_id IF NOT EXISTS FOR (p:Product) REQUIRE p.id IS UNIQUE
    `);

    await session.run(`
      CREATE CONSTRAINT Order_id IF NOT EXISTS FOR (o:Order) REQUIRE o.id IS UNIQUE
    `);

    // Create indexes for better performance
    await session.run(`
      CREATE INDEX Person_email_idx IF NOT EXISTS FOR (p:Person) ON (p.email)
    `);

    await session.run(`
      CREATE INDEX Person_level_idx IF NOT EXISTS FOR (p:Person) ON (p.level)
    `);

    await session.run(`
      CREATE INDEX Product_type_idx IF NOT EXISTS FOR (p:Product) ON (p.type)
    `);

    await session.run(`
      CREATE INDEX Order_status_idx IF NOT EXISTS FOR (o:Order) ON (o.status)
    `);

    // Create sample data
    console.log('Creating sample data...');
    
    // Create admin user
    await session.run(`
      MERGE (p:Person {id: 'admin1'})
      ON CREATE SET p.name = 'Admin User',
                   p.email = 'admin@example.com',
                   p.level = 'admin',
                   p.role = 'admin',
                   p.affiliateCode = 'ADMIN001',
                   p.created_at = datetime()
    `);

    // Create affiliate users
    const affiliates = [
      { id: 'aff1', name: 'John Doe', email: 'john@example.com', level: 'gold' },
      { id: 'aff2', name: 'Jane Smith', email: 'jane@example.com', level: 'silver' },
      { id: 'aff3', name: 'Bob Johnson', email: 'bob@example.com', level: 'bronze' }
    ];

    for (const aff of affiliates) {
      await session.run(`
        MERGE (p:Person {id: $id})
        ON CREATE SET p.name = $name,
                     p.email = $email,
                     p.level = $level,
                     p.role = 'affiliate',
                     p.affiliateCode = $affiliateCode,
                     p.created_at = datetime()
      `, {
        ...aff,
        affiliateCode: `AFF${aff.id.toUpperCase()}`
      });
    }

    // Create products
    const products = [
      { id: 'prod1', name: 'Premium Course', price: 299.99, type: 'course' },
      { id: 'prod2', name: 'Starter Package', price: 99.99, type: 'package' },
      { id: 'prod3', name: 'Monthly Subscription', price: 19.99, type: 'subscription' }
    ];

    for (const prod of products) {
      await session.run(`
        MERGE (p:Product {id: $id})
        ON CREATE SET p.name = $name,
                     p.price = $price,
                     p.type = $type,
                     p.created_at = datetime()
      `, prod);
    }

    // Create affiliate relationships
    await session.run(`
      MATCH (a:Person {id: 'aff1'}), (p:Product {id: 'prod1'})
      MERGE (a)-[r:AFFILIATES]->(p)
      ON CREATE SET r.commission_rate = 0.15,
                   r.date_created = datetime()
    `);

    await session.run(`
      MATCH (a:Person {id: 'aff1'}), (p:Product {id: 'prod2'})
      MERGE (a)-[r:AFFILIATES]->(p)
      ON CREATE SET r.commission_rate = 0.1,
                   r.date_created = datetime()
    `);

    await session.run(`
      MATCH (a:Person {id: 'aff2'}), (p:Product {id: 'prod2'})
      MERGE (a)-[r:AFFILIATES]->(p)
      ON CREATE SET r.commission_rate = 0.1,
                   r.date_created = datetime()
    `);

    await session.run(`
      MATCH (a:Person {id: 'aff3'}), (p:Product {id: 'prod3'})
      MERGE (a)-[r:AFFILIATES]->(p)
      ON CREATE SET r.commission_rate = 0.2,
                   r.date_created = datetime()
    `);

    // Create follow relationships
    await session.run(`
      MATCH (a:Person {id: 'aff2'}), (b:Person {id: 'aff1'})
      MERGE (a)-[r:FOLLOWS]->(b)
      ON CREATE SET r.date_created = datetime()
    `);

    await session.run(`
      MATCH (a:Person {id: 'aff3'}), (b:Person {id: 'aff1'})
      MERGE (a)-[r:FOLLOWS]->(b)
      ON CREATE SET r.date_created = datetime()
    `);

    console.log('Database setup completed successfully!');
  } catch (error) {
    console.error('Error setting up database:', error);
    process.exit(1);
  } finally {
    await session.close();
  }
};

// Run the setup
setupDatabase()
  .then(() => {
    console.log('Seed script completed');
    process.exit(0);
  })
  .catch(error => {
    console.error('Seed script failed:', error);
    process.exit(1);
  });
