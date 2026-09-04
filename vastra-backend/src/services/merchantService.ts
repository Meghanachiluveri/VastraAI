import { db } from '../db/db';
import {
  Channel,
  DateRange,
  MerchantActivityRecord,
  MerchantOrderItem,
  MerchantOrderRecord,
  MerchantOverviewData
} from '../types';

/**
 * Builds SQLite date filter condition based on range.
 */
function buildDateCondition(range: DateRange = 'all', column: string = 'created_at'): string {
  switch (range) {
    case 'today':
      return `datetime(${column}) >= datetime('now', '-24 hours')`;
    case '7d':
      return `datetime(${column}) >= datetime('now', '-7 days')`;
    case '30d':
      return `datetime(${column}) >= datetime('now', '-30 days')`;
    case 'all':
    default:
      return '1=1';
  }
}

/**
 * Calculates store overview metrics for merchant analytics.
 */
export function getMerchantOverview(range: DateRange = 'all'): MerchantOverviewData {
  const orderDateCond = buildDateCondition(range, 'created_at');
  const auditDateCond = buildDateCondition(range, 'created_at');

  // 1. Calculate Revenue & Orders from Paid / Completed Orders
  const revenueRows = db.prepare(`
    SELECT
      channel,
      COUNT(*) as count,
      COALESCE(SUM(total_amount), 0) as revenue
    FROM orders
    WHERE status IN ('PAID', 'COMPLETED')
      AND ${orderDateCond}
    GROUP BY channel
  `).all() as { channel: Channel; count: number; revenue: number }[];

  let humanRevenue = 0;
  let humanOrders = 0;
  let aiRevenue = 0;
  let aiOrders = 0;

  for (const row of revenueRows) {
    if (row.channel === 'agent') {
      aiRevenue = row.revenue;
      aiOrders = row.count;
    } else if (row.channel === 'human') {
      humanRevenue = row.revenue;
      humanOrders = row.count;
    }
  }

  const totalRevenue = humanRevenue + aiRevenue;
  const totalOrders = humanOrders + aiOrders;
  const avgHumanOrderValue = humanOrders > 0 ? Math.round(humanRevenue / humanOrders) : 0;
  const avgAiOrderValue = aiOrders > 0 ? Math.round(aiRevenue / aiOrders) : 0;

  // 2. Calculate AI Sessions from Audit Logs
  const sessionRow = db.prepare(`
    SELECT COUNT(DISTINCT session_id) as count
    FROM audit_log
    WHERE channel = 'agent'
      AND session_id IS NOT NULL
      AND session_id != ''
      AND ${auditDateCond}
  `).get() as { count: number } | undefined;

  let aiSessions = sessionRow?.count || 0;
  // If there are AI orders, sessions is at least the number of distinct AI order sessions
  if (aiOrders > 0 && aiSessions < aiOrders) {
    aiSessions = aiOrders;
  }

  const aiConversionRate = aiSessions > 0
    ? Number(((aiOrders / aiSessions) * 100).toFixed(1))
    : 0;

  // 3. Upsell Analytics
  const upsellStats = db.prepare(`
    SELECT
      action,
      COUNT(*) as count
    FROM audit_log
    WHERE action IN ('upsell_suggested', 'upsell_accepted', 'upsell_declined')
      AND ${auditDateCond}
    GROUP BY action
  `).all() as { action: string; count: number }[];

  let upsellsSuggested = 0;
  let upsellsAccepted = 0;
  let upsellsDeclined = 0;

  for (const row of upsellStats) {
    if (row.action === 'upsell_suggested') upsellsSuggested = row.count;
    if (row.action === 'upsell_accepted') upsellsAccepted = row.count;
    if (row.action === 'upsell_declined') upsellsDeclined = row.count;
  }

  const upsellAcceptanceRate = upsellsSuggested > 0
    ? Number(((upsellsAccepted / upsellsSuggested) * 100).toFixed(1))
    : 0;

  // Calculate upsell revenue from accepted upsell audit details
  const acceptedLogs = db.prepare(`
    SELECT details FROM audit_log
    WHERE action = 'upsell_accepted' AND ${auditDateCond}
  `).all() as { details: string }[];

  let upsellRevenue = 0;
  for (const log of acceptedLogs) {
    try {
      if (log.details) {
        const parsed = JSON.parse(log.details);
        if (parsed.price) upsellRevenue += Number(parsed.price);
      }
    } catch {
      // ignore parse errors
    }
  }

  // 4. AI Shopping Conversion Funnel
  const recStats = db.prepare(`
    SELECT COUNT(*) as count FROM audit_log
    WHERE action IN ('recommendation', 'propose')
      AND channel = 'agent'
      AND ${auditDateCond}
  `).get() as { count: number } | undefined;

  const cartAddStats = db.prepare(`
    SELECT COUNT(*) as count FROM audit_log
    WHERE action = 'add_to_bag'
      AND channel = 'agent'
      AND ${auditDateCond}
  `).get() as { count: number } | undefined;

  const checkoutStats = db.prepare(`
    SELECT COUNT(*) as count FROM audit_log
    WHERE action IN ('gating_check', 'prepare_checkout', 'payment_attempt')
      AND channel = 'agent'
      AND ${auditDateCond}
  `).get() as { count: number } | undefined;

  const funnel = {
    sessions: aiSessions,
    recommendations: recStats?.count || 0,
    cartAdditions: cartAddStats?.count || 0,
    checkoutAttempts: checkoutStats?.count || 0,
    confirmedOrders: aiOrders,
    conversionRate: aiConversionRate
  };

  return {
    totalRevenue,
    aiRevenue,
    humanRevenue,
    totalOrders,
    aiOrders,
    humanOrders,
    aiSessions,
    aiConversionRate,
    avgAiOrderValue,
    avgHumanOrderValue,
    upsell: {
      upsellsSuggested,
      upsellsAccepted,
      upsellsDeclined,
      upsellAcceptanceRate,
      upsellRevenue
    },
    funnel,
    range
  };
}

/**
 * Retrieves orders for merchant order table and inspection.
 */
export function getMerchantOrders(
  range: DateRange = 'all',
  channel?: string,
  limit: number = 50
): MerchantOrderRecord[] {
  const dateCond = buildDateCondition(range, 'o.created_at');
  let channelCond = '1=1';
  if (channel && (channel === 'human' || channel === 'agent')) {
    channelCond = `o.channel = '${channel}'`;
  }

  const orders = db.prepare(`
    SELECT
      o.id,
      o.channel,
      o.status,
      o.total_amount,
      o.currency,
      o.payment_id,
      o.created_at
    FROM orders o
    WHERE ${dateCond} AND ${channelCond}
    ORDER BY o.created_at DESC
    LIMIT ?
  `).all(limit) as any[];

  return orders.map((order) => {
    // Get line items
    const items = db.prepare(`
      SELECT
        oi.id,
        oi.product_id as productId,
        oi.quantity,
        oi.price,
        oi.size,
        oi.color,
        p.name,
        p.image_url as imageUrl
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = ?
    `).all(order.id) as MerchantOrderItem[];

    // Extract customerInfo from audit log if available
    let customerInfo: any = undefined;
    let sessionId: string | null = null;
    const auditRow = db.prepare(`
      SELECT details, session_id FROM audit_log
      WHERE order_id = ? AND action IN ('order_created', 'order_confirmed', 'payment_verified')
      ORDER BY created_at DESC LIMIT 1
    `).get(order.id) as { details?: string; session_id?: string } | undefined;

    if (auditRow) {
      sessionId = auditRow.session_id || null;
      if (auditRow.details) {
        try {
          const parsed = JSON.parse(auditRow.details);
          if (parsed.customerInfo) customerInfo = parsed.customerInfo;
          else if (parsed.name || parsed.email) {
            customerInfo = {
              name: parsed.name,
              email: parsed.email,
              phone: parsed.phone,
              address: parsed.address
            };
          }
        } catch {
          // ignore
        }
      }
    }

    const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

    return {
      id: order.id,
      channel: order.channel,
      status: order.status,
      totalAmount: order.total_amount,
      currency: order.currency || 'INR',
      itemCount,
      items,
      customerInfo,
      sessionId,
      paymentId: order.payment_id,
      createdAt: order.created_at
    };
  });
}

/**
 * Retrieves a single order by ID with line items.
 */
export function getMerchantOrderById(orderId: string): MerchantOrderRecord | null {
  const order = db.prepare(`
    SELECT
      o.id,
      o.channel,
      o.status,
      o.total_amount,
      o.currency,
      o.payment_id,
      o.created_at
    FROM orders o
    WHERE o.id = ?
  `).get(orderId) as any;

  if (!order) return null;

  const items = db.prepare(`
    SELECT
      oi.id,
      oi.product_id as productId,
      oi.quantity,
      oi.price,
      oi.size,
      oi.color,
      p.name,
      p.image_url as imageUrl
    FROM order_items oi
    LEFT JOIN products p ON oi.product_id = p.id
    WHERE oi.order_id = ?
  `).all(order.id) as MerchantOrderItem[];

  let customerInfo: any = undefined;
  let sessionId: string | null = null;
  const auditRow = db.prepare(`
    SELECT details, session_id FROM audit_log
    WHERE order_id = ? AND action IN ('order_created', 'order_confirmed', 'payment_verified')
    ORDER BY created_at DESC LIMIT 1
  `).get(order.id) as { details?: string; session_id?: string } | undefined;

  if (auditRow) {
    sessionId = auditRow.session_id || null;
    if (auditRow.details) {
      try {
        const parsed = JSON.parse(auditRow.details);
        if (parsed.customerInfo) customerInfo = parsed.customerInfo;
      } catch {
        // ignore
      }
    }
  }

  const itemCount = items.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return {
    id: order.id,
    channel: order.channel,
    status: order.status,
    totalAmount: order.total_amount,
    currency: order.currency || 'INR',
    itemCount,
    items,
    customerInfo,
    sessionId,
    paymentId: order.payment_id,
    createdAt: order.created_at
  };
}

/**
 * Formats user-friendly descriptions for merchant activity feed.
 */
function formatActivityDescription(action: string, channel: Channel, details: any): string {
  const actor = channel === 'agent' ? 'AI Concierge' : 'Shopper';
  const prodName = details?.productName || details?.name || details?.productId || 'an artisanal piece';
  const size = details?.size ? ` (Size: ${details.size})` : '';

  switch (action) {
    case 'add_to_bag':
      return `${actor} added ${prodName}${size} to shopping bag`;
    case 'remove_from_bag':
      return `${actor} removed ${prodName} from shopping bag`;
    case 'cart_quantity_updated':
      return `${actor} updated quantity of ${prodName} to ${details?.newQuantity || details?.quantity || 1}`;
    case 'cart_cleared':
      return `${actor} cleared the shopping bag`;
    case 'cart_viewed':
      return `${actor} inspected current bag selection`;
    case 'recommendation':
    case 'propose':
      return `AI Concierge recommended ${prodName}`;
    case 'upsell_suggested':
      return `AI Concierge suggested styling accompaniment: ${prodName}`;
    case 'upsell_accepted':
      return `Patron accepted suggested upsell: ${prodName}`;
    case 'upsell_declined':
      return `Patron declined suggested upsell accompaniment`;
    case 'order_created':
      return `New order created for ₹${(details?.total || details?.amount || 0).toLocaleString('en-IN')}`;
    case 'order_confirmed':
      return `Order confirmation confirmed by patron`;
    case 'payment_verified':
      return `Payment successfully verified via Razorpay for order ${details?.orderId || ''}`;
    case 'payment_failed':
      return `Payment transaction failed or declined by issuing bank`;
    case 'payment_cancelled':
      return `Checkout session cancelled by patron`;
    case 'price_changed':
      return `Live catalog price change detected for ${prodName}`;
    case 'stock_failure':
      return `Stock boundary prevented order of out-of-stock item`;
    default:
      return `${actor} performed ${action.replace(/_/g, ' ')}`;
  }
}

/**
 * Retrieves recent merchant activity feed from audit logs.
 */
export function getMerchantActivity(
  range: DateRange = 'all',
  limit: number = 50
): MerchantActivityRecord[] {
  const dateCond = buildDateCondition(range, 'created_at');

  const rows = db.prepare(`
    SELECT
      id,
      order_id as orderId,
      session_id as sessionId,
      channel,
      action,
      details,
      outcome,
      created_at as createdAt
    FROM audit_log
    WHERE ${dateCond}
    ORDER BY created_at DESC
    LIMIT ?
  `).all(limit) as any[];

  return rows.map((row) => {
    let parsedDetails: any = null;
    if (row.details) {
      try {
        parsedDetails = JSON.parse(row.details);
      } catch {
        parsedDetails = { raw: row.details };
      }
    }

    const description = formatActivityDescription(row.action, row.channel, parsedDetails);

    return {
      id: row.id,
      orderId: row.orderId,
      sessionId: row.sessionId,
      channel: row.channel,
      action: row.action,
      description,
      details: parsedDetails,
      outcome: row.outcome,
      createdAt: row.createdAt
    };
  });
}

/**
 * Updates a product's inventory stock and/or price.
 * Protected for merchant management and test controls.
 */
export function updateProductInventory(
  productId: string,
  updates: { stock?: number; price?: number }
): { success: boolean; product?: any; message?: string } {
  if (!productId || typeof productId !== 'string') {
    return { success: false, message: 'PRODUCT_ID_REQUIRED' };
  }

  const cleanId = productId.trim();
  const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(cleanId) as any;
  if (!existing) {
    return { success: false, message: 'PRODUCT_NOT_FOUND' };
  }

  const newStock = updates.stock !== undefined ? Math.max(0, updates.stock) : existing.stock;
  const newPrice = updates.price !== undefined ? Math.max(0, updates.price) : existing.price;

  db.prepare(`
    UPDATE products
    SET stock = ?, price = ?
    WHERE id = ?
  `).run(newStock, newPrice, cleanId);

  const updated = db.prepare('SELECT * FROM products WHERE id = ?').get(cleanId) as any;

  return {
    success: true,
    product: {
      id: updated.id,
      name: updated.name,
      stock: updated.stock,
      price: updated.price
    }
  };
}
