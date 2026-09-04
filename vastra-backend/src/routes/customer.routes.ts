import { Router, Request, Response } from 'express';
import {
  getCustomerAddresses,
  addCustomerAddress
} from '../services/customerAuthService';
import {
  getCustomerOrders,
  getOrderByIdForCustomer
} from '../services/orderService';
import { requireCustomerAuth } from '../middleware/customerAuthMiddleware';

const router = Router();

// Apply requireCustomerAuth to all customer endpoints
router.use(requireCustomerAuth);

/**
 * GET /api/customer/addresses
 * Retrieves saved delivery addresses for the authenticated customer.
 */
router.get('/addresses', (req: Request, res: Response) => {
  try {
    const customerId = req.customer!.id;
    const addresses = getCustomerAddresses(customerId);
    res.status(200).json({ success: true, addresses });
  } catch (error: any) {
    console.error('[CustomerRoutes] Error in GET /addresses:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to retrieve addresses' });
  }
});

/**
 * POST /api/customer/addresses
 * Adds a new delivery address for the authenticated customer.
 */
router.post('/addresses', (req: Request, res: Response) => {
  try {
    const customerId = req.customer!.id;
    const { name, phone, addressLine, city, state, postalCode, isDefault } = req.body;

    if (!name || !phone || !addressLine || !city || !state || !postalCode) {
      res.status(400).json({
        success: false,
        error: 'MISSING_FIELDS',
        message: 'All address fields (name, phone, addressLine, city, state, postalCode) are required.'
      });
      return;
    }

    const newAddress = addCustomerAddress(customerId, {
      name,
      phone,
      addressLine,
      city,
      state,
      postalCode,
      isDefault
    });

    res.status(201).json({ success: true, address: newAddress });
  } catch (error: any) {
    console.error('[CustomerRoutes] Error in POST /addresses:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: error.message || 'Failed to save address' });
  }
});

/**
 * GET /api/customer/orders
 * Retrieves all orders placed by the authenticated customer (both Storefront and AI).
 */
router.get('/orders', (req: Request, res: Response) => {
  try {
    const customerId = req.customer!.id;
    const sessionId = (typeof req.query.sessionId === 'string' ? req.query.sessionId : null) ||
      (typeof req.query.session_id === 'string' ? req.query.session_id : null);
    const email = req.customer?.email;

    const orders = getCustomerOrders({ customerId, sessionId, email });
    res.status(200).json({ success: true, orders, count: orders.length });
  } catch (error: any) {
    console.error('[CustomerRoutes] Error in GET /orders:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to retrieve orders' });
  }
});

function extractString(val: unknown): string {
  if (Array.isArray(val)) {
    return typeof val[0] === 'string' ? val[0] : '';
  }
  return typeof val === 'string' ? val : '';
}

/**
 * GET /api/customer/orders/:id
 * Retrieves order details ensuring strict customer isolation.
 */
router.get('/orders/:id', (req: Request, res: Response) => {
  try {
    const customerId = req.customer!.id;
    const sessionId = (typeof req.query.sessionId === 'string' ? req.query.sessionId : null) ||
      (typeof req.query.session_id === 'string' ? req.query.session_id : null);
    const email = req.customer?.email;
    const orderId = extractString(req.params.id);

    const order = getOrderByIdForCustomer(orderId, { customerId, sessionId, email });
    if (!order) {
      res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found or you do not have permission to view it.'
      });
      return;
    }

    res.status(200).json({ success: true, order });
  } catch (error: any) {
    console.error(`[CustomerRoutes] Error in GET /orders/${req.params.id}:`, error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to retrieve order details' });
  }
});

export default router;