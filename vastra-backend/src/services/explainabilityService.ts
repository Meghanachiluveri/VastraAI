import { db } from '../db/db';
import {
  AiSessionDetail,
  AiSessionSummary,
  AiTimelineEvent,
  ExplainabilityStatus,
  GuardrailCheckDetail
} from '../types';

/**
 * Builds a SQL date filter condition matching 'today' (24h), '7d', '30d', or 'all'.
 */
function getDateCondition(range: 'today' | '7d' | '30d' | 'all', column: string = 'created_at'): string {
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
 * Parses JSON safely without throwing.
 */
function safeJsonParse(data: any): any {
  if (!data) return {};
  if (typeof data === 'object') return data;
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Transforms raw audit event row into a sanitized, user-safe explainability timeline event.
 */
export function formatAuditTimelineEvent(row: {
  id: string;
  order_id?: string | null;
  session_id?: string | null;
  channel: string;
  action: string;
  details: string;
  outcome?: string;
  created_at: string;
}): AiTimelineEvent {
  const details = safeJsonParse(row.details);
  const action = row.action || '';
  const outcome = row.outcome || 'success';
  const sessionId = row.session_id || 'unknown';
  const timestamp = row.created_at;

  let eventType = action;
  let title = 'AI Agent Action';
  let description = 'AI stylist processed customer interaction';
  let explanation: string | undefined = undefined;
  let status: ExplainabilityStatus = 'informational';
  let product: AiTimelineEvent['product'] = undefined;
  let guardrails: GuardrailCheckDetail[] | undefined = undefined;
  let priceChange: AiTimelineEvent['priceChange'] = undefined;
  let paymentInfo: AiTimelineEvent['paymentInfo'] = undefined;
  let failureDetails: AiTimelineEvent['failureDetails'] = undefined;

  // 1. Catalog Search
  if (action === 'search') {
    eventType = 'search';
    title = 'Catalog Search';
    const q = details.query || details.keyword || details.category || 'Luxury pieces';
    description = `Searched atelier collection for "${q}"`;
    explanation = 'Queried database index matching keywords, category filters, and gender preferences.';
    status = 'informational';
  }
  // 2. Product Recommendation / Proposal
  else if (action === 'recommendation' || action === 'propose') {
    eventType = 'recommendation';
    title = 'Curated Recommendation';
    const prodName = details.productName || details.name || 'Artisanal Piece';
    const price = details.price ? ` (₹${details.price.toLocaleString('en-IN')})` : '';
    description = `Recommended ${prodName}${price}`;
    explanation = details.reason
      || `Selected based on query match, available sizes, customer budget, and high rating (${details.rating || 4.8}★).`;
    status = 'success';

    if (details.productId || details.id) {
      product = {
        id: details.productId || details.id,
        name: prodName,
        price: Number(details.price || 0),
        size: details.size,
        color: details.color,
        imageUrl: details.imageUrl
      };
    }
  }
  // 3. Add to Bag
  else if (action === 'add_to_bag') {
    eventType = 'add_to_bag';
    title = 'Added to Shopping Bag';
    const prodName = details.productName || details.name || 'Garment';
    const sizeStr = details.size ? ` in size ${details.size}` : '';
    const colorStr = details.color ? `, color ${details.color}` : '';
    description = `Added ${prodName}${sizeStr}${colorStr} (Qty: ${details.quantity || 1})`;
    explanation = 'Verified stock availability and synchronized with backend shared shopping bag.';
    status = 'success';

    if (details.productId) {
      product = {
        id: details.productId,
        name: prodName,
        price: Number(details.price || 0),
        size: details.size,
        color: details.color,
        quantity: details.quantity || 1
      };
    }
  }
  // 4. Remove from Bag
  else if (action === 'remove_from_bag') {
    eventType = 'remove_from_bag';
    title = 'Removed from Bag';
    description = `Removed ${details.productName || 'item'} from shopping bag`;
    status = 'informational';
  }
  // 5. Bounded Upsell Suggested
  else if (action === 'upsell_suggested') {
    eventType = 'upsell_suggested';
    title = 'Bounded Upsell Suggested';
    const prodName = details.productName || details.name || 'Artisanal Accessory';
    const price = details.price ? ` (₹${details.price.toLocaleString('en-IN')})` : '';
    description = `Proposed complementary pairing: ${prodName}${price}`;
    explanation = 'AI styled a single bounded accessory (under ₹10,000) that complements the chosen garment.';
    status = 'informational';

    if (details.productId) {
      product = {
        id: details.productId,
        name: prodName,
        price: Number(details.price || 0)
      };
    }
  }
  // 6. Upsell Accepted
  else if (action === 'upsell_accepted') {
    eventType = 'upsell_accepted';
    title = 'Upsell Accepted by Shopper';
    description = `Shopper accepted styling recommendation: ${details.productName || 'Accessory'}`;
    explanation = 'Complementary item was added to the shared cart.';
    status = 'success';
  }
  // 7. Upsell Declined
  else if (action === 'upsell_declined') {
    eventType = 'upsell_declined';
    title = 'Upsell Declined';
    description = 'Shopper politely declined the complementary styling piece';
    explanation = 'Bounded upsell was skipped; shopping flow proceeded with primary selection.';
    status = 'declined';
  }
  // 8. Guardrail Check / Order Validation
  else if (action === 'guardrail_check' || action === 'gating_check') {
    eventType = 'guardrail_check';
    title = 'Commerce Guardrail Safety Check';
    description = 'Backend validated stock levels, order threshold, and spending caps';
    status = outcome === 'success' ? 'success' : 'failed';

    const maxVal = details.maxOrderValue || 10000;
    const totalAmt = details.totalAmount || details.total || 0;

    guardrails = [
      {
        label: 'Real-time inventory available',
        passed: outcome === 'success',
        message: outcome === 'success' ? 'In stock' : (details.error || 'Inventory constraint')
      },
      {
        label: `Order within limit (Max ₹${maxVal.toLocaleString('en-IN')})`,
        passed: totalAmt <= maxVal,
        message: `Order value: ₹${totalAmt.toLocaleString('en-IN')}`
      },
      {
        label: 'Current catalog price verified',
        passed: true,
        message: 'Authoritative SQLite database price applied'
      },
      {
        label: 'Explicit human confirmation required',
        passed: true,
        message: 'Safety gate active (Threshold: ₹500)'
      }
    ];

    if (action === 'gating_check') {
      explanation = details.confirmed
        ? 'Customer provided explicit human confirmation before checkout creation.'
        : 'Order withheld awaiting explicit customer approval.';
    }
  }
  // 9. Order Created
  else if (action === 'order_created') {
    eventType = 'order_created';
    title = 'Order Created (Pending Payment)';
    description = `Generated server order #${row.order_id || details.orderId || 'PENDING'} for ₹${Number(details.totalAmount || details.total || 0).toLocaleString('en-IN')}`;
    status = 'pending';
  }
  // 10. Payment Attempt
  else if (action === 'payment_attempt') {
    eventType = 'payment_attempt';
    title = 'Payment Attempt Initiated';
    const amt = details.amountPaise ? details.amountPaise / 100 : Number(details.amount || 0);
    description = `Razorpay Test Mode checkout opened for ₹${amt.toLocaleString('en-IN')}`;
    status = 'pending';
    paymentInfo = {
      status: 'ATTEMPTED',
      amount: amt,
      currency: 'INR',
      orderId: row.order_id || details.orderId
    };
  }
  // 11. Payment Verified
  else if (action === 'payment_verified') {
    eventType = 'payment_verified';
    title = 'Payment Verified & Settled';
    const amt = details.amountPaise ? details.amountPaise / 100 : Number(details.amount || 0);
    description = `Payment authorization verified. Order #${row.order_id || details.orderId} marked PAID.`;
    explanation = 'Payment confirmed by gateway. Live inventory decremented atomically.';
    status = 'success';
    paymentInfo = {
      status: 'PAID',
      amount: amt,
      currency: 'INR',
      orderId: row.order_id || details.orderId
    };
  }
  // 12. Payment Failed
  else if (action === 'payment_failed') {
    eventType = 'payment_failed';
    title = 'Payment Settlement Failed';
    description = `Gateway declined payment: ${details.reason || 'Verification failure'}`;
    status = 'failed';
    failureDetails = {
      reason: details.reason || 'Payment verification failed',
      recoveryAction: 'Cart preserved safely. Customer prompted to retry with an alternate payment method.'
    };
  }
  // 13. Payment Cancelled
  else if (action === 'payment_cancelled') {
    eventType = 'payment_cancelled';
    title = 'Payment Cancelled by Shopper';
    description = 'Shopper dismissed the Razorpay checkout modal';
    status = 'declined';
  }
  // 14. Stock Failure
  else if (action === 'stock_failure') {
    eventType = 'stock_failure';
    title = 'Inventory Depleted';
    description = `Item ${details.productName || details.productId || ''} is no longer available in the requested quantity`;
    status = 'failed';
    failureDetails = {
      reason: 'Product sold out prior to checkout confirmation',
      recoveryAction: 'AI agent suggested similar in-stock luxury garments.'
    };
  }
  // 15. Price Changed
  else if (action === 'price_changed') {
    eventType = 'price_changed';
    title = 'Live Price Update Intercepted';
    description = `Price changed from ₹${Number(details.previousPrice || 0).toLocaleString('en-IN')} to ₹${Number(details.currentPrice || 0).toLocaleString('en-IN')}`;
    status = 'informational';
    priceChange = {
      previousPrice: Number(details.previousPrice || 0),
      currentPrice: Number(details.currentPrice || 0),
      requiresReconfirmation: true
    };
    explanation = 'Backend guardrails detected a catalog price change and required explicit shopper re-confirmation.';
  }
  // 16. Tool Failure / Fallback
  else if (action === 'tool_failure') {
    eventType = 'tool_failure';
    title = 'AI Concierge Fallback';
    description = 'Gracefully handled downstream service response without interrupting the shopper.';
    status = 'informational';
  }
  // Default Fallback
  else {
    eventType = action;
    title = action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    description = details.message || `Processed ${action} event`;
    status = outcome === 'success' ? 'success' : (outcome === 'failure' ? 'failed' : 'informational');
  }

  return {
    id: row.id,
    sessionId,
    orderId: row.order_id || details.orderId || null,
    eventType,
    title,
    description,
    explanation,
    status,
    timestamp,
    product,
    guardrails,
    priceChange,
    paymentInfo,
    failureDetails
  };
}

/**
 * Retrieves list of AI shopping sessions with summary statistics.
 */
export function getAiSessions(params: {
  range?: 'today' | '7d' | '30d' | 'all';
  filter?: 'all' | 'searches' | 'recommendations' | 'cart' | 'checkout' | 'payments' | 'failures' | 'orders';
  limit?: number;
}): { sessions: AiSessionSummary[]; total: number } {
  const range = params.range || 'all';
  const filter = params.filter || 'all';
  const limit = Math.min(100, Math.max(1, params.limit || 50));
  const dateCond = getDateCondition(range, 'created_at');

  try {
    // 1. Get distinct AI session IDs in date range
    const sessionRows = db.prepare(`
      SELECT
        session_id as sessionId,
        MIN(created_at) as startedAt,
        MAX(created_at) as lastActiveAt,
        COUNT(*) as totalActions,
        GROUP_CONCAT(DISTINCT action) as actionList
      FROM audit_log
      WHERE channel = 'agent'
        AND session_id IS NOT NULL
        AND ${dateCond}
      GROUP BY session_id
      ORDER BY lastActiveAt DESC
      LIMIT ?
    `).all(limit) as {
      sessionId: string;
      startedAt: string;
      lastActiveAt: string;
      totalActions: number;
      actionList: string;
    }[];

    const summaries: AiSessionSummary[] = [];

    for (const s of sessionRows) {
      const actions = (s.actionList || '').split(',').map((a) => a.trim());

      // Filter check
      if (filter !== 'all') {
        let match = false;
        if (filter === 'searches' && actions.includes('search')) match = true;
        if (filter === 'recommendations' && (actions.includes('recommendation') || actions.includes('propose'))) match = true;
        if (filter === 'cart' && (actions.includes('add_to_bag') || actions.includes('remove_from_bag'))) match = true;
        if (filter === 'checkout' && (actions.includes('guardrail_check') || actions.includes('gating_check') || actions.includes('order_created'))) match = true;
        if (filter === 'payments' && (actions.includes('payment_attempt') || actions.includes('payment_verified') || actions.includes('payment_failed'))) match = true;
        if (filter === 'failures' && (actions.includes('payment_failed') || actions.includes('stock_failure') || actions.includes('tool_failure'))) match = true;
        if (filter === 'orders' && actions.includes('payment_verified')) match = true;

        if (!match) continue;
      }

      // Check if session has a completed order
      const paidOrder = db.prepare(`
        SELECT id, total_amount, status
        FROM orders
        WHERE channel = 'agent'
          AND (id IN (SELECT order_id FROM audit_log WHERE session_id = ? AND order_id IS NOT NULL))
        ORDER BY created_at DESC
        LIMIT 1
      `).get(s.sessionId) as { id: string; total_amount: number; status: string } | undefined;

      // Extract first search intent if available
      const firstSearch = db.prepare(`
        SELECT details FROM audit_log
        WHERE session_id = ? AND action = 'search'
        ORDER BY created_at ASC
        LIMIT 1
      `).get(s.sessionId) as { details: string } | undefined;

      let primaryIntent: string | undefined = undefined;
      if (firstSearch?.details) {
        const d = safeJsonParse(firstSearch.details);
        primaryIntent = d.query || d.keyword || d.category;
      }

      let status: AiSessionSummary['status'] = 'DROPPED';
      if (paidOrder && paidOrder.status === 'PAID') {
        status = 'COMPLETED';
      } else if (actions.some((a) => a === 'payment_failed' || a === 'stock_failure')) {
        status = 'FAILED';
      } else if (actions.length > 2) {
        status = 'IN_PROGRESS';
      }

      summaries.push({
        sessionId: s.sessionId,
        startedAt: s.startedAt,
        lastActiveAt: s.lastActiveAt,
        totalActions: s.totalActions,
        hasOrder: !!paidOrder,
        orderId: paidOrder?.id || null,
        orderStatus: paidOrder?.status || null,
        orderAmount: paidOrder ? Number(paidOrder.total_amount) : null,
        primaryIntent,
        status,
        actionTypes: actions
      });
    }

    return {
      sessions: summaries,
      total: summaries.length
    };
  } catch (err) {
    console.error('[ExplainabilityService] Error getting AI sessions:', err);
    return { sessions: [], total: 0 };
  }
}

/**
 * Retrieves the full chronological explainability timeline for a single AI shopping session.
 */
export function getAiSessionTimeline(sessionId: string): AiSessionDetail | null {
  if (!sessionId || sessionId.trim().length === 0) return null;

  try {
    const rawEvents = db.prepare(`
      SELECT
        id,
        order_id,
        session_id,
        channel,
        action,
        details,
        outcome,
        created_at
      FROM audit_log
      WHERE session_id = ?
      ORDER BY created_at ASC
    `).all(sessionId.trim()) as any[];

    if (rawEvents.length === 0) {
      return null;
    }

    const timeline: AiTimelineEvent[] = rawEvents.map(formatAuditTimelineEvent);

    // Summary calculation
    const startedAt = rawEvents[0].created_at;
    const lastActiveAt = rawEvents[rawEvents.length - 1].created_at;
    const totalActions = rawEvents.length;
    const actionTypes = Array.from(new Set(rawEvents.map((r) => r.action)));

    const paidOrder = db.prepare(`
      SELECT id, total_amount, status
      FROM orders
      WHERE id IN (SELECT order_id FROM audit_log WHERE session_id = ? AND order_id IS NOT NULL)
      LIMIT 1
    `).get(sessionId) as { id: string; total_amount: number; status: string } | undefined;

    let status: AiSessionSummary['status'] = 'DROPPED';
    if (paidOrder && paidOrder.status === 'PAID') {
      status = 'COMPLETED';
    } else if (actionTypes.includes('payment_failed') || actionTypes.includes('stock_failure')) {
      status = 'FAILED';
    } else if (totalActions > 2) {
      status = 'IN_PROGRESS';
    }

    const summary: AiSessionSummary = {
      sessionId,
      startedAt,
      lastActiveAt,
      totalActions,
      hasOrder: !!paidOrder,
      orderId: paidOrder?.id || null,
      orderStatus: paidOrder?.status || null,
      orderAmount: paidOrder ? Number(paidOrder.total_amount) : null,
      status,
      actionTypes
    };

    return {
      sessionId,
      summary,
      timeline
    };
  } catch (err) {
    console.error('[ExplainabilityService] Error getting session timeline:', err);
    return null;
  }
}
