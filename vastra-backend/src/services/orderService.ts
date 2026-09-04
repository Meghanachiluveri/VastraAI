import { db } from '../db/db';
import { getProductById } from './catalogService';
import { logAuditEvent } from './auditService';
import {
  Channel,
  ConfirmOrderResult,
  CreateOrderRequest,
  CreateOrderResult,
  OrderItemRow,
  OrderValidationRequest,
  OrderValidationResult,
  PaymentStatus,
  ValidatedOrderItem
} from '../types';

// ==================== COMMERCE GUARDRAILS CONFIGURATION ====================

/** Maximum allowable total order value in INR. */
export const MAX_ORDER_VALUE = 10000;

/** Order total threshold (INR) at or above which explicit user confirmation is required. */
export const CONFIRMATION_THRESHOLD = 500;

/** Default currency across all transactions. */
export const DEFAULT_CURRENCY = 'INR';

const VALID_CHANNELS: Channel[] = ['human', 'agent'];

/**
 * Validates an incoming order request against commerce guardrails and inventory constraints.
 *
 * Safety Principles:
 * 1. The backend is the sole authority for commerce rules, price calculations, and stock checks.
 * 2. Prices sent by the client or AI are strictly ignored in favor of real SQLite database prices.
 * 3. Stock availability is verified without premature reduction (race protection).
 * 4. Orders exceeding MAX_ORDER_VALUE (₹10,000) are hard-rejected.
 * 5. Orders >= CONFIRMATION_THRESHOLD (₹500) flag requiresConfirmation = true.
 * 6. Generates a 'guardrail_check' audit event for traceability.
 */
export function validateOrder(request: OrderValidationRequest): OrderValidationResult {
  const sessionId = request?.sessionId || null;

  // 1. Channel Validation
  if (!request || !request.channel || !VALID_CHANNELS.includes(request.channel.toLowerCase() as Channel)) {
    const failureResult: OrderValidationResult = {
      valid: false,
      reason: 'INVALID_CHANNEL',
      error: 'Invalid channel. Supported channels: human, agent'
    };

    logAuditEvent({
      sessionId,
      orderId: null,
      channel: 'human',
      action: 'guardrail_check',
      details: { valid: false, reason: 'INVALID_CHANNEL', error: failureResult.error },
      outcome: 'failure'
    });

    return failureResult;
  }

  const channel = request.channel.toLowerCase() as Channel;

  // 2. Empty Order Check
  if (!request.items || !Array.isArray(request.items) || request.items.length === 0) {
    const failureResult: OrderValidationResult = {
      valid: false,
      reason: 'EMPTY_ORDER',
      error: 'Order must contain at least one item'
    };

    logAuditEvent({
      sessionId,
      orderId: null,
      channel,
      action: 'guardrail_check',
      details: { valid: false, reason: 'EMPTY_ORDER', error: failureResult.error },
      outcome: 'failure'
    });

    return failureResult;
  }

  const validatedItems: ValidatedOrderItem[] = [];

  // 3. Item-by-item validation
  for (let i = 0; i < request.items.length; i++) {
    const item = request.items[i];

    // Validate Quantity
    if (
      item.quantity === undefined ||
      item.quantity === null ||
      typeof item.quantity !== 'number' ||
      !Number.isInteger(item.quantity) ||
      item.quantity <= 0
    ) {
      const failureResult: OrderValidationResult = {
        valid: false,
        reason: 'INVALID_QUANTITY',
        error: `Invalid quantity ${item.quantity} for item at index ${i}. Quantity must be a positive integer.`,
        details: {
          productId: item.productId,
          requested: item.quantity
        }
      };

      logAuditEvent({
        sessionId,
        orderId: null,
        channel,
        action: 'guardrail_check',
        details: { valid: false, reason: 'INVALID_QUANTITY', details: failureResult.details },
        outcome: 'failure'
      });

      return failureResult;
    }

    // Validate Product ID
    if (!item.productId || typeof item.productId !== 'string' || item.productId.trim().length === 0) {
      const failureResult: OrderValidationResult = {
        valid: false,
        reason: 'PRODUCT_NOT_FOUND',
        error: `Product ID is required for item at index ${i}`
      };

      logAuditEvent({
        sessionId,
        orderId: null,
        channel,
        action: 'guardrail_check',
        details: { valid: false, reason: 'PRODUCT_NOT_FOUND' },
        outcome: 'failure'
      });

      return failureResult;
    }

    const cleanProductId = item.productId.trim();

    // Query product directly from SQLite catalog
    const product = getProductById(cleanProductId);
    if (!product) {
      const failureResult: OrderValidationResult = {
        valid: false,
        reason: 'PRODUCT_NOT_FOUND',
        error: `Product not found: ${cleanProductId}`,
        details: {
          productId: cleanProductId
        }
      };

      logAuditEvent({
        sessionId,
        orderId: null,
        channel,
        action: 'guardrail_check',
        details: { valid: false, reason: 'PRODUCT_NOT_FOUND', productId: cleanProductId },
        outcome: 'failure'
      });

      return failureResult;
    }

    // Stock Check
    if (item.quantity > product.stock) {
      const failureResult: OrderValidationResult = {
        valid: false,
        reason: 'INSUFFICIENT_STOCK',
        error: `Insufficient stock for "${product.name}". Requested: ${item.quantity}, Available: ${product.stock}`,
        details: {
          productId: product.id,
          requested: item.quantity,
          available: product.stock
        }
      };

      logAuditEvent({
        sessionId,
        orderId: null,
        channel,
        action: 'guardrail_check',
        details: {
          valid: false,
          reason: 'INSUFFICIENT_STOCK',
          productId: product.id,
          requested: item.quantity,
          available: product.stock
        },
        outcome: 'failure'
      });

      return failureResult;
    }

    // Size Validation (if supplied)
    let validatedSize: string | undefined = undefined;
    if (item.size !== undefined && item.size !== null && typeof item.size === 'string' && item.size.trim().length > 0) {
      const cleanSize = item.size.trim();
      const hasSize = product.sizes.some(
        (s) => s.toLowerCase() === cleanSize.toLowerCase()
      );

      if (!hasSize) {
        const failureResult: OrderValidationResult = {
          valid: false,
          reason: 'INVALID_SIZE',
          error: `Invalid size "${cleanSize}" for "${product.name}". Available sizes: ${product.sizes.join(', ')}`,
          details: {
            productId: product.id
          }
        };

        logAuditEvent({
          sessionId,
          orderId: null,
          channel,
          action: 'guardrail_check',
          details: { valid: false, reason: 'INVALID_SIZE', size: cleanSize, productId: product.id },
          outcome: 'failure'
        });

        return failureResult;
      }
      validatedSize = cleanSize;
    }

    // Color Validation (if supplied)
    let validatedColor: string | undefined = undefined;
    if (item.color !== undefined && item.color !== null && typeof item.color === 'string' && item.color.trim().length > 0) {
      const cleanColor = item.color.trim();
      const hasColor = product.colors.some(
        (c) => c.toLowerCase() === cleanColor.toLowerCase()
      );

      if (!hasColor) {
        const failureResult: OrderValidationResult = {
          valid: false,
          reason: 'INVALID_COLOR',
          error: `Invalid color "${cleanColor}" for "${product.name}". Available colors: ${product.colors.join(', ')}`,
          details: {
            productId: product.id
          }
        };

        logAuditEvent({
          sessionId,
          orderId: null,
          channel,
          action: 'guardrail_check',
          details: { valid: false, reason: 'INVALID_COLOR', color: cleanColor, productId: product.id },
          outcome: 'failure'
        });

        return failureResult;
      }
      validatedColor = cleanColor;
    }

    // Always use verified database price (do NOT trust item.price from client/AI)
    const dbPrice = product.price;
    const itemTotal = dbPrice * item.quantity;

    validatedItems.push({
      productId: product.id,
      name: product.name,
      price: dbPrice,
      quantity: item.quantity,
      size: validatedSize,
      color: validatedColor,
      total: itemTotal,
      imageUrl: product.imageUrl
    });
  }

  // 4. Totals Calculation
  const subtotal = validatedItems.reduce((acc, it) => acc + it.total, 0);
  const totalQuantity = validatedItems.reduce((acc, it) => acc + it.quantity, 0);
  const total = subtotal;

  // 5. Max Order Value Guardrail (STRICTLY FOR AI / AGENT SHOPPING)
  if (channel === 'agent' && total > MAX_ORDER_VALUE) {
    const failureResult: OrderValidationResult = {
      valid: false,
      reason: 'ORDER_VALUE_LIMIT_EXCEEDED',
      error: "Your AI-assisted purchase is above Vastra.AI's ₹10,000 AI purchase limit. You can remove an item or continue shopping manually.",
      details: {
        total,
        limit: MAX_ORDER_VALUE
      }
    };

    logAuditEvent({
      sessionId,
      orderId: null,
      channel,
      action: 'guardrail_check',
      details: {
        valid: false,
        reason: 'ORDER_VALUE_LIMIT_EXCEEDED',
        totalAmount: total,
        maxOrderValue: MAX_ORDER_VALUE
      },
      outcome: 'failure'
    });

    return failureResult;
  }

  // 6. Confirmation Gate (>= ₹500 requires confirmation, < ₹500 does not)
  const requiresConfirmation = total >= CONFIRMATION_THRESHOLD;

  // Log successful guardrail check
  logAuditEvent({
    sessionId,
    orderId: null,
    channel,
    action: 'guardrail_check',
    details: {
      totalAmount: total,
      maxOrderValue: MAX_ORDER_VALUE,
      requiresConfirmation,
      channel,
      itemCount: validatedItems.length
    },
    outcome: 'success'
  });

  return {
    valid: true,
    channel,
    requiresConfirmation,
    subtotal,
    totalQuantity,
    total,
    currency: DEFAULT_CURRENCY,
    items: validatedItems
  };
}

/**
 * Creates an order record and associated items in SQLite after validating commerce guardrails and confirmation gates.
 *
 * Rules:
 * 1. Executes validateOrder() first.
 * 2. If requiresConfirmation is true and confirmed is not true, rejects with CONFIRMATION_REQUIRED.
 * 3. Generates a server-side unique order ID.
 * 4. Inserts into orders table and order_items table within an atomic database transaction.
 * 5. Does NOT reduce stock until payment confirmation.
 * 6. Generates 'gating_check' and 'order_created' audit events.
 */
export function createOrder(request: CreateOrderRequest): CreateOrderResult {
  const sessionId = request?.sessionId || null;

  // 1. Execute Validation
  const validation = validateOrder({
    channel: request.channel,
    items: request.items,
    sessionId
  });

  if (!validation.valid) {
    return {
      success: false,
      error: validation.reason,
      message: validation.error,
      details: validation.details
    };
  }

  // 2. Confirmation Gate Check
  if (validation.requiresConfirmation) {
    if (request.confirmed !== true) {
      logAuditEvent({
        sessionId,
        orderId: null,
        channel: validation.channel,
        action: 'gating_check',
        details: {
          totalAmount: validation.total,
          confirmationRequired: true,
          confirmed: false
        },
        outcome: 'user_declined'
      });

      return {
        success: false,
        error: 'CONFIRMATION_REQUIRED',
        message: `Explicit user confirmation is required for orders at or above ₹${CONFIRMATION_THRESHOLD}`,
        details: {
          total: validation.total,
          threshold: CONFIRMATION_THRESHOLD,
          items: validation.items
        }
      };
    }

    // Confirmation supplied
    logAuditEvent({
      sessionId,
      orderId: null,
      channel: validation.channel,
      action: 'gating_check',
      details: {
        totalAmount: validation.total,
        confirmationRequired: true,
        confirmed: true
      },
      outcome: 'success'
    });
  }

  // 3. Extract Customer & Session Info
  const custInfo = request.customerInfo || {};
  let customerId = request.customerId || custInfo.customerId || (sessionId?.startsWith('user_') ? sessionId : null);
  let customerName = custInfo.name || null;
  let customerEmail = custInfo.email || null;
  let customerPhone = custInfo.phone || null;
  const shippingAddress = custInfo.address || null;
  const shippingCity = custInfo.city || null;
  const shippingState = custInfo.state || null;
  const shippingPostalCode = custInfo.postalCode || null;

  // If customerId is missing but customerEmail is provided, look up registered customer in DB
  if (!customerId && customerEmail) {
    const existingCust = db.prepare('SELECT id, name, phone FROM customers WHERE email = ?').get(customerEmail) as any;
    if (existingCust) {
      customerId = existingCust.id;
      if (!customerName) customerName = existingCust.name;
      if (!customerPhone) customerPhone = existingCust.phone;
    }
  } else if (customerId && (!customerName || !customerEmail)) {
    const existingCust = db.prepare('SELECT name, email, phone FROM customers WHERE id = ?').get(customerId) as any;
    if (existingCust) {
      if (!customerName) customerName = existingCust.name;
      if (!customerEmail) customerEmail = existingCust.email;
      if (!customerPhone) customerPhone = existingCust.phone;
    }
  }

  // 4. Generate unique server-side order ID
  const orderId = `ord_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

  try {
    const insertOrderTx = db.transaction(() => {
      // Insert Order record with session_id and customer info
      const orderStmt = db.prepare(`
        INSERT INTO orders (
          id, session_id, customer_id, customer_name, customer_email, customer_phone,
          shipping_address, shipping_city, shipping_state, shipping_postal_code,
          channel, status, total_amount, currency, payment_provider, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);

      orderStmt.run(
        orderId,
        sessionId,
        customerId,
        customerName,
        customerEmail,
        customerPhone,
        shippingAddress,
        shippingCity,
        shippingState,
        shippingPostalCode,
        validation.channel,
        'PENDING_PAYMENT',
        validation.total,
        validation.currency,
        'razorpay'
      );

      // Insert Order Items
      const itemStmt = db.prepare(`
        INSERT INTO order_items (
          id, order_id, product_id, quantity, price, size, color
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?
        )
      `);

      for (let i = 0; i < validation.items.length; i++) {
        const it = validation.items[i];
        const itemId = `${orderId}_item_${i + 1}`;
        itemStmt.run(
          itemId,
          orderId,
          it.productId,
          it.quantity,
          it.price,
          it.size || null,
          it.color || null
        );
      }
    });

    insertOrderTx();

    // Log order_created audit event
    logAuditEvent({
      sessionId,
      orderId,
      channel: validation.channel,
      action: 'order_created',
      details: {
        orderId,
        customerId,
        totalAmount: validation.total,
        channel: validation.channel,
        itemCount: validation.items.length
      },
      outcome: 'success'
    });

    return {
      success: true,
      order: {
        id: orderId,
        status: 'PENDING_PAYMENT',
        channel: validation.channel,
        totalAmount: validation.total,
        currency: validation.currency,
        customerId,
        customerName: customerName || undefined,
        customerEmail: customerEmail || undefined,
        customerPhone: customerPhone || undefined,
        shippingAddress: shippingAddress || undefined,
        shippingCity: shippingCity || undefined,
        shippingState: shippingState || undefined,
        shippingPostalCode: shippingPostalCode || undefined,
        items: validation.items
      }
    };
  } catch (error) {
    console.error('[OrderService] Failed to create order in database:', error);
    throw new Error('Database error during order creation');
  }
}

/**
 * Confirms an order and safely updates inventory.
 *
 * Rules:
 * 1. Verifies order exists and is in PENDING_PAYMENT status.
 * 2. If paymentStatus = 'failed', updates order to PAYMENT_FAILED without modifying inventory.
 * 3. If paymentStatus = 'success':
 *    - Re-checks real-time stock for all ordered items within an atomic transaction.
 *    - If any product has insufficient stock, transaction is aborted and order remains in a safe state.
 *    - If all stock is available, decrements stock for all items and marks order as PAID atomically.
 * 4. Logs 'payment_attempt', 'payment_result', 'stock_failure', and 'order_confirmed' audit events.
 */
export function confirmOrder(
  orderId: string,
  paymentStatus: PaymentStatus | string,
  sessionId?: string | null
): ConfirmOrderResult {
  if (!orderId || typeof orderId !== 'string' || orderId.trim().length === 0) {
    return {
      success: false,
      error: 'ORDER_NOT_FOUND',
      message: 'Order ID is required'
    };
  }

  const cleanOrderId = orderId.trim();

  // 1. Retrieve order
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(cleanOrderId) as
    | {
        id: string;
        channel: Channel;
        status: string;
        total_amount: number;
        currency: string;
        customer_id?: string | null;
        session_id?: string | null;
      }
    | undefined;

  if (!order) {
    return {
      success: false,
      error: 'ORDER_NOT_FOUND',
      message: `Order not found: ${cleanOrderId}`
    };
  }

  // 2. State validation
  if (order.status === 'PAID') {
    return {
      success: false,
      error: 'ORDER_ALREADY_PAID',
      message: 'Order has already been confirmed and paid'
    };
  }

  if (order.status !== 'PENDING_PAYMENT') {
    return {
      success: false,
      error: 'INVALID_ORDER_STATE',
      message: `Order cannot be confirmed because current status is "${order.status}"`
    };
  }

  const normalizedPaymentStatus = paymentStatus ? paymentStatus.trim().toLowerCase() : '';

  // Log payment_attempt audit event
  logAuditEvent({
    sessionId: sessionId || null,
    orderId: order.id,
    channel: order.channel,
    action: 'payment_attempt',
    details: {
      orderId: order.id,
      totalAmount: order.total_amount,
      paymentStatus: normalizedPaymentStatus
    },
    outcome: normalizedPaymentStatus === 'success' ? 'success' : 'failure'
  });

  // 3. Failure Flow
  if (normalizedPaymentStatus === 'failed') {
    db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
      'PAYMENT_FAILED',
      order.id
    );

    // Log payment_result failure
    logAuditEvent({
      sessionId: sessionId || null,
      orderId: order.id,
      channel: order.channel,
      action: 'payment_result',
      details: {
        orderId: order.id,
        status: 'PAYMENT_FAILED',
        paymentStatus: 'failed'
      },
      outcome: 'failure'
    });

    return {
      success: false,
      order: {
        id: order.id,
        status: 'PAYMENT_FAILED'
      }
    };
  }

  if (normalizedPaymentStatus !== 'success') {
    return {
      success: false,
      error: 'INVALID_PAYMENT_STATUS',
      message: 'Invalid paymentStatus. Supported values: success, failed'
    };
  }

  // 4. Success Flow: Retrieve items and execute atomic stock re-check + decrement
  const items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(order.id) as OrderItemRow[];

  if (!items || items.length === 0) {
    return {
      success: false,
      error: 'EMPTY_ORDER',
      message: 'No items associated with this order'
    };
  }

  try {
    const confirmTx = db.transaction(() => {
      // Step A: Stock Re-check for every item
      for (const item of items) {
        const prod = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(item.product_id) as
          | { id: string; name: string; stock: number }
          | undefined;

        if (!prod) {
          throw new Error(`PRODUCT_NOT_FOUND:${item.product_id}`);
        }

        if (prod.stock < item.quantity) {
          throw new Error(`INSUFFICIENT_STOCK:${prod.id}:${prod.name}:${item.quantity}:${prod.stock}`);
        }
      }

      // Step B: Atomic stock reduction
      const updateStockStmt = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?');
      for (const item of items) {
        updateStockStmt.run(item.quantity, item.product_id);
      }

      // Step C: Mark order as PAID
      db.prepare('UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(
        'PAID',
        order.id
      );

      // Step D: Clear purchased cart items for this customer or session
      if (order.customer_id) {
        db.prepare(`
          DELETE FROM cart_items WHERE cart_id IN (
            SELECT id FROM carts WHERE customer_id = ?
          )
        `).run(order.customer_id);
      } else if (order.session_id) {
        db.prepare(`
          DELETE FROM cart_items WHERE cart_id IN (
            SELECT id FROM carts WHERE session_id = ? AND (customer_id IS NULL OR customer_id = '')
          )
        `).run(order.session_id);
      }
    });

    confirmTx();

    // Log payment_result and order_confirmed audit events
    logAuditEvent({
      sessionId: sessionId || null,
      orderId: order.id,
      channel: order.channel,
      action: 'payment_result',
      details: {
        orderId: order.id,
        status: 'PAID',
        totalAmount: order.total_amount,
        paymentStatus: 'success'
      },
      outcome: 'success'
    });

    logAuditEvent({
      sessionId: sessionId || null,
      orderId: order.id,
      channel: order.channel,
      action: 'order_confirmed',
      details: {
        orderId: order.id,
        status: 'PAID',
        totalAmount: order.total_amount,
        currency: order.currency
      },
      outcome: 'success'
    });

    return {
      success: true,
      order: {
        id: order.id,
        status: 'PAID',
        totalAmount: order.total_amount,
        currency: order.currency
      }
    };
  } catch (error: any) {
    const errorMsg = error?.message || '';

    if (errorMsg.startsWith('INSUFFICIENT_STOCK:')) {
      const parts = errorMsg.split(':');
      const prodName = parts[2] || 'Product';
      const requested = parts[3];
      const available = parts[4];

      logAuditEvent({
        sessionId: sessionId || null,
        orderId: order.id,
        channel: order.channel,
        action: 'stock_failure',
        details: {
          orderId: order.id,
          error: 'INSUFFICIENT_STOCK',
          productName: prodName,
          requested,
          available
        },
        outcome: 'failure'
      });

      return {
        success: false,
        error: 'INSUFFICIENT_STOCK',
        message: `Insufficient stock for "${prodName}". Requested: ${requested}, Available: ${available}`
      };
    }

    if (errorMsg.startsWith('PRODUCT_NOT_FOUND:')) {
      return {
        success: false,
        error: 'PRODUCT_NOT_FOUND',
        message: 'A product in the order is no longer available in catalog'
      };
    }

    console.error('[OrderService] Error during order confirmation transaction:', error);
    throw new Error('Transaction failed during order confirmation');
  }
}

export interface CustomerOrderItem {
  id: string;
  productId: string;
  name: string;
  price: number;
  quantity: number;
  size?: string;
  color?: string;
  imageUrl: string;
}

export interface CustomerOrderSummary {
  id: string;
  sessionId?: string;
  channel: 'human' | 'agent';
  status: string;
  totalAmount: number;
  currency: string;
  paymentProvider: string;
  paymentOrderId?: string;
  paymentId?: string;
  createdAt: string;
  updatedAt: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  shippingAddress?: string;
  shippingCity?: string;
  shippingState?: string;
  shippingPostalCode?: string;
  items: CustomerOrderItem[];
}

export interface OrderQueryFilter {
  customerId?: string | null;
  sessionId?: string | null;
  userId?: string | null;
  email?: string | null;
}

/**
 * Retrieves all orders for a customer or session with joined product and item metadata.
 * Resolves orders whether created with sessionId, customerId, userId, or email.
 */
export function getCustomerOrders(filter: string | OrderQueryFilter): CustomerOrderSummary[] {
  if (!filter) return [];

  let customerId: string | null = null;
  let sessionId: string | null = null;
  let email: string | null = null;

  if (typeof filter === 'string') {
    const trimmed = filter.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('sess_')) {
      sessionId = trimmed;
    } else if (trimmed.includes('@')) {
      email = trimmed;
    } else {
      customerId = trimmed;
    }
  } else if (filter && typeof filter === 'object') {
    customerId = filter.customerId || filter.userId || null;
    sessionId = filter.sessionId || null;
    email = filter.email || null;
  }

  // Link customerId and email if either is available
  if (customerId && !email) {
    const cust = db.prepare('SELECT email FROM customers WHERE id = ?').get(customerId) as any;
    if (cust?.email) email = cust.email;
  }
  if (email && !customerId) {
    const cust = db.prepare('SELECT id FROM customers WHERE email = ?').get(email) as any;
    if (cust?.id) customerId = cust.id;
  }

  const conditions: string[] = [];
  const params: any[] = [];

  if (customerId) {
    conditions.push('(customer_id IS NOT NULL AND customer_id = ?)');
    params.push(customerId);
  }
  if (sessionId) {
    conditions.push('(session_id IS NOT NULL AND session_id = ?)');
    params.push(sessionId);
  }
  if (email) {
    conditions.push('(customer_email IS NOT NULL AND customer_email = ?)');
    params.push(email);
  }

  if (conditions.length === 0) return [];

  const orders = db.prepare(`
    SELECT *
    FROM orders
    WHERE ${conditions.join(' OR ')}
    ORDER BY created_at DESC
  `).all(...params) as any[];

  return orders.map((ord) => {
    const items = db.prepare(`
      SELECT oi.*, p.name as product_name, p.image_url as product_image_url
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(ord.id) as any[];

    return {
      id: ord.id,
      sessionId: ord.session_id || undefined,
      channel: ord.channel,
      status: ord.status,
      totalAmount: ord.total_amount,
      currency: ord.currency,
      paymentProvider: ord.payment_provider,
      paymentOrderId: ord.payment_order_id || undefined,
      paymentId: ord.payment_id || undefined,
      createdAt: ord.created_at,
      updatedAt: ord.updated_at,
      customerName: ord.customer_name || undefined,
      customerEmail: ord.customer_email || undefined,
      customerPhone: ord.customer_phone || undefined,
      shippingAddress: ord.shipping_address || undefined,
      shippingCity: ord.shipping_city || undefined,
      shippingState: ord.shipping_state || undefined,
      shippingPostalCode: ord.shipping_postal_code || undefined,
      items: items.map((it) => ({
        id: it.id,
        productId: it.product_id,
        name: it.product_name || 'Artisanal Piece',
        price: it.price,
        quantity: it.quantity,
        size: it.size || undefined,
        color: it.color || undefined,
        imageUrl: it.product_image_url || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
      }))
    };
  });
}

/**
 * Retrieves a single order for an authenticated customer or session.
 */
export function getOrderByIdForCustomer(orderId: string, filter: string | OrderQueryFilter): CustomerOrderSummary | null {
  if (!orderId || !filter) return null;

  let customerId: string | null = null;
  let sessionId: string | null = null;
  let email: string | null = null;

  if (typeof filter === 'string') {
    const trimmed = filter.trim();
    if (!trimmed) return null;
    if (trimmed.startsWith('sess_')) {
      sessionId = trimmed;
    } else if (trimmed.includes('@')) {
      email = trimmed;
    } else {
      customerId = trimmed;
    }
  } else if (filter && typeof filter === 'object') {
    customerId = filter.customerId || filter.userId || null;
    sessionId = filter.sessionId || null;
    email = filter.email || null;
  }

  if (customerId && !email) {
    const cust = db.prepare('SELECT email FROM customers WHERE id = ?').get(customerId) as any;
    if (cust?.email) email = cust.email;
  }
  if (email && !customerId) {
    const cust = db.prepare('SELECT id FROM customers WHERE email = ?').get(email) as any;
    if (cust?.id) customerId = cust.id;
  }

  const conditions: string[] = [];
  const params: any[] = [orderId.trim()];

  if (customerId) {
    conditions.push('(customer_id IS NOT NULL AND customer_id = ?)');
    params.push(customerId);
  }
  if (sessionId) {
    conditions.push('(session_id IS NOT NULL AND session_id = ?)');
    params.push(sessionId);
  }
  if (email) {
    conditions.push('(customer_email IS NOT NULL AND customer_email = ?)');
    params.push(email);
  }

  if (conditions.length === 0) return null;

  const ord = db.prepare(`
    SELECT *
    FROM orders
    WHERE id = ? AND (${conditions.join(' OR ')})
  `).get(...params) as any;

  if (!ord) return null;

  const items = db.prepare(`
    SELECT oi.*, p.name as product_name, p.image_url as product_image_url
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(ord.id) as any[];

  return {
    id: ord.id,
    sessionId: ord.session_id || undefined,
    channel: ord.channel,
    status: ord.status,
    totalAmount: ord.total_amount,
    currency: ord.currency,
    paymentProvider: ord.payment_provider,
    paymentOrderId: ord.payment_order_id || undefined,
    paymentId: ord.payment_id || undefined,
    createdAt: ord.created_at,
    updatedAt: ord.updated_at,
    customerName: ord.customer_name || undefined,
    customerEmail: ord.customer_email || undefined,
    customerPhone: ord.customer_phone || undefined,
    shippingAddress: ord.shipping_address || undefined,
    shippingCity: ord.shipping_city || undefined,
    shippingState: ord.shipping_state || undefined,
    shippingPostalCode: ord.shipping_postal_code || undefined,
    items: items.map((it) => ({
      id: it.id,
      productId: it.product_id,
      name: it.product_name || 'Artisanal Piece',
      price: it.price,
      quantity: it.quantity,
      size: it.size || undefined,
      color: it.color || undefined,
      imageUrl: it.product_image_url || 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80'
    }))
  };
}

export default {
  validateOrder,
  createOrder,
  confirmOrder,
  getCustomerOrders,
  getOrderByIdForCustomer,
  MAX_ORDER_VALUE,
  CONFIRMATION_THRESHOLD,
  DEFAULT_CURRENCY
};
