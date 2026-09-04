import { db } from '../db/db';
import { AuditAction, AuditLog, Channel, LogAuditEventParams, Outcome } from '../types';

const VALID_CHANNELS: Channel[] = ['human', 'agent'];
const VALID_OUTCOMES: Outcome[] = ['success', 'failure', 'user_declined'];

const SENSITIVE_KEYS = [
  'password',
  'secret',
  'api_key',
  'apikey',
  'token',
  'access_token',
  'card',
  'card_number',
  'cvv',
  'authorization'
];

/**
 * Strips sensitive security fields recursively from audit details.
 */
function sanitizeDetails(details: unknown): unknown {
  if (!details || typeof details !== 'object') {
    return details;
  }

  if (Array.isArray(details)) {
    return details.map(sanitizeDetails);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(details as Record<string, unknown>)) {
    const isSensitive = SENSITIVE_KEYS.some((sensitive) =>
      key.toLowerCase().includes(sensitive)
    );

    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeDetails(value);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * Logs a commerce audit event into SQLite.
 *
 * Principles:
 * 1. Explains what actions occurred (search, propose, guardrails, payment, confirmation).
 * 2. Uses structured JSON in the details column.
 * 3. Never stores sensitive authentication tokens, passwords, or payment secrets.
 * 4. Supports both human and agent channels.
 */
export function logAuditEvent(params: LogAuditEventParams): AuditLog {
  const auditId = `aud_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Validate & Normalize Channel
  let channel: Channel = 'human';
  if (params.channel && VALID_CHANNELS.includes(params.channel.toLowerCase() as Channel)) {
    channel = params.channel.toLowerCase() as Channel;
  }

  // Validate & Normalize Outcome
  let outcome: Outcome | null = null;
  if (params.outcome && VALID_OUTCOMES.includes(params.outcome.toLowerCase() as Outcome)) {
    outcome = params.outcome.toLowerCase() as Outcome;
  }

  // Validate Foreign Key for orderId
  let cleanOrderId: string | null = null;
  if (params.orderId && typeof params.orderId === 'string' && params.orderId.trim().length > 0) {
    const candidateId = params.orderId.trim();
    // Verify existence in orders table to satisfy foreign key constraint
    const existingOrder = db.prepare('SELECT id FROM orders WHERE id = ?').get(candidateId);
    if (existingOrder) {
      cleanOrderId = candidateId;
    }
  }

  const cleanSessionId = params.sessionId && typeof params.sessionId === 'string' && params.sessionId.trim().length > 0
    ? params.sessionId.trim()
    : null;

  // Sanitize and serialize details
  let detailsObj: any = params.details;
  if (params.orderId && !cleanOrderId) {
    if (typeof detailsObj === 'object' && detailsObj !== null) {
      detailsObj = { ...detailsObj, referencedOrderId: params.orderId };
    } else {
      detailsObj = { message: String(detailsObj || ''), referencedOrderId: params.orderId };
    }
  }

  let detailsJson: string | null = null;
  if (detailsObj !== undefined && detailsObj !== null) {
    if (typeof detailsObj === 'string') {
      try {
        const parsed = JSON.parse(detailsObj);
        detailsJson = JSON.stringify(sanitizeDetails(parsed));
      } catch {
        detailsJson = JSON.stringify({ message: detailsObj });
      }
    } else {
      detailsJson = JSON.stringify(sanitizeDetails(detailsObj));
    }
  }

  const cleanAction = typeof params.action === 'string' ? params.action.trim() : 'unknown';

  try {
    const insertStmt = db.prepare(`
      INSERT INTO audit_log (
        id, order_id, session_id, channel, action, details, outcome, created_at
      ) VALUES (
        ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP
      )
    `);

    insertStmt.run(
      auditId,
      cleanOrderId,
      cleanSessionId,
      channel,
      cleanAction,
      detailsJson,
      outcome
    );

    return {
      id: auditId,
      order_id: cleanOrderId,
      session_id: cleanSessionId,
      channel,
      action: cleanAction,
      details: detailsJson,
      outcome,
      created_at: new Date().toISOString()
    };
  } catch (error) {
    console.error('[AuditService] Failed to insert audit event:', error);
    return {
      id: auditId,
      order_id: cleanOrderId,
      session_id: cleanSessionId,
      channel,
      action: cleanAction,
      details: detailsJson,
      outcome,
      created_at: new Date().toISOString()
    };
  }
}

/**
 * Retrieves audit log entries filtered by orderId, sessionId, or channel.
 */
export function getAuditLogs(filters?: {
  orderId?: string;
  sessionId?: string;
  channel?: Channel | string;
  action?: AuditAction | string;
  limit?: number;
}): AuditLog[] {
  let query = 'SELECT * FROM audit_log WHERE 1=1';
  const params: any[] = [];

  if (filters?.orderId) {
    query += ' AND order_id = ?';
    params.push(filters.orderId);
  }

  if (filters?.sessionId) {
    query += ' AND session_id = ?';
    params.push(filters.sessionId);
  }

  if (filters?.channel) {
    query += ' AND channel = ?';
    params.push(filters.channel);
  }

  if (filters?.action) {
    query += ' AND action = ?';
    params.push(filters.action);
  }

  query += ' ORDER BY created_at DESC';

  if (filters?.limit && filters.limit > 0) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  } else {
    query += ' LIMIT 100';
  }

  return db.prepare(query).all(...params) as AuditLog[];
}

export default {
  logAuditEvent,
  getAuditLogs
};
