import { Request, Response, NextFunction } from 'express';
import { verifyCustomerToken, CustomerTokenPayload } from '../services/customerAuthService';

// Extend Express Request interface to include customer context
declare global {
  namespace Express {
    interface Request {
      customer?: CustomerTokenPayload;
    }
  }
}

/**
 * Express middleware to protect customer endpoints (Orders, Addresses, Account Profile).
 * Requires a valid Authorization: Bearer <token> header with role = "customer".
 */
export function requireCustomerAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Customer authorization required. Please log in or register.'
    });
    return;
  }

  const token = authHeader.slice(7).trim();
  const customerPayload = verifyCustomerToken(token);

  if (!customerPayload) {
    res.status(401).json({
      success: false,
      error: 'UNAUTHORIZED',
      message: 'Your session has expired or is invalid. Please log in again.'
    });
    return;
  }

  req.customer = customerPayload;
  next();
}

/**
 * Optional customer authentication: populates req.customer if token is valid,
 * but allows unauthenticated access to continue.
 */
export function optionalCustomerAuth(req: Request, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    const customerPayload = verifyCustomerToken(token);
    if (customerPayload) {
      req.customer = customerPayload;
    }
  }
  next();
}
