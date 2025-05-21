// api/src/controllers/adminController.ts

import { Request, Response } from 'express';
import shopifyAnalyticsService from '../services/shopifyAnalyticsService';

export const getDashboardStats = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const dateRange = from && to ? { from: from as string, to: to as string } : undefined;
    
    const stats = await shopifyAnalyticsService.getDashboardStats(dateRange);
    
    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get dashboard statistics',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getAffiliates = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const dateRange = from && to ? { from: from as string, to: to as string } : undefined;
    
    const affiliates = await shopifyAnalyticsService.getAffiliatePerformance(undefined, dateRange);
    
    res.status(200).json({
      success: true,
      data: affiliates
    });
  } catch (error) {
    console.error('Error getting affiliates:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get affiliate data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getProductPerformance = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;
    const dateRange = from && to ? { from: from as string, to: to as string } : undefined;
    
    const products = await shopifyAnalyticsService.getProductPerformance(undefined, dateRange);
    
    res.status(200).json({
      success: true,
      data: products
    });
  } catch (error) {
    console.error('Error getting product performance:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get product performance data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export const getTrends = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to, groupBy } = req.query;
    
    if (!from || !to) {
      res.status(400).json({
        success: false,
        message: 'Date range (from and to) is required'
      });
      return;
    }
    
    const trends = await shopifyAnalyticsService.getTrendData(
      { from: from as string, to: to as string },
      (groupBy as 'day' | 'week' | 'month') || 'day'
    );
    
    res.status(200).json({
      success: true,
      data: trends
    });
  } catch (error) {
    console.error('Error getting trend data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get trend data',
      error: error instanceof Error ? error.message : String(error)
    });
  }
};

export default {
  getDashboardStats,
  getAffiliates,
  getProductPerformance,
  getTrends
};
