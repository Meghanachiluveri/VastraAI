import apiClient from '../lib/axios';

export type ExplainabilityStatus = 'success' | 'pending' | 'failed' | 'declined' | 'informational';

export interface GuardrailCheckDetail {
  label: string;
  passed: boolean;
  message?: string;
}

export interface AiTimelineEvent {
  id: string;
  sessionId: string;
  orderId?: string | null;
  eventType: string;
  title: string;
  description: string;
  explanation?: string;
  status: ExplainabilityStatus;
  timestamp: string;
  product?: {
    id: string;
    name: string;
    price: number;
    size?: string;
    color?: string;
    quantity?: number;
    imageUrl?: string;
  };
  guardrails?: GuardrailCheckDetail[];
  priceChange?: {
    previousPrice: number;
    currentPrice: number;
    requiresReconfirmation: boolean;
  };
  paymentInfo?: {
    status: string;
    amount: number;
    currency: string;
    orderId?: string;
  };
  failureDetails?: {
    reason: string;
    recoveryAction?: string;
  };
}

export interface AiSessionSummary {
  sessionId: string;
  startedAt: string;
  lastActiveAt: string;
  totalActions: number;
  hasOrder: boolean;
  orderId?: string | null;
  orderStatus?: string | null;
  orderAmount?: number | null;
  primaryIntent?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'FAILED' | 'DROPPED';
  actionTypes: string[];
}

export interface AiSessionDetail {
  sessionId: string;
  summary: AiSessionSummary;
  timeline: AiTimelineEvent[];
}

/**
 * Retrieves list of AI shopping sessions with multi-criteria filters.
 */
export async function getAiSessions(params?: {
  range?: 'today' | '7d' | '30d' | 'all';
  filter?: 'all' | 'searches' | 'recommendations' | 'cart' | 'checkout' | 'payments' | 'failures' | 'orders';
  limit?: number;
}): Promise<{ sessions: AiSessionSummary[]; total: number }> {
  const response = await apiClient.get('/merchant/ai-sessions', {
    params,
  });
  return response.data;
}

/**
 * Retrieves the full chronological explainable timeline for a specific AI shopping session.
 */
export async function getAiSessionTimeline(sessionId: string): Promise<AiSessionDetail> {
  const response = await apiClient.get(`/merchant/ai-sessions/${encodeURIComponent(sessionId)}`);
  return response.data;
}

export const explainabilityService = {
  getAiSessions,
  getAiSessionTimeline,
};

export default explainabilityService;
