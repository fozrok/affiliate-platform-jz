// api/src/services/shopifyAnalyticsService.ts

import neo4jConfig from '../config/neo4j';

class ShopifyAnalyticsService {
  /**
   * Get overall affiliate performance stats with product breakdown
   */
  async getAffiliatePerformance(affiliateId?: string, dateRange?: { from: string; to: string }) {
    const session = neo4jConfig.session();
    
    try {
      let dateFilter = '';
      const params: any = {};
      
      if (dateRange) {
        dateFilter = 'AND datetime(o.processed_at) >= datetime($fromDate) AND datetime(o.processed_at) <= datetime($toDate)';
        params.fromDate = dateRange.from;
        params.toDate = dateRange.to;
      }
      
      let affiliateFilter = '';
      if (affiliateId) {
        affiliateFilter = 'WHERE a.id = $affiliateId';
        params.affiliateId = affiliateId;
      }
      
      const query = `
        // Match all affiliates or a specific one
        MATCH (a:Person ${affiliateId ? '{id: $affiliateId}' : ''})
        WHERE a.role = 'affiliate'
        
        // Optional match for orders referred directly
        OPTIONAL MATCH (a)-[ref:REFERRED]->(o:Order)
        WHERE o.status <> 'cancelled' ${dateFilter}
        
        // Optional match for orders influenced (secondary tier)
        OPTIONAL MATCH (a)-[inf:INFLUENCED]->(o2:Order)
        WHERE o2.status <> 'cancelled' ${dateFilter}
        
        // Count total orders and calculate commissions
        WITH a,
             count(DISTINCT o) as directOrders,
             sum(DISTINCT o.total) as directRevenue,
             sum(DISTINCT ref.commission) as directCommission,
             count(DISTINCT o2) as influencedOrders,
             sum(DISTINCT o2.total) as influencedRevenue,
             sum(DISTINCT inf.commission) as influencedCommission
        
        // Get top products for each affiliate
        OPTIONAL MATCH (a)-[:REFERRED]->(o:Order)-[:INCLUDES]->(v:ProductVariant)<-[:HAS_VARIANT]-(p:Product)
        WHERE o.status <> 'cancelled' ${dateFilter}
        
        WITH a, directOrders, directRevenue, directCommission,
             influencedOrders, influencedRevenue, influencedCommission,
             p, count(DISTINCT o) as productOrders
        ORDER BY productOrders DESC
        
        WITH a, directOrders, directRevenue, directCommission,
             influencedOrders, influencedRevenue, influencedCommission,
             collect({
               productId: p.id,
               productName: p.name,
               orders: productOrders
             })[0..5] as topProducts
        
        // Calculate totals
        RETURN a.id as affiliateId,
               a.name as affiliateName,
               a.email as affiliateEmail,
               a.level as affiliateLevel,
               directOrders,
               directRevenue,
               directCommission,
               influencedOrders,
               influencedRevenue,
               influencedCommission,
               directOrders + influencedOrders as totalOrders,
               directRevenue + influencedRevenue as totalRevenue,
               directCommission + influencedCommission as totalCommission,
               topProducts
        ORDER BY totalCommission DESC
      `;
      
      const result = await session.run(query, params);
      
      return result.records.map(record => {
        return {
          affiliateId: record.get('affiliateId'),
          affiliateName: record.get('affiliateName'),
          affiliateEmail: record.get('affiliateEmail'),
          affiliateLevel: record.get('affiliateLevel'),
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
          },
          topProducts: record.get('topProducts')
        };
      });
    } finally {
      await session.close();
    }
  }
  
  /**
   * Get product performance with affiliate breakdown
   */
  async getProductPerformance(productId?: string, dateRange?: { from: string; to: string }) {
    const session = neo4jConfig.session();
    
    try {
      let dateFilter = '';
      const params: any = {};
      
      if (dateRange) {
        dateFilter = 'AND datetime(o.processed_at) >= datetime($fromDate) AND datetime(o.processed_at) <= datetime($toDate)';
        params.fromDate = dateRange.from;
        params.toDate = dateRange.to;
      }
      
      let productFilter = '';
      if (productId) {
        productFilter = 'WHERE p.id = $productId';
        params.productId = productId;
      }
      
      const query = `
        // Match all products or a specific one
        MATCH (p:Product ${productId ? '{id: $productId}' : ''})
        WHERE p.deleted IS NULL OR p.deleted = false
        
        // Match orders that include variants of this product
        OPTIONAL MATCH (o:Order)-[:INCLUDES]->(v:ProductVariant)<-[:HAS_VARIANT]-(p)
        WHERE o.status <> 'cancelled' ${dateFilter}
        
        // Count total orders and revenue
        WITH p, count(DISTINCT o) as totalOrders, sum(o.total) as totalRevenue
        
        // Find top affiliates for each product
        OPTIONAL MATCH (a:Person)-[:REFERRED]->(o:Order)-[:INCLUDES]->(v:ProductVariant)<-[:HAS_VARIANT]-(p)
        WHERE o.status <> 'cancelled' ${dateFilter}
        
        WITH p, totalOrders, totalRevenue,
             a, count(DISTINCT o) as affiliateOrders, sum(o.total) as affiliateRevenue
        ORDER BY affiliateOrders DESC
        
        WITH p, totalOrders, totalRevenue,
             collect({
               affiliateId: a.id,
               affiliateName: a.name,
               orders: affiliateOrders,
               revenue: affiliateRevenue
             })[0..5] as topAffiliates
        
        // Return product performance data
        RETURN p.id as productId,
               p.name as productName,
               p.type as productType,
               totalOrders,
               totalRevenue,
               topAffiliates
        ORDER BY totalRevenue DESC
      `;
      
      const result = await session.run(query, params);
      
      return result.records.map(record => {
        return {
          productId: record.get('productId'),
          productName: record.get('productName'),
          productType: record.get('productType'),
          totalOrders: record.get('totalOrders').toNumber(),
          totalRevenue: record.get('totalRevenue') ? record.get('totalRevenue').toNumber() : 0,
          topAffiliates: record.get('topAffiliates')
        };
      });
    } finally {
      await session.close();
    }
  }
  
  /**
   * Get time series data for trending analysis
   */
  async getTrendData(dateRange: { from: string; to: string }, groupBy: 'day' | 'week' | 'month' = 'day') {
    const session = neo4jConfig.session();
    
    try {
      // Set grouping function based on requested granularity
      let dateGrouping;
      switch (groupBy) {
        case 'week':
          dateGrouping = 'datetime.truncate("week", datetime(o.processed_at))';
          break;
        case 'month':
          dateGrouping = 'datetime.truncate("month", datetime(o.processed_at))';
          break;
        default: // day
          dateGrouping = 'datetime.truncate("day", datetime(o.processed_at))';
      }
      
      const query = `
        // Match orders in the specified date range
        MATCH (o:Order)
        WHERE datetime(o.processed_at) >= datetime($fromDate)
        AND datetime(o.processed_at) <= datetime($toDate)
        AND o.status <> 'cancelled'
        
        // Group by the specified time period
        WITH ${dateGrouping} as period, count(o) as orders, sum(o.total) as revenue
        
        // Optionally calculate affiliate-attributed orders and revenue
        OPTIONAL MATCH (a:Person)-[:REFERRED]->(o2:Order)
        WHERE datetime(o2.processed_at) >= datetime($fromDate)
        AND datetime(o2.processed_at) <= datetime($toDate)
        AND o2.status <> 'cancelled'
        AND ${dateGrouping} = period
        
        WITH period, orders, revenue,
             count(DISTINCT o2) as affiliateOrders,
             sum(o2.total) as affiliateRevenue
        
        // Return trend data ordered by period
        RETURN toString(period) as period,
               orders,
               revenue,
               affiliateOrders,
               affiliateRevenue,
               // Calculate percentage of affiliate-attributed orders and revenue
               CASE WHEN orders > 0 THEN toFloat(affiliateOrders) / orders ELSE 0 END as affiliateOrderPercentage,
               CASE WHEN revenue > 0 THEN affiliateRevenue / revenue ELSE 0 END as affiliateRevenuePercentage
        ORDER BY period
      `;
      
      const result = await session.run(query, {
        fromDate: dateRange.from,
        toDate: dateRange.to
      });
      
      return result.records.map(record => {
        return {
          period: record.get('period'),
          orders: record.get('orders').toNumber(),
          revenue: record.get('revenue') ? record.get('revenue').toNumber() : 0,
          affiliateOrders: record.get('affiliateOrders').toNumber(),
          affiliateRevenue: record.get('affiliateRevenue') ? record.get('affiliateRevenue').toNumber() : 0,
          affiliateOrderPercentage: record.get('affiliateOrderPercentage').toNumber(),
          affiliateRevenuePercentage: record.get('affiliateRevenuePercentage').toNumber()
        };
      });
    } finally {
      await session.close();
    }
  }

  /**
   * Get network influence map for a specific affiliate
   */
  async getNetworkInfluence(affiliateId: string) {
    const session = neo4jConfig.session();
    
    try {
      const query = `
        // Start with the specified affiliate
        MATCH (center:Person {id: $affiliateId})
        
        // Get followers (first level)
        OPTIONAL MATCH (follower:Person)-[:FOLLOWS]->(center)
        
        // Get followers of followers (second level)
        OPTIONAL MATCH (follower2:Person)-[:FOLLOWS]->(follower)
        
        // Collect all people in the network with their relationships
        WITH center, follower, follower2
        
        RETURN {
          nodes: collect(DISTINCT {
            id: center.id,
            name: center.name,
            level: center.level,
            type: 'center'
          }) + collect(DISTINCT {
            id: follower.id,
            name: follower.name,
            level: follower.level,
            type: 'follower1'
          }) + collect(DISTINCT {
            id: follower2.id,
            name: follower2.name,
            level: follower2.level,
            type: 'follower2'
          }),
          links: collect(DISTINCT {
            source: follower.id,
            target: center.id,
            type: 'follows'
          }) + collect(DISTINCT {
            source: follower2.id,
            target: follower.id,
            type: 'follows'
          })
        } as networkData
      `;
      
      const result = await session.run(query, { affiliateId });
      
      if (result.records.length === 0) {
        return { nodes: [], links: [] };
      }
      
      const networkData = result.records[0].get('networkData');
      
      // Filter out null nodes (from OPTIONAL MATCH)
      const nodes = networkData.nodes.filter((node: any) => node.id !== null);
      const links = networkData.links.filter((link: any) => link.source !== null && link.target !== null);
      
      return { nodes, links };
    } finally {
      await session.close();
    }
  }
  
  /**
   * Get dashboard summary statistics
   */
  async getDashboardStats(dateRange?: { from: string; to: string }) {
    const session = neo4jConfig.session();
    
    try {
      let dateFilter = '';
      const params: any = {};
      
      if (dateRange) {
        dateFilter = 'AND datetime(o.processed_at) >= datetime($fromDate) AND datetime(o.processed_at) <= datetime($toDate)';
        params.fromDate = dateRange.from;
        params.toDate = dateRange.to;
      }
      
      const query = `
        // Overall order statistics
        MATCH (o:Order)
        WHERE o.status <> 'cancelled' ${dateFilter}
        
        WITH count(o) as totalOrders, sum(o.total) as totalRevenue
        
        // Affiliate-attributed orders
        MATCH (a:Person)-[ref:REFERRED]->(o:Order)
        WHERE o.status <> 'cancelled' ${dateFilter}
        
        WITH totalOrders, totalRevenue,
             count(DISTINCT o) as affiliateOrders,
             sum(o.total) as affiliateRevenue,
             sum(ref.commission) as totalCommission
        
        // Count affiliates and active affiliates
        MATCH (a:Person)
        WHERE a.role = 'affiliate'
        
        WITH totalOrders, totalRevenue, affiliateOrders, affiliateRevenue, totalCommission,
             count(a) as totalAffiliates
        
        // Count active affiliates (those with at least one referral)
        MATCH (a:Person)-[:REFERRED]->(:Order)
        WHERE a.role = 'affiliate'
        
        WITH totalOrders, totalRevenue, affiliateOrders, affiliateRevenue, totalCommission,
             totalAffiliates, count(DISTINCT a) as activeAffiliates
        
        // Get top performing affiliate
        MATCH (a:Person)-[ref:REFERRED]->(o:Order)
        WHERE o.status <> 'cancelled' ${dateFilter}
        
        WITH totalOrders, totalRevenue, affiliateOrders, affiliateRevenue, totalCommission,
             totalAffiliates, activeAffiliates,
             a, sum(ref.commission) as affiliateCommission
        ORDER BY affiliateCommission DESC
        LIMIT 1
        
        RETURN {
          orders: {
            total: totalOrders,
            affiliate: affiliateOrders,
            percentage: CASE WHEN totalOrders > 0 THEN toFloat(affiliateOrders) / totalOrders ELSE 0 END
          },
          revenue: {
            total: totalRevenue,
            affiliate: affiliateRevenue,
            percentage: CASE WHEN totalRevenue > 0 THEN affiliateRevenue / totalRevenue ELSE 0 END
          },
          affiliates: {
            total: totalAffiliates,
            active: activeAffiliates,
            percentage: CASE WHEN totalAffiliates > 0 THEN toFloat(activeAffiliates) / totalAffiliates ELSE 0 END
          },
          commission: {
            total: totalCommission
          },
          topAffiliate: {
            id: a.id,
            name: a.name,
            level: a.level,
            commission: affiliateCommission
          }
        } as stats
      `;
      
      const result = await session.run(query, params);
      
      if (result.records.length === 0) {
        return {
          orders: { total: 0, affiliate: 0, percentage: 0 },
          revenue: { total: 0, affiliate: 0, percentage: 0 },
          affiliates: { total: 0, active: 0, percentage: 0 },
          commission: { total: 0 },
          topAffiliate: null
        };
      }
      
      return result.records[0].get('stats');
    } finally {
      await session.close();
    }
  }
}

export default new ShopifyAnalyticsService();
