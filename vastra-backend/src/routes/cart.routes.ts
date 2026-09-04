import { Router, Request, Response } from 'express';
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCartQuantity
} from '../services/cartService';
import { optionalCustomerAuth } from '../middleware/customerAuthMiddleware';
import { CartPayload, Channel, ErrorResponse } from '../types';

const router = Router();

// Apply optional customer auth to all cart routes
router.use(optionalCustomerAuth);

/**
 * GET /api/cart?sessionId=...&channel=human
 * Retrieves the current customer or session cart from the authoritative backend database.
 * If authenticated, strictly loads the cart belonging to req.customer.id.
 */
router.get('/', (req: Request, res: Response<CartPayload | ErrorResponse>) => {
  try {
    const sessionId = (req.query.sessionId as string) || (req.headers['x-session-id'] as string) || '';
    const channel = (req.query.channel as Channel) || 'human';
    const customerId = req.customer?.id || null;
    const cart = getCart(sessionId, channel, true, customerId);
    res.status(200).json(cart);
  } catch (error: any) {
    console.error('[CartRoutes] Error in GET /api/cart:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve cart' });
  }
});

/**
 * Helper to handle adding items.
 */
function handleAddItem(req: Request, res: Response) {
  try {
    const { sessionId, productId, quantity, size, color, channel } = req.body;
    if (!productId || typeof productId !== 'string') {
      res.status(400).json({ error: 'PRODUCT_ID_REQUIRED', message: 'Product ID is required' });
      return;
    }

    const cleanSessionId = sessionId || (req.headers['x-session-id'] as string) || '';
    const customerId = req.customer?.id || null;

    const result = addToCart({
      sessionId: cleanSessionId,
      productId: productId.trim(),
      quantity: quantity ? Number(quantity) : 1,
      size,
      color,
      channel: (channel as Channel) || 'human',
      customerId
    });

    if (!result.success) {
      res.status(400).json({ error: result.error, message: result.message });
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[CartRoutes] Error in adding item to cart:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to add item to cart' });
  }
}

// POST /api/cart/items (RESTful standard)
router.post('/items', handleAddItem);
// POST /api/cart/add (Backwards compatibility)
router.post('/add', handleAddItem);

/**
 * Helper to handle updating item quantity.
 */
function handleUpdateQuantity(req: Request, res: Response) {
  try {
    const targetId = req.params.productId || req.body.productIdOrItemId || req.body.productId || req.body.id;
    const { sessionId, quantity, size, color, channel } = req.body;

    if (!targetId || typeof targetId !== 'string') {
      res.status(400).json({ error: 'ID_REQUIRED', message: 'Product ID or item ID is required' });
      return;
    }

    const cleanSessionId = sessionId || (req.headers['x-session-id'] as string) || '';
    const customerId = req.customer?.id || null;

    const result = updateCartQuantity(
      cleanSessionId,
      targetId.trim(),
      Number(quantity !== undefined ? quantity : 1),
      (channel as Channel) || 'human',
      size,
      color,
      customerId
    );

    if (!result.success) {
      res.status(400).json({ error: result.error, message: result.message });
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[CartRoutes] Error in updating cart quantity:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to update item quantity' });
  }
}

// PATCH /api/cart/items/:productId (RESTful standard)
router.patch('/items/:productId', handleUpdateQuantity);
// PUT /api/cart/items/:productId (RESTful standard alias)
router.put('/items/:productId', handleUpdateQuantity);
// POST /api/cart/update-quantity (Backwards compatibility)
router.post('/update-quantity', handleUpdateQuantity);

/**
 * Helper to handle removing items.
 */
function handleRemoveItem(req: Request, res: Response) {
  try {
    const targetId = req.params.productId || req.body.productIdOrItemId || req.body.productId || req.query.productId || req.query.id;
    const sessionId = req.body.sessionId || req.query.sessionId || (req.headers['x-session-id'] as string) || '';
    const size = req.body.size || req.query.size;
    const color = req.body.color || req.query.color;
    const channel = (req.body.channel as Channel) || (req.query.channel as Channel) || 'human';
    const customerId = req.customer?.id || null;

    if (!targetId || typeof targetId !== 'string') {
      res.status(400).json({ error: 'ID_REQUIRED', message: 'Product ID or item ID is required' });
      return;
    }

    const result = removeFromCart(
      sessionId,
      targetId.trim(),
      channel,
      size ? String(size) : undefined,
      color ? String(color) : undefined,
      customerId
    );

    if (!result.success) {
      res.status(400).json({ error: result.error, message: result.message });
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[CartRoutes] Error in removing item from cart:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to remove item from cart' });
  }
}

// DELETE /api/cart/items/:productId (RESTful standard)
router.delete('/items/:productId', handleRemoveItem);
// POST /api/cart/remove (Backwards compatibility)
router.post('/remove', handleRemoveItem);

/**
 * Helper to handle clearing the entire cart.
 */
function handleClearCart(req: Request, res: Response) {
  try {
    const sessionId = req.body.sessionId || req.query.sessionId || (req.headers['x-session-id'] as string) || '';
    const channel = (req.body.channel as Channel) || (req.query.channel as Channel) || 'human';
    const customerId = req.customer?.id || null;

    const result = clearCart(sessionId, channel, customerId);
    res.status(200).json(result);
  } catch (error: any) {
    console.error('[CartRoutes] Error in clearing cart:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to clear cart' });
  }
}

// DELETE /api/cart (RESTful standard)
router.delete('/', handleClearCart);
// POST /api/cart/clear (Backwards compatibility)
router.post('/clear', handleClearCart);

export default router;
