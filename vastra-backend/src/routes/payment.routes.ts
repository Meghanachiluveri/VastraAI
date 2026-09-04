import { Router, Request, Response } from 'express';
import { cancelPayment, createRazorpayOrder, verifyPaymentSignature } from '../services/paymentService';
import {
  CancelPaymentRequest,
  CancelPaymentResponse,
  CreatePaymentOrderRequest,
  CreatePaymentOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResult,
  ErrorResponse
} from '../types';

const router = Router();

/**
 * POST /api/payments/create-order
 * Creates a Razorpay order in paise for an existing pending local order.
 */
router.post(
  '/create-order',
  async (
    req: Request<{}, {}, CreatePaymentOrderRequest>,
    res: Response<CreatePaymentOrderResponse | ErrorResponse>
  ) => {
    try {
      const { orderId, sessionId } = req.body;

      if (!orderId) {
        res.status(400).json({
          error: 'ORDER_ID_REQUIRED',
          message: 'orderId is required'
        });
        return;
      }

      const response = await createRazorpayOrder(orderId, sessionId);
      res.status(200).json(response);
    } catch (error: any) {
      console.error('[PaymentRoutes] Error in /create-order:', error);
      const msg = error?.message || 'Failed to create payment order';

      if (msg === 'ORDER_NOT_FOUND') {
        res.status(404).json({ error: 'ORDER_NOT_FOUND', message: 'Order not found' });
        return;
      }

      if (msg.startsWith('INVALID_ORDER_STATE')) {
        res.status(400).json({ error: 'INVALID_ORDER_STATE', message: msg });
        return;
      }

      res.status(500).json({ error: 'INTERNAL_ERROR', message: msg });
    }
  }
);

/**
 * POST /api/payments/verify
 * Cryptographically verifies Razorpay payment signature and marks order PAID.
 */
router.post(
  '/verify',
  (
    req: Request<{}, {}, VerifyPaymentRequest>,
    res: Response<VerifyPaymentResult | ErrorResponse>
  ) => {
    try {
      const result = verifyPaymentSignature(req.body);

      if (!result.success) {
        if ('error' in result && result.error === 'ORDER_NOT_FOUND') {
          res.status(404).json(result);
          return;
        }
        res.status(400).json(result);
        return;
      }

      res.status(200).json(result);
    } catch (error: any) {
      console.error('[PaymentRoutes] Error in /verify:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: error?.message || 'Payment verification failed'
      });
    }
  }
);

/**
 * POST /api/payments/cancel
 * Handles patron cancellation of payment modal and logs payment_cancelled.
 */
router.post(
  '/cancel',
  (
    req: Request<{}, {}, CancelPaymentRequest>,
    res: Response<CancelPaymentResponse | ErrorResponse>
  ) => {
    try {
      const { orderId, sessionId, reason } = req.body;
      if (!orderId) {
        res.status(400).json({
          error: 'ORDER_ID_REQUIRED',
          message: 'orderId is required'
        });
        return;
      }

      const result = cancelPayment({ orderId, sessionId, reason });
      res.status(200).json(result);
    } catch (error: any) {
      console.error('[PaymentRoutes] Error in /cancel:', error);
      res.status(400).json({
        error: error?.message || 'PAYMENT_CANCEL_FAILED',
        message: 'Could not cancel payment'
      });
    }
  }
);

export default router;

