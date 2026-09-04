import { Request, Response, NextFunction } from 'express';
import { verifyMerchantToken, MerchantTokenPayload } from '../services/merchantAuthService';

// Extend Express Request interface to include merchant context
declare global {
  namespace Express {
    interface Request {
      merchant?: MerchantTokenPayload;
    }
  }
}

/**
 * Express middleware to protect merchant-only endpoints.
 * Requires a valid Authorization: Bearer <token> header with role = "merchant".
 */
export function requireMerchantAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Merchant authorization required. Please provide a valid Bearer token.'
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  const merchantPayload = verifyMerchantToken(token);

  if (!merchantPayload || merchantPayload.role !== 'merchant') {
    res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      message: 'Invalid, expired, or non-merchant authorization token.'
    });
    return;
  }

  // Attach verified merchant payload to request
  req.merchant = merchantPayload;
  next();
}
