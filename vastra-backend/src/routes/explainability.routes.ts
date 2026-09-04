import { Router, Request, Response } from 'express';
import { getAiSessions, getAiSessionTimeline } from '../services/explainabilityService';
import { requireMerchantAuth } from '../middleware/authMiddleware';
import { AiSessionDetail, AiSessionSummary, ErrorResponse } from '../types';

const router = Router();

// Apply requireMerchantAuth to all AI explainability/audit endpoints
router.use(requireMerchantAuth);

/**
 * GET /api/merchant/ai-sessions
 * Returns list of recent AI shopping sessions with multi-criteria filters.
 */
router.get('/', (req: Request, res: Response<{ sessions: AiSessionSummary[]; total: number } | ErrorResponse>) => {
  try {
    const range = (req.query.range as any) || 'all';
    const filter = (req.query.filter as any) || 'all';
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    const result = getAiSessions({ range, filter, limit });
    res.status(200).json(result);
  } catch (error: any) {
    console.error('[ExplainabilityRoutes] Error in GET /ai-sessions:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve AI sessions' });
  }
});

/**
 * GET /api/merchant/ai-sessions/:sessionId
 * Returns the chronological explainable timeline for a specific AI shopping session.
 */
router.get('/:sessionId', (req: Request, res: Response<AiSessionDetail | ErrorResponse>) => {
  try {
    const sessionId = String(req.params.sessionId || '');
    if (!sessionId) {
      res.status(400).json({ error: 'SESSION_ID_REQUIRED', message: 'Session ID is required' });
      return;
    }

    const detail = getAiSessionTimeline(sessionId);
    if (!detail) {
      res.status(404).json({ error: 'SESSION_NOT_FOUND', message: `AI session ${sessionId} not found` });
      return;
    }

    res.status(200).json(detail);
  } catch (error: any) {
    console.error('[ExplainabilityRoutes] Error in GET /ai-sessions/:sessionId:', error);
    res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Failed to retrieve AI session timeline' });
  }
});

export default router;
