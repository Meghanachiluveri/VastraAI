import { Router, Request, Response } from 'express';
import { optionalCustomerAuth } from '../middleware/customerAuthMiddleware';
import {
  confirmAgentCheckout,
  create_and_confirm_order,
  handleAgentMessage,
  prepareCheckout
} from '../services/agentService';
import {
  AgentMessageRequest,
  AgentMessageResponse,
  ConfirmCheckoutRequest,
  ConfirmCheckoutResponse,
  ErrorResponse,
  PrepareCheckoutResult
} from '../types';

const router = Router();

/**
 * POST /api/agent/message
 * Conversational endpoint for the Vastra.AI Shopping Agent powered by Anthropic Claude (claude-sonnet-5).
 */
router.post(
  '/message',
  optionalCustomerAuth,
  async (
    req: Request<{}, {}, AgentMessageRequest>,
    res: Response<AgentMessageResponse | ErrorResponse>
  ) => {
    try {
      const { message, sessionId, customerId, customerInfo, shippingAddress, selectedProductIds, selectedItems } = req.body;

      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({
          error: 'MESSAGE_REQUIRED',
          message: 'The message property must be a non-empty string.'
        });
        return;
      }

      const effectiveCustomerId = req.customer?.id || customerId;

      const response = await handleAgentMessage({
        message: message.trim(),
        sessionId: sessionId ? sessionId.trim() : null,
        customerId: effectiveCustomerId,
        customerInfo,
        shippingAddress,
        selectedProductIds,
        selectedItems
      });

      res.status(200).json(response);
    } catch (error: any) {
      console.error('[AgentRoutes] Error in POST /api/agent/message:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to process agent message'
      });
    }
  }
);

/**
 * POST /api/agent/checkout/prepare
 * Prepares and validates purchase summary for the current session cart.
 */
router.post(
  '/checkout/prepare',
  (req: Request, res: Response<PrepareCheckoutResult | ErrorResponse>) => {
    try {
      const { sessionId } = req.body;
      const result = prepareCheckout(sessionId || '');
      if (!result.ready) {
        res.status(400).json({
          error: result.error || 'CHECKOUT_PREPARATION_FAILED',
          message: result.message || 'Unable to prepare checkout'
        });
        return;
      }
      res.status(200).json(result);
    } catch (error: any) {
      console.error('[AgentRoutes] Error in POST /api/agent/checkout/prepare:', error);
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Failed to prepare checkout'
      });
    }
  }
);

/**
 * Common order confirmation handler with strict guardrail enforcement
 */
const handleOrderConfirmation = async (
  req: Request<{}, {}, ConfirmCheckoutRequest>,
  res: Response<ConfirmCheckoutResponse | ErrorResponse>
) => {
  try {
    const { sessionId, confirmed, customerInfo } = req.body;

    if (!confirmed) {
      res.status(400).json({
        error: 'CONFIRMATION_REQUIRED',
        message: 'Explicit user confirmation is required to create order and proceed to payment.'
      });
      return;
    }

    const effectiveCustomerId = req.customer?.id || req.body.customerId || customerInfo?.customerId || (sessionId?.startsWith('user_') ? sessionId : undefined);

    if (!effectiveCustomerId) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Customer must be logged in before an order can be created.'
      });
      return;
    }

    const mergedCustomerInfo = {
      ...(customerInfo || {}),
      customerId: effectiveCustomerId,
      name: customerInfo?.name || req.customer?.name,
      email: customerInfo?.email || req.customer?.email
    };

    const result = await create_and_confirm_order({
      sessionId: sessionId || '',
      confirmed: true,
      customerId: effectiveCustomerId,
      customerInfo: mergedCustomerInfo
    });

    res.status(200).json(result);
  } catch (error: any) {
    console.error('[AgentRoutes] Error in order confirmation:', error);
    const errMsg = error?.message || 'Failed to confirm checkout';

    if (errMsg === 'AUTHENTICATION_REQUIRED') {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'Please log in to your customer account before creating an order.'
      });
      return;
    }

    if (errMsg === 'SHIPPING_ADDRESS_REQUIRED') {
      res.status(400).json({
        error: 'SHIPPING_ADDRESS_REQUIRED',
        message: 'A valid delivery address is required before confirming the order.'
      });
      return;
    }

    if (errMsg === 'STALE_CHECKOUT') {
      res.status(400).json({
        error: 'STALE_CHECKOUT',
        message: 'Your cart was modified after preparing checkout. Please review the updated purchase summary.'
      });
      return;
    }

    if (errMsg === 'EMPTY_CART') {
      res.status(400).json({
        error: 'EMPTY_CART',
        message: 'Your shopping cart is empty.'
      });
      return;
    }

    res.status(400).json({
      error: 'CHECKOUT_FAILED',
      message: errMsg
    });
  }
};

/**
 * POST /api/agent/checkout/confirm
 * Human confirmation endpoint that creates the local order and Razorpay order.
 */
router.post('/checkout/confirm', optionalCustomerAuth, handleOrderConfirmation);

/**
 * POST /api/agent/create_and_confirm_order
 * Direct alias endpoint enforcing strict login, address, and confirmation guardrails.
 */
router.post('/create_and_confirm_order', optionalCustomerAuth, handleOrderConfirmation);

export default router;
