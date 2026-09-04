import { db } from '../db/db';
import { getProductById } from './catalogService';
import { logAuditEvent } from './auditService';
import {
  CartItemPayload,
  CartPayload,
  Channel,
  PriceChangeInfo
} from '../types';

/**
 * Ensures the SQLite tables for carts and cart_items exist.
 */
function ensureCartTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS carts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      customer_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS cart_items (
      id TEXT PRIMARY KEY,
      cart_id TEXT NOT NULL,
      product_id TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 1,
      size TEXT,
      color TEXT,
      unit_price REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      FOREIGN KEY (product_id) REFERENCES products(id)
    );

    CREATE INDEX IF NOT EXISTS idx_carts_session_id ON carts(session_id);
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart_id ON cart_items(cart_id);
  `);

  try {
    db.exec('ALTER TABLE carts ADD COLUMN customer_id TEXT;');
  } catch {
    // column already exists
  }

  try {
    db.exec('CREATE INDEX IF NOT EXISTS idx_carts_customer_id ON carts(customer_id);');
  } catch {
    // index already exists
  }

  try {
    db.exec('ALTER TABLE cart_items ADD COLUMN unit_price REAL;');
  } catch {
    // column already exists
  }
}

// Initialize tables on load
try {
  ensureCartTables();
} catch (e) {
  console.warn('[CartService] ensureCartTables warning:', e);
}

/**
 * Gets or creates the persistent cart row for a given session or customer.
 */
export function getOrCreateCartId(sessionId: string, customerId?: string | null): string {
  ensureCartTables();
  const cleanCustomerId = customerId && customerId.trim().length > 0 ? customerId.trim() : null;
  const cleanSessionId = sessionId && sessionId.trim().length > 0 ? sessionId.trim() : 'anonymous_session';

  if (cleanCustomerId) {
    const existing = db.prepare('SELECT id FROM carts WHERE customer_id = ?').get(cleanCustomerId) as { id: string } | undefined;
    if (existing) {
      return existing.id;
    }

    const newCartId = `cart_cust_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    db.prepare('INSERT INTO carts (id, session_id, customer_id) VALUES (?, ?, ?)').run(newCartId, `user_${cleanCustomerId}`, cleanCustomerId);
    return newCartId;
  }

  const existing = db.prepare("SELECT id FROM carts WHERE session_id = ? AND (customer_id IS NULL OR customer_id = '')").get(cleanSessionId) as { id: string } | undefined;
  if (existing) {
    return existing.id;
  }

  const newCartId = `cart_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  db.prepare('INSERT INTO carts (id, session_id, customer_id) VALUES (?, ?, NULL)').run(newCartId, cleanSessionId);
  return newCartId;
}

/**
 * Retrieves the full structured cart for a given session or customer.
 * Always resolves prices, stock, and descriptions dynamically from the live catalog.
 * Detects whether catalog prices have changed since addition.
 */
export function getCart(
  sessionId: string,
  channel: Channel = 'agent',
  logView = false,
  customerId?: string | null
): CartPayload {
  const cleanCustomerId = customerId && customerId.trim().length > 0 ? customerId.trim() : null;
  const cleanSessionId = sessionId && sessionId.trim().length > 0 ? sessionId.trim() : 'anonymous_session';
  const cartId = getOrCreateCartId(cleanSessionId, cleanCustomerId);

  const rows = db.prepare(`
    SELECT id, product_id, quantity, size, color, unit_price
    FROM cart_items
    WHERE cart_id = ?
    ORDER BY created_at ASC
  `).all(cartId) as Array<{ id: string; product_id: string; quantity: number; size: string | null; color: string | null; unit_price: number | null }>;

  const items: CartItemPayload[] = [];
  let subtotal = 0;
  let detectedPriceChange: PriceChangeInfo | undefined = undefined;

  for (const row of rows) {
    const prod = getProductById(row.product_id);
    if (!prod) continue;

    const unitPrice = prod.price;
    const total = unitPrice * row.quantity;
    subtotal += total;

    // Check for catalog price change since item was stored in cart
    if (row.unit_price !== null && row.unit_price !== undefined && row.unit_price !== prod.price) {
      detectedPriceChange = {
        priceChanged: true,
        productId: prod.id,
        productName: prod.name,
        previousPrice: row.unit_price,
        currentPrice: prod.price
      };

      // Update stored unit_price to match new catalog price
      db.prepare('UPDATE cart_items SET unit_price = ? WHERE id = ?').run(prod.price, row.id);

      logAuditEvent({
        sessionId: cleanSessionId,
        channel,
        action: 'price_changed',
        details: {
          productId: prod.id,
          productName: prod.name,
          previousPrice: row.unit_price,
          currentPrice: prod.price
        },
        outcome: 'success'
      });
    }

    items.push({
      id: row.id,
      productId: prod.id,
      name: prod.name,
      price: unitPrice,
      quantity: row.quantity,
      size: row.size || (prod.sizes[0] || 'M'),
      color: row.color || (prod.colors[0] || 'Default'),
      total,
      imageUrl: prod.imageUrl,
      stock: prod.stock
    });
  }

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  if (logView) {
    logAuditEvent({
      sessionId: cleanSessionId,
      channel,
      action: 'cart_viewed',
      details: {
        itemCount,
        subtotal,
        customerId: cleanCustomerId,
        itemIds: items.map((i) => i.productId)
      },
      outcome: 'success'
    });
  }

  return {
    sessionId: cleanSessionId,
    customerId: cleanCustomerId,
    items,
    itemCount,
    subtotal,
    total: subtotal,
    currency: 'INR',
    priceChange: detectedPriceChange
  };
}

export interface AddToCartParams {
  sessionId: string;
  productId: string;
  quantity?: number;
  size?: string;
  color?: string;
  channel?: Channel;
  customerId?: string | null;
}

export interface CartOperationResult {
  success: boolean;
  cart: CartPayload;
  addedItem?: CartItemPayload;
  error?: string;
  message?: string;
}

/**
 * Adds or updates an item in the session's or customer's persistent cart.
 * Strictly verifies product existence, stock ceilings, and variant validity.
 */
export function addToCart(params: AddToCartParams): CartOperationResult {
  const cleanCustomerId = params.customerId && params.customerId.trim().length > 0 ? params.customerId.trim() : null;
  const cleanSessionId = params.sessionId && params.sessionId.trim().length > 0 ? params.sessionId.trim() : 'anonymous_session';
  const channel = params.channel || 'agent';
  const cartId = getOrCreateCartId(cleanSessionId, cleanCustomerId);

  const prod = getProductById(params.productId);
  if (!prod) {
    return {
      success: false,
      cart: getCart(cleanSessionId, channel, false, cleanCustomerId),
      error: 'PRODUCT_NOT_FOUND',
      message: 'That item is no longer available in our catalog. I can find you a similar option.'
    };
  }

  if (prod.stock <= 0) {
    logAuditEvent({
      sessionId: cleanSessionId,
      channel,
      action: 'stock_failure',
      details: { productId: prod.id, stock: prod.stock, requested: params.quantity || 1, customerId: cleanCustomerId },
      outcome: 'failure'
    });

    return {
      success: false,
      cart: getCart(cleanSessionId, channel, false, cleanCustomerId),
      error: 'OUT_OF_STOCK',
      message: `That item is no longer available in the requested quantity. Would you like me to find something similar?`
    };
  }

  const qty = params.quantity && Number.isInteger(params.quantity) && params.quantity > 0 ? params.quantity : 1;

  if (qty > prod.stock) {
    logAuditEvent({
      sessionId: cleanSessionId,
      channel,
      action: 'stock_failure',
      details: { productId: prod.id, stock: prod.stock, requested: qty, customerId: cleanCustomerId },
      outcome: 'failure'
    });

    return {
      success: false,
      cart: getCart(cleanSessionId, channel, false, cleanCustomerId),
      error: 'INSUFFICIENT_STOCK',
      message: `That item is no longer available in the requested quantity. We currently have ${prod.stock} piece(s) in stock. Would you like me to find something similar?`
    };
  }

  // Validate or assign default variant
  let chosenSize = params.size ? params.size.trim() : (prod.sizes[0] || 'M');
  if (params.size && !prod.sizes.some((s) => s.toUpperCase() === params.size!.trim().toUpperCase())) {
    chosenSize = prod.sizes[0] || 'M';
  }

  let chosenColor = params.color ? params.color.trim() : (prod.colors[0] || 'Default');
  if (params.color && !prod.colors.some((c) => c.toLowerCase() === params.color!.trim().toLowerCase())) {
    chosenColor = prod.colors[0] || 'Default';
  }

  // Check if item variant already exists in cart
  const existingItem = db.prepare(`
    SELECT id, quantity FROM cart_items
    WHERE cart_id = ? AND product_id = ? AND size = ? AND color = ?
  `).get(cartId, prod.id, chosenSize, chosenColor) as { id: string; quantity: number } | undefined;

  let itemId = '';
  if (existingItem) {
    const newQuantity = Math.min(prod.stock, existingItem.quantity + qty);
    db.prepare('UPDATE cart_items SET quantity = ?, unit_price = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(newQuantity, prod.price, existingItem.id);
    itemId = existingItem.id;
  } else {
    itemId = `ci_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    db.prepare(`
      INSERT INTO cart_items (id, cart_id, product_id, quantity, size, color, unit_price)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(itemId, cartId, prod.id, qty, chosenSize, chosenColor, prod.price);
  }

  const updatedCart = getCart(cleanSessionId, channel, false, cleanCustomerId);
  const addedItem = updatedCart.items.find((i) => i.id === itemId || (i.productId === prod.id && i.size === chosenSize));

  // Audit Logging
  logAuditEvent({
    sessionId: cleanSessionId,
    channel,
    action: 'add_to_bag',
    details: {
      productId: prod.id,
      productName: prod.name,
      quantity: qty,
      size: chosenSize,
      color: chosenColor,
      price: prod.price,
      customerId: cleanCustomerId
    },
    outcome: 'success'
  });

  return {
    success: true,
    cart: updatedCart,
    addedItem,
    message: `Added the **${prod.name}**${chosenSize ? ` (Size: ${chosenSize})` : ''} to your cart.`
  };
}

/**
 * Removes an item from the session's or customer's cart by item ID, composite ID, or product ID.
 */
export function removeFromCart(
  sessionId: string,
  productIdOrItemId: string,
  channel: Channel = 'agent',
  size?: string,
  color?: string,
  customerId?: string | null
): CartOperationResult {
  const cleanCustomerId = customerId && customerId.trim().length > 0 ? customerId.trim() : null;
  const cleanSessionId = sessionId && sessionId.trim().length > 0 ? sessionId.trim() : 'anonymous_session';
  const cartId = getOrCreateCartId(cleanSessionId, cleanCustomerId);

  if (!productIdOrItemId || productIdOrItemId.trim().length === 0) {
    return {
      success: false,
      cart: getCart(cleanSessionId, channel, false, cleanCustomerId),
      error: 'ID_REQUIRED',
      message: 'Product ID or Item ID is required.'
    };
  }

  const target = productIdOrItemId.trim();

  // Check if composite id like `${productId}-${color}-${size}`
  let item: any = null;
  const parts = target.split('-');
  if (parts.length >= 3 && !target.startsWith('ci_')) {
    const possibleSize = parts[parts.length - 1];
    const possibleColor = parts[parts.length - 2];
    const possibleProdId = parts.slice(0, parts.length - 2).join('-');
    item = db.prepare(`
      SELECT ci.id, ci.product_id, ci.quantity, ci.size, ci.color, p.name, p.price
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ? AND ci.product_id = ? AND ci.size = ? AND ci.color = ?
    `).get(cartId, possibleProdId, possibleSize, possibleColor);
  }

  if (!item) {
    if (size || color) {
      item = db.prepare(`
        SELECT ci.id, ci.product_id, ci.quantity, ci.size, ci.color, p.name, p.price
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = ? AND (ci.id = ? OR ci.product_id = ?)
          AND (? IS NULL OR ci.size = ?)
          AND (? IS NULL OR ci.color = ?)
      `).get(cartId, target, target, size || null, size || null, color || null, color || null);
    } else {
      item = db.prepare(`
        SELECT ci.id, ci.product_id, ci.quantity, ci.size, ci.color, p.name, p.price
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = ? AND (ci.id = ? OR ci.product_id = ?)
      `).get(cartId, target, target) as any;
    }
  }

  if (!item) {
    return {
      success: false,
      cart: getCart(cleanSessionId, channel, false, cleanCustomerId),
      error: 'ITEM_NOT_FOUND',
      message: 'Item was not found in your cart.'
    };
  }

  db.prepare('DELETE FROM cart_items WHERE id = ?').run(item.id);

  const updatedCart = getCart(cleanSessionId, channel, false, cleanCustomerId);

  logAuditEvent({
    sessionId: cleanSessionId,
    channel,
    action: 'remove_from_bag',
    details: {
      productId: item.product_id,
      productName: item.name || 'Product',
      quantity: item.quantity,
      size: item.size,
      color: item.color,
      customerId: cleanCustomerId
    },
    outcome: 'success'
  });

  return {
    success: true,
    cart: updatedCart,
    message: `Removed ${item.name || 'item'} from your cart.`
  };
}

/**
 * Updates the quantity of an existing item in the cart.
 */
export function updateCartQuantity(
  sessionId: string,
  productIdOrItemId: string,
  quantity: number,
  channel: Channel = 'agent',
  size?: string,
  color?: string,
  customerId?: string | null
): CartOperationResult {
  const cleanCustomerId = customerId && customerId.trim().length > 0 ? customerId.trim() : null;
  const cleanSessionId = sessionId && sessionId.trim().length > 0 ? sessionId.trim() : 'anonymous_session';
  const cartId = getOrCreateCartId(cleanSessionId, cleanCustomerId);

  if (quantity <= 0) {
    return removeFromCart(cleanSessionId, productIdOrItemId, channel, size, color, cleanCustomerId);
  }

  const target = productIdOrItemId.trim();

  // Check if composite id like `${productId}-${color}-${size}`
  let item: any = null;
  const parts = target.split('-');
  if (parts.length >= 3 && !target.startsWith('ci_')) {
    const possibleSize = parts[parts.length - 1];
    const possibleColor = parts[parts.length - 2];
    const possibleProdId = parts.slice(0, parts.length - 2).join('-');
    item = db.prepare(`
      SELECT ci.id, ci.product_id, ci.quantity, ci.size, ci.color, p.name, p.price, p.stock
      FROM cart_items ci
      LEFT JOIN products p ON ci.product_id = p.id
      WHERE ci.cart_id = ? AND ci.product_id = ? AND ci.size = ? AND ci.color = ?
    `).get(cartId, possibleProdId, possibleSize, possibleColor);
  }

  if (!item) {
    if (size || color) {
      item = db.prepare(`
        SELECT ci.id, ci.product_id, ci.quantity, ci.size, ci.color, p.name, p.price, p.stock
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = ? AND (ci.id = ? OR ci.product_id = ?)
          AND (? IS NULL OR ci.size = ?)
          AND (? IS NULL OR ci.color = ?)
      `).get(cartId, target, target, size || null, size || null, color || null, color || null);
    } else {
      item = db.prepare(`
        SELECT ci.id, ci.product_id, ci.quantity, ci.size, ci.color, p.name, p.price, p.stock
        FROM cart_items ci
        LEFT JOIN products p ON ci.product_id = p.id
        WHERE ci.cart_id = ? AND (ci.id = ? OR ci.product_id = ?)
      `).get(cartId, target, target) as any;
    }
  }

  if (!item) {
    return {
      success: false,
      cart: getCart(cleanSessionId, channel, false, cleanCustomerId),
      error: 'ITEM_NOT_FOUND',
      message: 'Item was not found in your cart.'
    };
  }

  if (quantity > item.stock) {
    logAuditEvent({
      sessionId: cleanSessionId,
      channel,
      action: 'stock_failure',
      details: { productId: item.product_id, stock: item.stock, requested: quantity, customerId: cleanCustomerId },
      outcome: 'failure'
    });

    return {
      success: false,
      cart: getCart(cleanSessionId, channel, false, cleanCustomerId),
      error: 'INSUFFICIENT_STOCK',
      message: `Only ${item.stock} piece(s) available in stock.`
    };
  }

  db.prepare('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(quantity, item.id);

  const updatedCart = getCart(cleanSessionId, channel, false, cleanCustomerId);

  logAuditEvent({
    sessionId: cleanSessionId,
    channel,
    action: 'cart_quantity_updated',
    details: {
      productId: item.product_id,
      productName: item.name || 'Product',
      previousQuantity: item.quantity,
      newQuantity: quantity,
      customerId: cleanCustomerId
    },
    outcome: 'success'
  });

  return {
    success: true,
    cart: updatedCart,
    message: `Updated quantity of ${item.name || 'item'} to ${quantity}.`
  };
}

/**
 * Clears all items from the session's or customer's cart.
 */
export function clearCart(
  sessionId: string,
  channel: Channel = 'agent',
  customerId?: string | null
): CartOperationResult {
  const cleanCustomerId = customerId && customerId.trim().length > 0 ? customerId.trim() : null;
  const cleanSessionId = sessionId && sessionId.trim().length > 0 ? sessionId.trim() : 'anonymous_session';
  const cartId = getOrCreateCartId(cleanSessionId, cleanCustomerId);

  const previousCount = (
    db.prepare('SELECT COUNT(*) as count FROM cart_items WHERE cart_id = ?').get(cartId) as { count: number }
  )?.count || 0;

  db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);

  logAuditEvent({
    sessionId: cleanSessionId,
    channel,
    action: 'cart_cleared',
    details: { previousItemCount: previousCount, customerId: cleanCustomerId },
    outcome: 'success'
  });

  return {
    success: true,
    cart: getCart(cleanSessionId, channel, false, cleanCustomerId),
    message: 'Cart cleared successfully.'
  };
}

export default {
  getCart,
  addToCart,
  removeFromCart,
  updateCartQuantity,
  clearCart,
  getOrCreateCartId
};
