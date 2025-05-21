// api/src/config/neo4j.ts
import neo4j, { Driver, Session } from 'neo4j-driver';
import path from 'path';
import dotenv from 'dotenv';

// Load env vars from the project root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const uri      = process.env.NEO4J_URI      || 'bolt://localhost:7687';
const user     = process.env.NEO4J_USER     || 'neo4j';
const password = process.env.NEO4J_PASSWORD || 'T3sla12e!';

// Create a Bolt driver (unencrypted for local development)
const driver: Driver = neo4j.driver(
  uri,
  neo4j.auth.basic(user, password),
  // cast to any so TS accepts the old encryption flag
  ({ encrypted: 'ENCRYPTION_OFF' } as any)
);

// Verify connectivity at startup
const verifyConnectivity = async (): Promise<void> => {
  try {
    await driver.verifyConnectivity();
    console.log('✅ Connected to Neo4j database');
  } catch (err) {
    console.error('❌ Failed to connect to Neo4j:', err);
    process.exit(1);
  }
};

// Factory to get new sessions
const session = (): Session => driver.session();

export default {
  driver,
  session,
  verifyConnectivity,
};

