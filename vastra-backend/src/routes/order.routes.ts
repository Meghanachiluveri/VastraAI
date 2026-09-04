import { Router, Request, Response } from 'express';
import {
  validateOrder,
  createOrder,
  confirmOrder,
  getCustomerOrders,
  getOrderByIdForCustomer
} from '../services/orderService';
import { isAiCheckoutSession } from '../services/agentService';
import {
  optionalCustomerAuth,
  requireCustomerAuth
} from '../middleware/customerAuthMiddleware';
import {
  CreateOrderRequest,
  OrderValidationRequest,
  OrderValidationResult,
  CreateOrderSuccess,
  ConfirmOrderResult,
  ErrorResponse
} from '../types';

const router = Router();

/**
 * Extracts string value safely from route parameters.
 */
function extractString(val: unknown): string {
  if (Array.isArray(val)) {
    return typeof val[0] === 'string' ? val[0] : '';
  }
  return typeof val === 'string' ? val : '';
}

/**
 * GET /api/orders
 * Returns all orders for the currently authenticated customer, user ID, or session ID.
 */
router.get('/', optionalCustomerAuth, (req: Request, res: Response) => {
  try {
    const customerId = req.customer?.id || 
      (typeof req.query.customerId === 'string' ? req.query.customerId : null) ||
      (typeof req.query.userId === 'string' ? req.query.userId : null);
    const sessionId = (typeof req.query.sessionId === 'string' ? req.query.sessionId : null) ||
      (typeof req.query.session_id === 'string' ? req.query.session_id : null);
    const email = req.customer?.email || (typeof req.query.email === 'string' ? req.query.email : null);

    if (!customerId && !sessionId && !email) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Please log in or provide session/user identifier to view orders.'
      });
      return;
    }

    const orders = getCustomerOrders({ customerId, sessionId, email });
    res.status(200).json({ success: true, orders, count: orders.length });
  } catch (error) {
    console.error('[OrderRoutes] Error in GET /api/orders:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve orders' });
  }
});

/**
 * GET /api/orders/:orderId
 * Returns order details ensuring customer or session ownership.
 */
router.get('/:orderId', optionalCustomerAuth, (req: Request, res: Response) => {
  try {
    const orderId = extractString(req.params.orderId).trim();
    const customerId = req.customer?.id || 
      (typeof req.query.customerId === 'string' ? req.query.customerId : null) ||
      (typeof req.query.userId === 'string' ? req.query.userId : null);
    const sessionId = (typeof req.query.sessionId === 'string' ? req.query.sessionId : null) ||
      (typeof req.query.session_id === 'string' ? req.query.session_id : null);
    const email = req.customer?.email || (typeof req.query.email === 'string' ? req.query.email : null);

    if (!customerId && !sessionId && !email) {
      res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: 'Authentication or session identifier required to view order details.'
      });
      return;
    }

    const order = getOrderByIdForCustomer(orderId, { customerId, sessionId, email });
    if (!order) {
      res.status(404).json({
        success: false,
        error: 'ORDER_NOT_FOUND',
        message: 'Order not found or access denied.'
      });
      return;
    }

    res.status(200).json({ success: true, order });
  } catch (error) {
    console.error('[OrderRoutes] Error in GET /api/orders/:orderId:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve order details' });
  }
});

/**
 * POST /api/orders/validate
 * Validates order items, quantities, attributes, prices, spending caps, and confirmation requirements.
 * Does not create an order in the database.
 */
router.post('/validate', (req: Request, res: Response<OrderValidationResult | ErrorResponse>) => {
  try {
    const requestBody: OrderValidationRequest = req.body;
    const validationResult = validateOrder(requestBody);

    if (!validationResult.valid) {
      res.status(400).json(validationResult);
      return;
    }

    res.status(200).json(validationResult);
  } catch (error) {
    console.error('[OrderRoutes] Error in POST /api/orders/validate:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to validate order' });
  }
});

/**
 * POST /api/orders/create
 * Validates commerce guardrails, confirms authorization, and inserts order record into SQLite.
 * Requires authenticated customer session.
 * Initial status is set to PENDING_PAYMENT.
 */
router.post('/create', optionalCustomerAuth, (req: Request, res: Response<CreateOrderSuccess | ErrorResponse>) => {
  try {
    const requestBody: CreateOrderRequest = req.body;

    // 1. Strictly enforce customer session for customer checkout
    if (!req.customer) {
      res.status(401).json({
        error: 'UNAUTHORIZED',
        message: 'Please sign in to continue to checkout.'
      });
      return;
    }

    // 2. Authoritative Checkout Source Determination
    // If this session has an active pending AI checkout, strictly enforce 'agent' channel
    const isAi = requestBody.sessionId ? isAiCheckoutSession(requestBody.sessionId) : false;
    if (isAi) {
      requestBody.channel = 'agent';
    } else {
      requestBody.channel = 'human';
    }

    // 3. Attach authenticated customer identity (never trust client userId)
    requestBody.customerId = req.customer.id;
    if (!requestBody.customerInfo) {
      requestBody.customerInfo = {};
    }
    requestBody.customerInfo.customerId = req.customer.id;
    requestBody.customerInfo.name = requestBody.customerInfo.name || req.customer.name;
    requestBody.customerInfo.email = requestBody.customerInfo.email || req.customer.email;

    const result = createOrder(requestBody);

    if (!result.success) {
      res.status(400).json({
        error: result.error,
        message: result.message,
        details: result.details
      });
      return;
    }

    res.status(201).json({
      success: true,
      order: result.order
    });
  } catch (error) {
    console.error('[OrderRoutes] Error in POST /api/orders/create:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to create order' });
  }
});

/**
 * POST /api/orders/:orderId/confirm
 * Confirms payment and atomically reduces product inventory upon success.
 * Re-checks stock at confirmation time to prevent stale overselling.
 */
router.post('/:orderId/confirm', (req: Request, res: Response<ConfirmOrderResult | ErrorResponse>) => {
  try {
    const orderId = extractString(req.params.orderId).trim();
    const { paymentStatus, sessionId } = req.body;

    if (!paymentStatus) {
      res.status(400).json({
        success: false,
        error: 'INVALID_PAYMENT_STATUS',
        message: 'paymentStatus field is required ("success" or "failed")'
      });
      return;
    }

    const result = confirmOrder(orderId, paymentStatus, sessionId);

    if (!result.success) {
      if ('error' in result && result.error === 'ORDER_NOT_FOUND') {
        res.status(404).json(result);
        return;
      }
      res.status(400).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error(`[OrderRoutes] Error in POST /api/orders/${req.params.orderId}/confirm:`, error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to confirm order' });
  }
});

export default router;
