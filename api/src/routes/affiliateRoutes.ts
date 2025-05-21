// api/src/routes/affiliateRoutes.ts
import express from 'express';
import neo4jConfig from '../config/neo4j';
import affiliateController from '../controllers/affiliateController';
import { isAffiliate } from '../middleware/auth';

const router = express.Router();

// All new affiliate routes require affiliate authentication
// Apply auth middleware only to the new dashboard routes
const dashboardRouter = express.Router();
dashboardRouter.use(isAffiliate);

// Dashboard and analytics (protected routes)
dashboardRouter.get('/stats', affiliateController.getDashboardStats);
dashboardRouter.get('/products', affiliateController.getProducts);
dashboardRouter.get('/profile', affiliateController.getProfile);
dashboardRouter.put('/profile', affiliateController.updateProfile);
dashboardRouter.post('/referral-link', affiliateController.generateReferralLink);

// Mount the protected routes
router.use('/dashboard', dashboardRouter);

// Original routes (keeping for backward compatibility)
// GET /api/affiliates
router.get('/', async (_req, res) => {
  const session = neo4jConfig.session();
  try {
    const result = await session.run(
      'MATCH (p:Person) RETURN p ORDER BY p.created_at DESC LIMIT 25'
    );
    // Map each record's `p` node to its .properties object
    const affiliates = result.records.map((rec) => ({
      id: rec.get('p').properties.id,
      name: rec.get('p').properties.name,
      email: rec.get('p').properties.email,
      level: rec.get('p').properties.level,
      affiliateCode: rec.get('p').properties.affiliateCode,
    }));
    res.json({ affiliates });
  } catch (error) {
    console.error('Error fetching affiliates:', error);
    res.status(500).json({ error: 'Failed to load affiliates' });
  } finally {
    await session.close();
  }
});

// DEBUG: raw Cypher output
// GET /api/affiliates/debug
router.get('/debug', async (_req, res) => {
  const session = neo4jConfig.session();
  try {
    const result = await session.run('MATCH (p:Person) RETURN p');
    // Convert each Record into its raw object form
    const raw = result.records.map((rec) => rec.toObject());
    res.json(raw);
  } catch (error) {
    console.error('Error in debug route:', error);
    res.status(500).json({ error: (error as Error).message });
  } finally {
    await session.close();
  }
});

// Advanced affiliate list with performance metrics
router.get('/performance', async (_req, res) => {
  const session = neo4jConfig.session();
  try {
    const result = await session.run(`
      MATCH (a:Person)
      WHERE a.role = 'affiliate'
      
      // Optional match for orders referred directly
      OPTIONAL MATCH (a)-[ref:REFERRED]->(o:Order)
      WHERE o.status <> 'cancelled'
      
      // Optional match for orders influenced (secondary tier)
      OPTIONAL MATCH (a)-[inf:INFLUENCED]->(o2:Order)
      WHERE o2.status <> 'cancelled'
      
      // Count total orders and calculate commissions
      WITH a,
           count(DISTINCT o) as directOrders,
           sum(DISTINCT o.total) as directRevenue,
           sum(DISTINCT ref.commission) as directCommission,
           count(DISTINCT o2) as influencedOrders,
           sum(DISTINCT o2.total) as influencedRevenue,
           sum(DISTINCT inf.commission) as influencedCommission
      
      // Calculate totals
      RETURN a.id as affiliateId,
             a.name as affiliateName,
             a.email as affiliateEmail,
             a.level as affiliateLevel,
             a.affiliateCode as affiliateCode,
             directOrders,
             directRevenue,
             directCommission,
             influencedOrders,
             influencedRevenue,
             influencedCommission,
             directOrders + influencedOrders as totalOrders,
             directRevenue + influencedRevenue as totalRevenue,
             directCommission + influencedCommission as totalCommission
      ORDER BY totalCommission DESC
    `);
    
    const affiliates = result.records.map(record => {
      return {
        id: record.get('affiliateId'),
        name: record.get('affiliateName'),
        email: record.get('affiliateEmail'),
        level: record.get('affiliateLevel'),
        affiliateCode: record.get('affiliateCode'),
        direct: {
          orders: record.get('directOrders').toNumber(),
          revenue: record.get('directRevenue') ? record.get('directRevenue').toNumber() : 0,
          commission: record.get('directCommission') ? record.get('directCommission').toNumber() : 0
        },
        influenced: {
          orders: record.get('influencedOrders').toNumber(),
          revenue: record.get('influencedRevenue') ? record.get('influencedRevenue').toNumber() : 0,
          commission: record.get('influencedCommission') ? record.get('influencedCommission').toNumber() : 0
        },
        total: {
          orders: record.get('totalOrders').toNumber(),
          revenue: record.get('totalRevenue') ? record.get('totalRevenue').toNumber() : 0,
          commission: record.get('totalCommission') ? record.get('totalCommission').toNumber() : 0
        }
      };
    });
    
    res.json({ affiliates });
  } catch (error) {
    console.error('Error fetching affiliate performance:', error);
    res.status(500).json({ error: 'Failed to load affiliate performance data' });
  } finally {
    await session.close();
  }
});

// Network analysis - get followers for a specific affiliate
router.get('/:affiliateId/network', async (req, res) => {
  const { affiliateId } = req.params;
  const session = neo4jConfig.session();
  
  try {
    const query = `
      // Start with the specified affiliate
      MATCH (center:Person {id: $affiliateId})
      
      // Get followers (first level)
      OPTIONAL MATCH (follower:Person)-[:FOLLOWS]->(center)
      
      // Get followers of followers (second level)
      OPTIONAL MATCH (follower2:Person)-[:FOLLOWS]->(follower)
      
      // Return network data
      RETURN center.name as centerName,
             collect(DISTINCT follower.name) as directFollowers,
             collect(DISTINCT follower2.name) as indirectFollowers,
             count(DISTINCT follower) as followerCount,
             count(DISTINCT follower2) as indirectFollowerCount
    `;
    
    const result = await session.run(query, { affiliateId });
    
    if (result.records.length === 0) {
      res.status(404).json({ error: 'Affiliate not found' });
      return;
    }
    
    const record = result.records[0];
    
    res.json({
      affiliate: record.get('centerName'),
      network: {
        directFollowers: record.get('directFollowers').filter(Boolean),
        indirectFollowers: record.get('indirectFollowers').filter(Boolean),
        followerCount: record.get('followerCount').toNumber(),
        indirectFollowerCount: record.get('indirectFollowerCount').toNumber(),
        totalNetworkSize: record.get('followerCount').toNumber() + record.get('indirectFollowerCount').toNumber()
      }
    });
  } catch (error) {
    console.error('Error fetching affiliate network:', error);
    res.status(500).json({ error: 'Failed to load affiliate network data' });
  } finally {
    await session.close();
  }
});

export default router;
