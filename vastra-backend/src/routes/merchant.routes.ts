import { Router, Request, Response } from 'express';
import {
  getMerchantActivity,
  getMerchantOrderById,
  getMerchantOrders,
  getMerchantOverview,
  updateProductInventory
} from '../services/merchantService';
import { authenticateMerchant } from '../services/merchantAuthService';
import { requireMerchantAuth } from '../middleware/authMiddleware';
import { DateRange, ErrorResponse } from '../types';

const router = Router();

/**
 * POST /api/merchant/login
 * Public endpoint to authenticate merchant credentials and retrieve an access token.
 */
router.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = authenticateMerchant(email, password);

    if (!result.success) {
      res.status(401).json({
        success: false,
        error: result.error || 'INVALID_CREDENTIALS',
        message: result.message || 'Invalid merchant credentials.'
      });
      return;
    }

    res.status(200).json({
      success: true,
      token: result.token,
      merchant: result.merchant
    });
  } catch (error: any) {
    console.error('[MerchantRoutes] Error in POST /login:', error);
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred during merchant login.'
    });
  }
});

/**
 * GET /api/merchant/me
 * Returns the verified merchant identity and session payload.
 * Protected by requireMerchantAuth.
 */
router.get('/me', requireMerchantAuth, (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    merchant: req.merchant
  });
});

/**
 * GET /api/merchant/overview?range=today|7d|30d|all
 * Returns aggregated store overview, AI commerce analytics, funnels, and upsell metrics.
 * Protected by requireMerchantAuth.
 */
router.get('/overview', requireMerchantAuth, (req: Request, res: Response) => {
  try {
    const range = (req.query.range as DateRange) || 'all';
    const data = getMerchantOverview(range);
    res.status(200).json(data);
  } catch (error: any) {
    console.error('[MerchantRoutes] Error in GET /overview:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve merchant overview' });
  }
});

/**
 * GET /api/merchant/orders?range=today|7d|30d|all&channel=all|human|agent&limit=50
 * Returns recent store orders with line items.
 * Protected by requireMerchantAuth.
 */
router.get('/orders', requireMerchantAuth, (req: Request, res: Response) => {
  try {
    const range = (req.query.range as DateRange) || 'all';
    const channel = req.query.channel as string | undefined;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const orders = getMerchantOrders(range, channel, limit);
    res.status(200).json({ orders, count: orders.length });
  } catch (error: any) {
    console.error('[MerchantRoutes] Error in GET /orders:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve merchant orders' });
  }
});

/**
 * GET /api/merchant/orders/:id
 * Returns complete line-item inspection for an order.
 * Protected by requireMerchantAuth.
 */
router.get('/orders/:id', requireMerchantAuth, (req: Request, res: Response<any | ErrorResponse>) => {
  try {
    const orderId = String(req.params.id || '');
    if (!orderId) {
      res.status(400).json({ error: 'ORDER_ID_REQUIRED', message: 'Order ID is required' });
      return;
    }

    const order = getMerchantOrderById(orderId);
    if (!order) {
      res.status(404).json({ error: 'ORDER_NOT_FOUND', message: `Order ${orderId} not found` });
      return;
    }

    res.status(200).json(order);
  } catch (error: any) {
    console.error('[MerchantRoutes] Error in GET /orders/:id:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve order details' });
  }
});

/**
 * GET /api/merchant/activity?range=today|7d|30d|all&limit=50
 * Returns formatted activity timeline from audit logs.
 * Protected by requireMerchantAuth.
 */
router.get('/activity', requireMerchantAuth, (req: Request, res: Response) => {
  try {
    const range = (req.query.range as DateRange) || 'all';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const activities = getMerchantActivity(range, limit);
    res.status(200).json({ activities, count: activities.length });
  } catch (error: any) {
    console.error('[MerchantRoutes] Error in GET /activity:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve merchant activity' });
  }
});

/**
 * PATCH /api/merchant/inventory/:id
 * Updates product stock and/or price.
 * Protected by requireMerchantAuth.
 */
router.patch('/inventory/:id', requireMerchantAuth, (req: Request, res: Response) => {
  try {
    const productId = String(req.params.id || '');
    const { stock, price } = req.body;

    const result = updateProductInventory(productId, { stock, price });
    if (!result.success) {
      res.status(result.message === 'PRODUCT_NOT_FOUND' ? 404 : 400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[MerchantRoutes] Error in PATCH /inventory/:id:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update inventory' });
  }
});

export default router;
