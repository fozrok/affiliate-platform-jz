import neo4j, { Driver, Session } from 'neo4j-driver';
import dotenv from 'dotenv';

dotenv.config();

const {
  NEO4J_URI = 'bolt://localhost:7687',
  NEO4J_USER = 'neo4j',
  NEO4J_PASSWORD = 'password'
} = process.env;

const driver: Driver = neo4j.driver(
  NEO4J_URI,
  neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD),
  {
    maxConnectionLifetime: 3 * 60 * 60 * 1000, // 3 hours
    maxConnectionPoolSize: 50,
    connectionAcquisitionTimeout: 2 * 60 * 1000 // 2 minutes
  }
);

// Test the connection
const verifyConnectivity = async (): Promise<void> => {
  try {
    await driver.verifyConnectivity();
    console.log('Connected to Neo4j database');
  } catch (error) {
    console.error('Failed to connect to Neo4j:', error);
    process.exit(1);
  }
};

// Helper function to run queries
const runQuery = async (query: string, params = {}): Promise<any> => {
  const session: Session = driver.session();
  try {
    const result = await session.run(query, params);
    return result;
  } finally {
    await session.close();
  }
};

export default {
  driver,
  session: (): Session => driver.session(),
  runQuery,
  verifyConnectivity
};
