import { Router, Request, Response } from 'express';
import {
  registerCustomer,
  loginCustomer,
  getCustomerById
} from '../services/customerAuthService';
import { requireCustomerAuth } from '../middleware/customerAuthMiddleware';

const router = Router();

/**
 * POST /api/auth/register
 * Registers a new customer and returns an access token.
 */
router.post('/register', (req: Request, res: Response) => {
  try {
    const { name, email, password, phone } = req.body;
    const result = registerCustomer({ name, email, password, phone });

    if (!result.success) {
      res.status(400).json(result);
      return;
    }

    res.status(201).json(result);
  } catch (error: any) {
    console.error('[AuthRoutes] Error in /register:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to register account' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates customer credentials and returns an access token.
 */
router.post('/login', (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = loginCustomer(email, password);

    if (!result.success) {
      res.status(401).json(result);
      return;
    }

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[AuthRoutes] Error in /login:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to authenticate' });
  }
});

/**
 * GET /api/auth/me
 * Retrieves profile for the authenticated customer.
 */
router.get('/me', requireCustomerAuth, (req: Request, res: Response) => {
  try {
    const customerId = req.customer!.id;
    const profile = getCustomerById(customerId);

    if (!profile) {
      res.status(404).json({ success: false, error: 'CUSTOMER_NOT_FOUND', message: 'Customer account not found' });
      return;
    }

    res.status(200).json({ success: true, customer: profile });
  } catch (error: any) {
    console.error('[AuthRoutes] Error in /me:', error);
    res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Failed to load profile' });
  }
});

export default router;
