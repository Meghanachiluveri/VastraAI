import {
  extractShoppingIntent,
  getComplementaryProduct,
  getProductById,
  getSimilarProducts,
  recommendProducts,
  searchProducts
} from './catalogService';
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCartQuantity
} from './cartService';
import { createOrder, validateOrder } from './orderService';
import { createRazorpayOrder } from './paymentService';
import { logAuditEvent } from './auditService';
import { db } from '../db/db';
import { getCustomerAddresses, addCustomerAddress } from './customerAuthService';
import {
  generateClaudeStylistResponse,
  isClaudeConfigured,
  CLAUDE_MODEL_NAME
} from './claudeService';
import {
  AgentMessageRequest,
  AgentMessageResponse,
  CartItemPayload,
  CartPayload,
  ConfirmCheckoutRequest,
  ConfirmCheckoutResponse,
  CuratedLook,
  OrderItemInput,
  PendingCheckoutState,
  PrepareCheckoutResult,
  Product,
  ProductFilters,
  ProductRecommendation,
  ShoppingContext,
  UpsellSuggestion,
  AISelectedItem
} from '../types';

// In-memory conversation session state
interface SessionState {
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
  shoppingContext: ShoppingContext;
  displayedProductIds: string[];
  lastProducts: Product[];
  selectedProductIds: string[];
  selectedItems: AISelectedItem[];
  lastMessage?: string;
  customerId?: string;
  customerInfo?: any;
  shippingAddress?: any;
  lastToolCall?: { name: string; params: any };
  lastToolResult?: any;
  createdAt: number;
}

const sessions = new Map<string, SessionState>();
const MAX_HISTORY_TURNS = 12; // Keep recent conversation turns to prevent context blowup

/**
 * Diagnostic logger required for AI Agent attribute and tool call verification.
 */
export function logAgentDiagnostic(stepData: {
  rawMessage: string;
  toolCall?: { name: string; params: any };
  toolResult?: any;
  finalReply: string;
}): void {
  console.log('\n' + '='.repeat(80));
  console.log('[AGENT DIAGNOSTIC] Step 1: Raw User Message:');
  console.log(stepData.rawMessage);
  console.log('-'.repeat(80));
  console.log('[AGENT DIAGNOSTIC] Step 2: Tool Call Generated:');
  if (stepData.toolCall) {
    console.log(`Function: ${stepData.toolCall.name}`);
    console.log(`Parameters: ${JSON.stringify(stepData.toolCall.params, null, 2)}`);
  } else {
    console.log('None (Direct response or no tool call needed)');
  }
  console.log('-'.repeat(80));
  console.log('[AGENT DIAGNOSTIC] Step 3: Tool Execution Result:');
  if (stepData.toolResult) {
    if (Array.isArray(stepData.toolResult.products)) {
      console.log(`Found: ${stepData.toolResult.products.length} product(s)`);
      stepData.toolResult.products.forEach((p: any, idx: number) => {
        console.log(`  ${idx + 1}. [${p.id}] ${p.name} | Cat: ${p.category} | Colors: ${JSON.stringify(p.colors)} | Price: ₹${p.price} | Stock: ${p.stock}`);
      });
    } else {
      console.log(JSON.stringify(stepData.toolResult, null, 2));
    }
  } else {
    console.log('None');
  }
  console.log('-'.repeat(80));
  console.log('[AGENT DIAGNOSTIC] Step 4: Final Natural-Language Reply:');
  console.log(stepData.finalReply);
  console.log('='.repeat(80) + '\n');
}

/**
 * Gets or initializes a session state.
 */
export function getOrCreateSession(sessionId: string): SessionState {
  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, {
      history: [],
      shoppingContext: {},
      displayedProductIds: [],
      lastProducts: [],
      selectedProductIds: [],
      selectedItems: [],
      createdAt: Date.now()
    });
  }
  const s = sessions.get(sessionId)!;
  if (!s.selectedProductIds) s.selectedProductIds = [];
  if (!s.selectedItems) s.selectedItems = [];
  return s;
}

/**
 * Computes a deterministic hash representation of cart contents for stale checkout detection.
 */
function computeCartHash(items: Array<{ productId: string; quantity: number; size?: string | null; color?: string | null }>): string {
  return items
    .map((i) => `${i.productId}:${i.quantity}:${i.size || ''}:${i.color || ''}`)
    .sort()
    .join('|');
}

/**
 * Prepares and validates a purchase summary for the current session cart.
 * Rechecks live catalog stock, detects live catalog price changes,
 * enforces spending limits (₹10,000), and creates a short-lived checkout state.
 */
export function prepareCheckout(sessionId: string): PrepareCheckoutResult {
  const cleanSessionId = sessionId && sessionId.trim().length > 0 ? sessionId.trim() : 'anonymous_session';
  const session = getOrCreateSession(cleanSessionId);

  const cart = getCart(cleanSessionId, 'agent');
  if (cart.items.length === 0) {
    return {
      ready: false,
      error: 'EMPTY_CART',
      message: 'Your shopping bag is currently empty.'
    };
  }

  // Check for catalog price changes
  if (cart.priceChange && cart.priceChange.priceChanged) {
    session.shoppingContext.pendingCheckoutState = undefined;
    return {
      ready: false,
      requiresConfirmation: true,
      priceChange: cart.priceChange,
      message: `The price for **${cart.priceChange.productName}** has changed from ₹${cart.priceChange.previousPrice.toLocaleString('en-IN')} to ₹${cart.priceChange.currentPrice.toLocaleString('en-IN')}. Would you like to continue with the updated price?`
    };
  }

  const orderItems: OrderItemInput[] = cart.items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    size: i.size,
    color: i.color
  }));

  const validation = validateOrder({
    channel: 'agent',
    sessionId: cleanSessionId,
    items: orderItems
  });

  if (!validation.valid) {
    session.shoppingContext.pendingCheckoutState = undefined;

    if (validation.reason === 'INSUFFICIENT_STOCK') {
      logAuditEvent({
        sessionId: cleanSessionId,
        channel: 'agent',
        action: 'stock_failure',
        details: { reason: 'INSUFFICIENT_STOCK', items: orderItems },
        outcome: 'failure'
      });

      return {
        ready: false,
        error: 'INSUFFICIENT_STOCK',
        message: 'That item is no longer available in the requested quantity. Would you like me to find something similar?'
      };
    }

    return {
      ready: false,
      error: validation.reason,
      message: validation.error
    };
  }

  const itemsHash = computeCartHash(cart.items);
  const checkoutState: PendingCheckoutState = {
    sessionId: cleanSessionId,
    items: validation.items || [],
    totalAmount: validation.total || 0,
    currency: validation.currency || 'INR',
    requiresConfirmation: Boolean(validation.requiresConfirmation),
    createdAt: Date.now(),
    itemsHash
  };

  session.shoppingContext.pendingCheckoutState = checkoutState;
  session.shoppingContext.isAiCheckout = true;

  // Log gating_check audit event
  logAuditEvent({
    sessionId: cleanSessionId,
    channel: 'agent',
    action: 'gating_check',
    details: {
      itemCount: cart.items.length,
      totalAmount: validation.total,
      requiresConfirmation: validation.requiresConfirmation,
      itemsHash
    },
    outcome: 'success'
  });

  return {
    ready: true,
    requiresConfirmation: true,
    currency: validation.currency || 'INR',
    totalAmount: validation.total,
    items: validation.items,
    message: `Your order for ${cart.itemCount} piece(s) (Total: ₹${(validation.total || 0).toLocaleString('en-IN')}) is prepared.`
  };
}

/**
 * Authoritatively determines if a given session is in an active AI-originated checkout flow.
 */
export function isAiCheckoutSession(sessionId: string): boolean {
  if (!sessionId) return false;
  const cleanSessionId = sessionId.trim();
  const session = getOrCreateSession(cleanSessionId);
  return Boolean(session?.shoppingContext?.pendingCheckoutState || session?.shoppingContext?.isAiCheckout);
}

/**
 * Clears any pending AI checkout state from the session.
 */
export function clearAiCheckoutSession(sessionId: string): void {
  if (!sessionId) return;
  const cleanSessionId = sessionId.trim();
  const session = getOrCreateSession(cleanSessionId);
  if (session?.shoppingContext) {
    session.shoppingContext.isAiCheckout = false;
    session.shoppingContext.pendingCheckoutState = undefined;
  }
}

/**
 * Confirms an AI checkout after explicit user confirmation.
 * Revalidates the cart against real-time stock, verified prices, and spending limits,
 * strictly enforces customer authentication and valid delivery address,
 * includes idempotency protection against duplicate confirmation,
 * creates the local order, and generates the Razorpay order for frontend payment.
 */
export async function create_and_confirm_order(req: ConfirmCheckoutRequest): Promise<ConfirmCheckoutResponse> {
  const cleanSessionId = req.sessionId && req.sessionId.trim().length > 0 ? req.sessionId.trim() : 'anonymous_session';
  const session = getOrCreateSession(cleanSessionId);

  // Guardrail 1: Explicit UI Confirmation Required
  if (!req.confirmed) {
    throw new Error('CONFIRMATION_REQUIRED');
  }

  // Guardrail 2: Customer Authentication: Must be logged in
  const effectiveCustomerId = req.customerId || req.customerInfo?.customerId || session.customerId;
  if (!effectiveCustomerId) {
    throw new Error('AUTHENTICATION_REQUIRED');
  }

  // Verify customer exists in database
  const customer = db.prepare('SELECT id, name, email, phone FROM customers WHERE id = ?').get(effectiveCustomerId) as any;
  if (!customer) {
    throw new Error('AUTHENTICATION_REQUIRED');
  }

  // Guardrail 3: Valid Shipping Address Required
  const shippingAddr = req.customerInfo?.address || (req.customerInfo as any)?.shippingAddress || session.shippingAddress?.addressLine;
  const shippingCity = req.customerInfo?.city || (req.customerInfo as any)?.shippingCity || session.shippingAddress?.city;
  const shippingPostalCode = req.customerInfo?.postalCode || (req.customerInfo as any)?.shippingPostalCode || session.shippingAddress?.postalCode;

  if (!shippingAddr || !shippingCity || !shippingPostalCode) {
    throw new Error('SHIPPING_ADDRESS_REQUIRED');
  }

  const pendingState = session.shoppingContext.pendingCheckoutState;

  // Idempotency: If this exact confirmed state already generated an order, return existing order
  if (pendingState && pendingState.orderId && pendingState.razorpayOrderId) {
    return {
      success: true,
      orderId: pendingState.orderId,
      razorpayOrderId: pendingState.razorpayOrderId,
      amount: pendingState.razorpayAmount || Math.round(pendingState.totalAmount * 100),
      currency: pendingState.currency || 'INR',
      keyId: pendingState.razorpayKeyId || 'rzp_test_vastra_dev',
      items: pendingState.items,
      totalAmount: pendingState.totalAmount
    };
  }

  const currentCart = getCart(cleanSessionId, 'agent');
  if (currentCart.items.length === 0) {
    throw new Error('EMPTY_CART');
  }

  // Stale checkout protection: check pending state
  const currentHash = computeCartHash(currentCart.items);

  if (!pendingState || pendingState.itemsHash !== currentHash) {
    session.shoppingContext.pendingCheckoutState = undefined;
    logAuditEvent({
      sessionId: cleanSessionId,
      channel: 'agent',
      action: 'checkout_invalidated',
      details: {
        reason: 'Cart contents or prices changed after preparing checkout',
        previousHash: pendingState?.itemsHash,
        currentHash
      },
      outcome: 'failure'
    });
    throw new Error('STALE_CHECKOUT');
  }

  const orderItems: OrderItemInput[] = currentCart.items.map((i) => ({
    productId: i.productId,
    quantity: i.quantity,
    size: i.size,
    color: i.color
  }));

  // Revalidate order
  const validation = validateOrder({
    channel: 'agent',
    sessionId: cleanSessionId,
    items: orderItems
  });

  if (!validation.valid) {
    session.shoppingContext.pendingCheckoutState = undefined;
    if (validation.reason === 'INSUFFICIENT_STOCK') {
      logAuditEvent({
        sessionId: cleanSessionId,
        channel: 'agent',
        action: 'stock_failure',
        details: { reason: 'INSUFFICIENT_STOCK', items: orderItems },
        outcome: 'failure'
      });
    }
    throw new Error(validation.reason || 'ORDER_VALIDATION_FAILED');
  }

  const mergedCustomerInfo = {
    customerId: effectiveCustomerId,
    name: req.customerInfo?.name || session.shippingAddress?.name || customer.name,
    email: req.customerInfo?.email || customer.email,
    phone: req.customerInfo?.phone || session.shippingAddress?.phone || customer.phone,
    address: shippingAddr,
    city: shippingCity,
    state: req.customerInfo?.state || (req.customerInfo as any)?.shippingState || session.shippingAddress?.state || 'Karnataka',
    postalCode: shippingPostalCode
  };

  // Create Local Order
  const createRes = createOrder({
    channel: 'agent',
    sessionId: cleanSessionId,
    customerId: effectiveCustomerId,
    items: orderItems,
    confirmed: true,
    customerInfo: mergedCustomerInfo
  });

  if (!createRes.success) {
    throw new Error(createRes.error || 'ORDER_CREATION_FAILED');
  }

  const localOrderId = createRes.order.id;

  // Create Razorpay Order
  const rzpRes = await createRazorpayOrder(localOrderId, cleanSessionId);

  // Store in pendingState for idempotency
  pendingState.orderId = localOrderId;
  pendingState.razorpayOrderId = rzpRes.razorpayOrderId;
  pendingState.razorpayAmount = rzpRes.amount;
  pendingState.razorpayKeyId = rzpRes.key;

  return {
    success: true,
    orderId: localOrderId,
    razorpayOrderId: rzpRes.razorpayOrderId,
    amount: rzpRes.amount,
    currency: rzpRes.currency,
    keyId: rzpRes.key,
    items: createRes.order.items || validation.items || [],
    totalAmount: createRes.order.totalAmount
  };
}

export const confirmAgentCheckout = create_and_confirm_order;
export const createAndConfirmOrder = create_and_confirm_order;

/**
 * Logs structured refinement audit events by diffing previous and updated shopping context.
 */
function logRefinementAudit(
  sessionId: string,
  prevContext: ShoppingContext,
  updatedContext: ShoppingContext
): void {
  const prevSnapshot: Record<string, any> = {};
  const updatedSnapshot: Record<string, any> = {};

  const trackedKeys: (keyof ShoppingContext)[] = [
    'query',
    'category',
    'gender',
    'minPrice',
    'maxPrice',
    'size',
    'color',
    'occasion'
  ];

  let hasDiff = false;
  for (const k of trackedKeys) {
    const pVal = prevContext[k];
    const uVal = updatedContext[k];

    if (pVal !== undefined || uVal !== undefined) {
      if (pVal !== uVal) {
        hasDiff = true;
      }
      if (pVal !== undefined) prevSnapshot[k] = pVal;
      if (uVal !== undefined) updatedSnapshot[k] = uVal;
    }
  }

  if (hasDiff) {
    logAuditEvent({
      sessionId,
      channel: 'agent',
      action: 'refine',
      details: {
        previous: prevSnapshot,
        updated: updatedSnapshot
      },
      outcome: 'success'
    });
  }
}



/**
 * Executes a tool called by the agent and captures audit events.
 */
function executeTool(
  name: string,
  args: any,
  session: SessionState,
  sessionId: string,
  collectedProducts: Product[],
  collectedActions: string[]
): {
  result: any;
  productsFound?: Product[];
  recommendation?: ProductRecommendation;
  upsell?: UpsellSuggestion;
  cart?: CartPayload;
  checkout?: PrepareCheckoutResult;
} {
  collectedActions.push(name);
  session.lastToolCall = { name, params: args };

  try {
    switch (name) {
      case 'prepare_checkout': {
        const checkoutRes = prepareCheckout(sessionId);
        return {
          result: checkoutRes,
          checkout: checkoutRes,
          cart: getCart(sessionId, 'agent')
        };
      }

      case 'get_cart': {
        const cart = getCart(sessionId, 'agent', true);
        return {
          result: cart,
          cart
        };
      }

      case 'add_to_cart': {
        session.shoppingContext.pendingCheckoutState = undefined; // invalidate stale checkout
        const addRes = addToCart({
          sessionId,
          productId: args.productId,
          quantity: args.quantity ? Number(args.quantity) : 1,
          size: args.size,
          color: args.color,
          channel: 'agent'
        });

        if (addRes.addedItem) {
          const prod = getProductById(args.productId);
          if (prod && !collectedProducts.some((p) => p.id === prod.id)) {
            collectedProducts.push(prod);
          }
        }

        return {
          result: addRes,
          cart: addRes.cart
        };
      }

      case 'remove_from_cart': {
        session.shoppingContext.pendingCheckoutState = undefined; // invalidate stale checkout
        const removeRes = removeFromCart(sessionId, args.productId, 'agent');
        return {
          result: removeRes,
          cart: removeRes.cart
        };
      }

      case 'update_cart_quantity': {
        session.shoppingContext.pendingCheckoutState = undefined; // invalidate stale checkout
        const updateRes = updateCartQuantity(sessionId, args.productId, Number(args.quantity || 1), 'agent');
        return {
          result: updateRes,
          cart: updateRes.cart
        };
      }

      case 'clear_cart': {
        session.shoppingContext.pendingCheckoutState = undefined; // invalidate stale checkout
        if (args.confirmed !== true) {
          return {
            result: { error: 'CONFIRMATION_REQUIRED', message: 'Explicit user confirmation is required before clearing the cart.' }
          };
        }
        const clearRes = clearCart(sessionId, 'agent');
        return {
          result: clearRes,
          cart: clearRes.cart
        };
      }

      case 'recommend_products': {
        const isFreshQuery = Boolean(args.query && args.query.trim().length > 0);
        const criteria = {
          query: args.query !== undefined ? args.query : session.shoppingContext.query,
          category: args.category !== undefined ? args.category : (isFreshQuery ? undefined : session.shoppingContext.category),
          gender: args.gender !== undefined ? args.gender : (isFreshQuery ? undefined : session.shoppingContext.gender),
          minPrice: args.minPrice !== undefined ? Number(args.minPrice) : (isFreshQuery ? undefined : session.shoppingContext.minPrice),
          maxPrice: args.maxPrice !== undefined ? Number(args.maxPrice) : (isFreshQuery ? undefined : session.shoppingContext.maxPrice),
          size: args.size !== undefined ? args.size : (isFreshQuery ? undefined : session.shoppingContext.size),
          color: args.color !== undefined ? args.color : (isFreshQuery ? undefined : session.shoppingContext.color),
          occasion: args.occasion !== undefined ? args.occasion : (isFreshQuery ? undefined : session.shoppingContext.occasion)
        };

        const recResult = recommendProducts(criteria);
        const found = recResult.products;

        const prevContext = { ...session.shoppingContext };
        const updatedContext: ShoppingContext = {
          ...session.shoppingContext,
          ...criteria,
          recentProductIds: found.map((p) => p.id),
          lastSearchResults: found,
          activeRecommendation: recResult.topRecommendation,
          lastUpdated: Date.now()
        };

        const hasPriorContext = Boolean(
          prevContext.category ||
          prevContext.gender ||
          prevContext.maxPrice !== undefined ||
          prevContext.color ||
          prevContext.size ||
          prevContext.query
        );

        if (hasPriorContext) {
          logRefinementAudit(sessionId, prevContext, updatedContext);
        }

        session.shoppingContext = updatedContext;
        session.lastProducts = found;

        // Log search event
        logAuditEvent({
          sessionId,
          channel: 'agent',
          action: 'search',
          details: {
            query: criteria.query || criteria.category || 'Luxury pieces',
            category: criteria.category,
            gender: criteria.gender,
            maxPrice: criteria.maxPrice,
            resultsCount: found.length
          },
          outcome: 'success'
        });

        if (recResult.topRecommendation) {
          logAuditEvent({
            sessionId,
            channel: 'agent',
            action: 'recommendation',
            details: {
              productId: recResult.topRecommendation.productId,
              productName: recResult.topRecommendation.productName,
              price: recResult.topRecommendation.price,
              rating: recResult.topRecommendation.rating,
              reason: recResult.topRecommendation.reason
            },
            outcome: 'success'
          });
        }

        for (const prod of found.slice(0, 3)) {
          logAuditEvent({
            sessionId,
            channel: 'agent',
            action: 'propose',
            details: {
              productId: prod.id,
              productName: prod.name,
              price: prod.price
            },
            outcome: 'success'
          });
        }

        found.forEach((p) => {
          if (!collectedProducts.some((cp) => cp.id === p.id)) {
            collectedProducts.push(p);
          }
        });

        return {
          result: {
            count: found.length,
            topRecommendation: recResult.topRecommendation,
            products: found
          },
          productsFound: found,
          recommendation: recResult.topRecommendation
        };
      }

      case 'suggest_upsell': {
        if (session.shoppingContext.upsellDeclined) {
          return { result: { message: 'Upsell previously declined by user' } };
        }

        const comp = getComplementaryProduct(args.productId);
        if (comp) {
          const upsell: UpsellSuggestion = {
            productId: comp.id,
            productName: comp.name,
            price: comp.price,
            targetProductId: args.productId,
            message: `Would you like to complete the look with the **${comp.name}** for ₹${comp.price.toLocaleString('en-IN')}?`,
            requiresConfirmation: true,
            status: 'suggested'
          };

          session.shoppingContext.upsellSuggestion = upsell;

          logAuditEvent({
            sessionId,
            channel: 'agent',
            action: 'upsell_suggested',
            details: {
              productId: comp.id,
              productName: comp.name,
              price: comp.price,
              targetProductId: args.productId,
              reason: `Pairs with selected item ${args.productId}`
            },
            outcome: 'success'
          });

          if (!collectedProducts.some((cp) => cp.id === comp.id)) {
            collectedProducts.push(comp);
          }

          return {
            result: { upsell, product: comp },
            productsFound: [comp],
            upsell
          };
        }

        return { result: { message: 'No suitable complementary product found' } };
      }

      case 'search_products': {
        const filters: ProductFilters = {
          gender: args.gender !== undefined ? args.gender : session.shoppingContext.gender,
          category: args.category !== undefined ? args.category : session.shoppingContext.category,
          minPrice: args.minPrice !== undefined ? Number(args.minPrice) : session.shoppingContext.minPrice,
          maxPrice: args.maxPrice !== undefined ? Number(args.maxPrice) : session.shoppingContext.maxPrice,
          size: args.size !== undefined ? args.size : session.shoppingContext.size,
          color: args.color !== undefined ? args.color : session.shoppingContext.color,
          occasion: args.occasion !== undefined ? args.occasion : session.shoppingContext.occasion,
          sort: args.sort
        };

        const query = args.query !== undefined ? args.query : '';
        const recResult = recommendProducts({
          query: query || undefined,
          category: filters.category,
          gender: filters.gender,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          size: filters.size,
          color: filters.color,
          occasion: filters.occasion,
          limit: 4
        });
        const found = recResult.products;

        const prevContext = { ...session.shoppingContext };
        const updatedContext: ShoppingContext = {
          ...session.shoppingContext,
          query: query || session.shoppingContext.query,
          category: filters.category,
          gender: filters.gender,
          minPrice: filters.minPrice,
          maxPrice: filters.maxPrice,
          size: filters.size,
          color: filters.color,
          occasion: filters.occasion,
          recentProductIds: found.map((p) => p.id),
          lastSearchResults: found,
          activeRecommendation: recResult.topRecommendation,
          lastUpdated: Date.now()
        };

        const hasPriorContext = Boolean(
          prevContext.category ||
          prevContext.gender ||
          prevContext.maxPrice !== undefined ||
          prevContext.color ||
          prevContext.size ||
          prevContext.query
        );

        if (hasPriorContext) {
          logRefinementAudit(sessionId, prevContext, updatedContext);
        }

        session.shoppingContext = updatedContext;
        session.lastProducts = found;

        logAuditEvent({
          sessionId,
          channel: 'agent',
          action: 'search',
          details: { query, filters, resultCount: found.length },
          outcome: 'success'
        });

        for (const prod of found.slice(0, 3)) {
          logAuditEvent({
            sessionId,
            channel: 'agent',
            action: 'propose',
            details: { productId: prod.id, productName: prod.name, price: prod.price },
            outcome: 'success'
          });
        }

        found.forEach((p) => {
          if (!collectedProducts.some((cp) => cp.id === p.id)) {
            collectedProducts.push(p);
          }
        });

        const toolResObj = {
          count: found.length,
          topRecommendation: recResult.topRecommendation,
          products: found
        };
        session.lastToolResult = toolResObj;

        return {
          result: toolResObj,
          productsFound: found,
          recommendation: recResult.topRecommendation
        };
      }

      case 'check_size': {
        const prod = getProductById(args.productId);
        const targetSize = (args.size || 'M').toUpperCase();
        const available = prod ? (prod.sizes.some((s) => s.toUpperCase() === targetSize) || prod.sizes.includes('Free Size') || prod.sizes.includes('One Size')) : false;
        const resObj = {
          productId: args.productId,
          productName: args.productName || prod?.name,
          size: targetSize,
          available,
          stock: prod?.stock || 0,
          availableSizes: prod?.sizes || []
        };
        session.lastToolResult = resObj;
        return {
          result: resObj,
          productsFound: prod ? [prod] : []
        };
      }

      case 'get_product': {
        const prod = getProductById(args.productId);
        if (prod) {
          if (!collectedProducts.some((cp) => cp.id === prod.id)) {
            collectedProducts.push(prod);
          }
          const existingIds = session.shoppingContext.recentProductIds || [];
          session.shoppingContext.recentProductIds = [prod.id, ...existingIds.filter((id) => id !== prod.id)];
          session.shoppingContext.activeProductId = prod.id;
          session.lastProducts = [prod, ...session.lastProducts.filter((p) => p.id !== prod.id)];
        }

        return {
          result: prod || { error: 'PRODUCT_NOT_FOUND', message: 'That item is no longer available in our catalog. I can find you a similar option.' }
        };
      }

      case 'get_similar_products': {
        const similar = getSimilarProducts(args.productId);
        similar.forEach((p) => {
          if (!collectedProducts.some((cp) => cp.id === p.id)) {
            collectedProducts.push(p);
          }
        });

        session.lastProducts = similar;
        session.shoppingContext.recentProductIds = similar.map((p) => p.id);
        session.shoppingContext.lastSearchResults = similar;

        return {
          result: { count: similar.length, products: similar }
        };
      }

      case 'validate_order': {
        const validation = validateOrder({
          channel: 'agent',
          items: args.items as OrderItemInput[],
          sessionId
        });
        return {
          result: validation
        };
      }

      default:
        return { result: { error: `Unknown tool: ${name}` } };
    }
  } catch (toolError: any) {
    logAuditEvent({
      sessionId,
      channel: 'agent',
      action: 'tool_failure',
      details: { toolName: name, args, error: toolError?.message || 'Tool execution error' },
      outcome: 'failure'
    });
    return { result: { error: 'TOOL_EXECUTION_ERROR', message: 'Action could not be completed.' } };
  }
}

/**
 * Generates an articulate, grounded reason for recommending a piece.
 */
function generateProductMatchReason(product: Product, context?: ShoppingContext, userQuery?: string): string {
  const query = (userQuery || context?.query || '').toLowerCase();

  if (query.includes('wedding') || context?.occasion?.toLowerCase().includes('wedding')) {
    if (product.category === 'contemporary ethnic wear' || product.category === 'sarees' || product.category === 'kurtas') {
      return `Master handwoven motifs and luxurious heritage drape make this an exquisite centerpiece for wedding ceremonies.`;
    }
    if (product.category === 'jackets') {
      return `Its structured raw silk silhouette and bandh collar bring refined regal poise to celebratory gatherings.`;
    }
  }

  if (query.includes('linen') || query.includes('summer') || query.includes('breathable') || query.includes('vacation')) {
    return `Woven from breathable organic yarns with a relaxed drape, providing effortless comfort in warm climates.`;
  }

  if (query.includes('formal') || query.includes('black formal') || query.includes('evening') || query.includes('office')) {
    if (product.category === 'dresses') {
      return `Tailored with architectural lines and subtle volume, ideal for sophisticated evening and gala gatherings.`;
    }
    if (product.category === 'jackets' || product.category === 'formal shirts') {
      return `Impeccable bespoke sartorial structure tailored from high-grade fine wool and crisp handloom cotton.`;
    }
  }

  if (product.category === 'dresses') {
    return `Flowing artisanal silhouette with certified organic cotton poplin, smocked detailing, and hidden pocket construction.`;
  }
  if (product.category === 'jackets') {
    return `Structured luxury outerwear cut with precision tailoring and handcrafted tortoiseshell hardware.`;
  }
  if (product.category === 'sarees') {
    return `Certified Varanasi master artisan weave with metallic gold zari borders and genuine handloom provenance.`;
  }
  if (product.category === 'contemporary ethnic wear' || product.category === 'kurtas') {
    return `Tailored in natural silk and khadi with delicate micro-pleat front detailing and a fluid silhouette.`;
  }
  if (product.category === 'shirts' || product.category === 'tops') {
    return `Crafted from pure natural fibers with clean French seams and an elevated drape.`;
  }
  if (product.category === 'tote bags' || product.category === 'accessories') {
    return `Full-grain vegetable-tanned leather and solid brass hardware designed to age gracefully over time.`;
  }

  return `Handcrafted luxury piece rated ${product.rating}★ across verified patrons, meeting Vastra's artisanal standards.`;
}

/**
 * Curates a 2-piece complete look strictly within budget and <= ₹10,000 guardrail.
 */
function curateCompleteLookOutfit(
  occasion: string,
  budget: number = 8000,
  genderPreference?: string
): CuratedLook | null {
  const safeMaxBudget = Math.min(budget, 10000); // Strict ₹10k guardrail

  // Candidate main garments
  let mainCandidates: Product[] = [];
  if (genderPreference === 'men') {
    mainCandidates = searchProducts('', { gender: 'men' }).filter((p) => p.price < safeMaxBudget - 1500);
  } else if (genderPreference === 'women') {
    mainCandidates = searchProducts('', { gender: 'women' }).filter((p) => p.price < safeMaxBudget - 1500);
  } else {
    mainCandidates = searchProducts('').filter((p) => p.price < safeMaxBudget - 1500 && (p.category === 'dresses' || p.category === 'contemporary ethnic wear' || p.category === 'kurtas' || p.category === 'jackets'));
  }

  // Accessories candidates
  const accessories = searchProducts('', { category: 'accessories' });
  const stoles = searchProducts('stole');
  const belts = searchProducts('belt');
  const bags = searchProducts('', { category: 'tote bags' });
  const allComps = [...accessories, ...stoles, ...belts, ...bags];

  for (const main of mainCandidates) {
    const remainingBudget = safeMaxBudget - main.price;
    const suitableComp = allComps.find((c) => c.id !== main.id && c.price <= remainingBudget);

    if (suitableComp) {
      const total = main.price + suitableComp.price;
      return {
        title: `Curated ${occasion || 'Atelier'} Look`,
        description: `Paired the **${main.name}** with the **${suitableComp.name}** for a cohesive, handcrafted ensemble.`,
        occasion: occasion || 'Celebration',
        mainItem: {
          productId: main.id,
          name: main.name,
          price: main.price,
          category: main.category,
          imageUrl: main.imageUrl,
          size: main.sizes[0] || 'M',
          color: main.colors[0] || 'Default'
        },
        complementaryItem: {
          productId: suitableComp.id,
          name: suitableComp.name,
          price: suitableComp.price,
          category: suitableComp.category,
          imageUrl: suitableComp.imageUrl,
          size: suitableComp.sizes[0] || 'Free Size',
          color: suitableComp.colors[0] || 'Default'
        },
        totalPrice: total,
        guardrailCompliant: total <= 10000
      };
    }
  }

  return null;
}

/**
 * Intelligent deterministic concierge with complete failure handling & recovery.
 */
function handleDeterministicConcierge(
  userMessage: string,
  session: SessionState,
  sessionId: string
): AgentMessageResponse {
  const lowerMsg = userMessage.toLowerCase().trim();
  const collectedProducts: Product[] = [];
  const actions: string[] = [];

  const intent = extractShoppingIntent(userMessage, session.shoppingContext);

  // 1. Impossible / Nonexistent Item Grounding
  if (intent.isImpossibleItem) {
    return {
      sessionId,
      message: `I couldn't find that item in the Vastra.AI collection. We specialize exclusively in handcrafted Indian luxury garments—such as handloom raw silk bandhgalas, wild Tussar co-ord sets, Chanderi sarees, and Belgian linen shirts.`,
      products: [],
      actions: [],
      context: session.shoppingContext,
      cart: getCart(sessionId, 'agent'),
      statusIndicator: 'ready'
    };
  }

  // 2. View / Inspect Bag
  if (intent.action === 'view_cart') {
    const currentCart = getCart(sessionId, 'agent');
    if (currentCart.items.length === 0) {
      return {
        sessionId,
        message: "Your shopping bag is currently empty. May I help curate a look for an upcoming occasion?",
        products: [],
        actions: ['get_cart'],
        context: session.shoppingContext,
        cart: currentCart,
        statusIndicator: 'ready'
      };
    }

    const itemsSummary = currentCart.items
      .map((it, idx) => `${idx + 1}. **${it.name}** (Qty: ${it.quantity}, Size: ${it.size || 'M'}) — ₹${(it.price * it.quantity).toLocaleString('en-IN')}`)
      .join('\n');

    return {
      sessionId,
      message: `Here is your current selection (${currentCart.itemCount} piece(s)):\n\n${itemsSummary}\n\n**Total:** ₹${currentCart.total.toLocaleString('en-IN')}`,
      products: currentCart.items.map((it) => getProductById(it.productId)!).filter(Boolean),
      actions: ['get_cart'],
      context: session.shoppingContext,
      cart: currentCart,
      statusIndicator: 'ready'
    };
  }

  // 3. Clear Cart Request & Confirmation
  if (intent.action === 'clear_cart') {
    const currentCart = getCart(sessionId, 'agent');
    if (currentCart.items.length === 0) {
      return {
        sessionId,
        message: "Your shopping bag is already empty.",
        products: [],
        actions: ['get_cart'],
        context: session.shoppingContext,
        cart: currentCart
      };
    }

    session.shoppingContext.pendingClearCartConfirmation = true;
    return {
      sessionId,
      message: `Your cart currently has ${currentCart.itemCount} item(s) (Total: ₹${currentCart.total.toLocaleString('en-IN')}). Are you sure you want to remove everything?`,
      products: [],
      actions: ['get_cart'],
      context: session.shoppingContext,
      cart: currentCart
    };
  }

  if (session.shoppingContext.pendingClearCartConfirmation) {
    if (lowerMsg === 'yes' || lowerMsg.startsWith('yes') || lowerMsg.includes('clear it') || lowerMsg.includes('confirm') || lowerMsg.includes('sure')) {
      session.shoppingContext.pendingClearCartConfirmation = false;
      const clearRes = clearCart(sessionId, 'agent');
      actions.push('clear_cart');
      return {
        sessionId,
        message: "Your shopping bag has been cleared.",
        products: [],
        actions,
        context: session.shoppingContext,
        cart: clearRes.cart
      };
    } else {
      session.shoppingContext.pendingClearCartConfirmation = false;
      const currentCart = getCart(sessionId, 'agent');
      return {
        sessionId,
        message: "No problem at all. I kept all items in your shopping bag.",
        products: [],
        actions: [],
        context: session.shoppingContext,
        cart: currentCart
      };
    }
  }

  // 4. Remove Item from Bag
  if (intent.action === 'remove_from_cart') {
    const currentCart = getCart(sessionId, 'agent');
    if (currentCart.items.length === 0) {
      return {
        sessionId,
        message: "Your bag is currently empty, so there are no items to remove.",
        products: [],
        actions: ['remove_from_cart'],
        context: session.shoppingContext,
        cart: currentCart,
        statusIndicator: 'ready'
      };
    }

    const itemQuery = lowerMsg.replace(/^(?:please\s+)?(?:remove|delete|drop)\s+(?:the\s+)?/i, '').trim();
    let matchingItem = currentCart.items.find((it) =>
      it.name.toLowerCase().includes(itemQuery) ||
      it.productId.toLowerCase() === itemQuery ||
      itemQuery.includes(it.name.toLowerCase())
    );

    if (!matchingItem) {
      const keywords = ['shirt', 'kurta', 'dress', 'jacket', 'belt', 'saree', 'jeans', 'tote', 'shoes', 'sneakers', 'sandals', 'scarf', 'shawl', 'wallet', 'cardholder'];
      const foundKw = keywords.find((k) => itemQuery.includes(k));
      if (foundKw) {
        matchingItem = currentCart.items.find((it) => it.name.toLowerCase().includes(foundKw));
      }
    }

    if (!matchingItem) {
      matchingItem = currentCart.items[0];
    }

    if (matchingItem) {
      removeFromCart(sessionId, matchingItem.id, 'agent');
      const updatedCart = getCart(sessionId, 'agent');
      return {
        sessionId,
        message: `I've removed the **${matchingItem.name}** from your shopping bag. Bag Total: ₹${updatedCart.total.toLocaleString('en-IN')} (${updatedCart.itemCount} piece(s)).`,
        products: [],
        actions: ['remove_from_cart'],
        context: session.shoppingContext,
        cart: updatedCart,
        statusIndicator: 'updating_bag'
      };
    }
  }

  // 5. Update Quantity
  if (intent.action === 'update_quantity') {
    const qtyMatch = lowerMsg.match(/(?:quantity|qty|to)\s*(\d+)/i);
    const targetQty = qtyMatch ? parseInt(qtyMatch[1], 10) : 2;
    const cart = getCart(sessionId, 'agent');

    if (cart.items.length === 0) {
      return {
        sessionId,
        message: "Your cart is empty. Please select a garment to add first.",
        products: [],
        actions: ['get_cart'],
        context: session.shoppingContext,
        cart
      };
    }

    const targetItem = cart.items[cart.items.length - 1];
    const updateRes = updateCartQuantity(sessionId, targetItem.productId, targetQty, 'agent');
    actions.push('update_cart_quantity');

    if (!updateRes.success) {
      return {
        sessionId,
        message: `I couldn't update the quantity: ${updateRes.message || 'Requested quantity exceeds available stock.'}`,
        products: [],
        actions,
        context: session.shoppingContext,
        cart: updateRes.cart
      };
    }

    return {
      sessionId,
      message: `Updated the quantity of **${targetItem.name}** to **${targetQty}** (New cart total: ₹${updateRes.cart.total.toLocaleString('en-IN')}).`,
      products: [],
      actions,
      context: session.shoppingContext,
      cart: updateRes.cart
    };
  }

  // 6. Complete Look Outfit Curation
  if (intent.action === 'complete_look') {
    let targetBudget = intent.maxPrice || 8000;
    const occ = intent.occasion || (lowerMsg.includes('wedding') ? 'Wedding Guest' : 'Atelier Look');
    const look = curateCompleteLookOutfit(occ, targetBudget, intent.gender);

    if (look) {
      const mainProd = getProductById(look.mainItem.productId)!;
      const compProd = getProductById(look.complementaryItem.productId)!;
      session.lastProducts = [mainProd, compProd];
      session.shoppingContext.curatedLook = look;
      session.shoppingContext.activeProductId = mainProd.id;

      const matchReasons: Record<string, string> = {
        [mainProd.id]: generateProductMatchReason(mainProd, session.shoppingContext, userMessage),
        [compProd.id]: generateProductMatchReason(compProd, session.shoppingContext, userMessage)
      };

      const message = `Here is a complete **${look.title}** tailored for under ₹${targetBudget.toLocaleString('en-IN')}:\n\n` +
        `1. **${look.mainItem.name}** — ₹${look.mainItem.price.toLocaleString('en-IN')}\n` +
        `2. **${look.complementaryItem.name}** — ₹${look.complementaryItem.price.toLocaleString('en-IN')}\n\n` +
        `**Total Look:** ₹${look.totalPrice.toLocaleString('en-IN')}\n\n` +
        `Would you like to add this complete look to your shopping bag?`;

      return {
        sessionId,
        message,
        products: [mainProd, compProd],
        actions: ['recommend_products'],
        context: session.shoppingContext,
        curatedLook: look,
        matchReasons,
        cart: getCart(sessionId, 'agent'),
        statusIndicator: 'ready'
      };
    }
  }

  // 7. Add Complete Look to Bag
  if (
    (lowerMsg.includes('add look') || lowerMsg.includes('add the look') || lowerMsg.includes('add both') || lowerMsg.includes('add outfit') || lowerMsg.includes('add this look') || lowerMsg.includes('add the complete look')) &&
    session.shoppingContext.curatedLook
  ) {
    const look = session.shoppingContext.curatedLook;
    const currentCartBefore = getCart(sessionId, 'agent');

    if (currentCartBefore.total + look.totalPrice > 10000) {
      return {
        sessionId,
        message: `Adding this look would take your bag to ₹${(currentCartBefore.total + look.totalPrice).toLocaleString('en-IN')}, which exceeds Vastra.AI's ₹10,000 spending limit. I haven't added it. Please adjust your bag before adding.`,
        products: session.lastProducts,
        actions: ['guardrail_check'],
        context: session.shoppingContext,
        curatedLook: look,
        cart: currentCartBefore,
        statusIndicator: 'ready'
      };
    }

    addToCart({ sessionId, productId: look.mainItem.productId, quantity: 1, size: look.mainItem.size || 'M', color: look.mainItem.color || 'Default', channel: 'agent' });
    addToCart({ sessionId, productId: look.complementaryItem.productId, quantity: 1, size: look.complementaryItem.size || 'Free Size', color: look.complementaryItem.color || 'Default', channel: 'agent' });

    const currentCart = getCart(sessionId, 'agent');
    return {
      sessionId,
      message: `I've added both pieces from the **${look.title}** (${look.mainItem.name} + ${look.complementaryItem.name}) to your shopping bag.\n\nBag Total: ₹${currentCart.total.toLocaleString('en-IN')} (${currentCart.itemCount} pieces).`,
      products: session.lastProducts,
      actions: ['add_to_cart'],
      context: session.shoppingContext,
      curatedLook: look,
      cart: currentCart,
      statusIndicator: 'updating_bag'
    };
  }

  // 8. Size Availability Inquiry ("Is M available?", "Do you have size 40?")
  if (intent.action === 'check_size' || (intent.size && (lowerMsg.includes('available') || lowerMsg.includes('have') || lowerMsg.includes('is it')))) {
    const targetSize = intent.size || 'M';
    let targetIdx = 0;
    if (lowerMsg.includes('second') || lowerMsg.includes('2nd')) targetIdx = 1;
    if (lowerMsg.includes('third') || lowerMsg.includes('3rd')) targetIdx = 2;

    let activeProd: Product | null = null;
    if (session.displayedProductIds[targetIdx]) {
      activeProd = getProductById(session.displayedProductIds[targetIdx]);
    }
    if (!activeProd && session.lastProducts[targetIdx]) {
      activeProd = session.lastProducts[targetIdx];
    }
    if (!activeProd && session.shoppingContext.activeProductId) {
      activeProd = getProductById(session.shoppingContext.activeProductId);
    }
    if (!activeProd) {
      activeProd = session.lastProducts[0] || null;
    }

    if (activeProd) {
      const sizeToolRes = executeTool(
        'check_size',
        {
          productId: activeProd.id,
          productName: activeProd.name,
          size: targetSize
        },
        session,
        sessionId,
        collectedProducts,
        actions
      );

      const isAvailable = sizeToolRes.result?.available;
      if (isAvailable) {
        session.shoppingContext.size = targetSize;
        return {
          sessionId,
          message: `Yes! The **${activeProd.name}** is available in size **${targetSize}** (${activeProd.stock} pieces remaining in stock in ${activeProd.colors.join(', ')}). Would you like me to add it to your bag?`,
          products: [activeProd],
          actions: ['check_size'],
          context: session.shoppingContext,
          cart: getCart(sessionId, 'agent'),
          statusIndicator: 'ready'
        };
      } else {
        return {
          sessionId,
          message: `Size **${targetSize}** is currently unavailable for the **${activeProd.name}**. Available sizes in our atelier are: **${activeProd.sizes.join(', ')}**.`,
          products: [activeProd],
          actions: ['check_size'],
          context: session.shoppingContext,
          cart: getCart(sessionId, 'agent'),
          statusIndicator: 'ready'
        };
      }
    }
  }

  // 9. Explain Why ("Why?", "Why do you recommend this?")
  if (intent.action === 'explain_why') {
    const activeProd = session.shoppingContext.activeProductId
      ? getProductById(session.shoppingContext.activeProductId)
      : (session.lastProducts[0] || null);
    if (activeProd) {
      const budgetStr = session.shoppingContext.maxPrice ? `fits comfortably within your ₹${session.shoppingContext.maxPrice.toLocaleString('en-IN')} budget` : `priced at ₹${activeProd.price.toLocaleString('en-IN')}`;
      const reason = `I recommend the **${activeProd.name}** because it ${budgetStr}, holds an outstanding ${activeProd.rating}★ rating across ${activeProd.reviewCount}+ verified patrons, and features artisan craftsmanship in ${activeProd.description} We currently have ${activeProd.stock} pieces remaining in stock.`;

      return {
        sessionId,
        message: reason,
        products: [activeProd],
        actions: ['get_product'],
        context: session.shoppingContext,
        recommendation: session.shoppingContext.activeRecommendation,
        upsell: session.shoppingContext.upsellSuggestion,
        cart: getCart(sessionId, 'agent')
      };
    }
  }

  // Plain text confirmation guardrail: user typed "yes", "confirm", "pay now", etc.
  const isPlainTextConfirm = /^(?:confirm|yes|confirm\s+order|confirm\s+and\s+pay|confirm\s+purchase|pay\s+now|proceed\s+to\s+pay|authorize\s+payment)$/i.test(lowerMsg);
  if (isPlainTextConfirm && session.shoppingContext.pendingCheckoutState) {
    const prep = prepareCheckout(sessionId);
    return {
      sessionId,
      message: `Your order review is prepared above for ₹${(session.shoppingContext.pendingCheckoutState.totalAmount || 0).toLocaleString('en-IN')}.\n\nFor security and customer verification, please click the **Confirm & Pay** button directly on the review card to open the secure payment gateway. (The agent does not process payments automatically from plain text chat.)`,
      products: [],
      actions: ['require_ui_click'],
      context: session.shoppingContext,
      cart: getCart(sessionId, 'agent'),
      checkout: prep
    };
  }

  // Address detection in chat (e.g. "deliver to 42 Atelier Lane, Indiranagar, Bangalore 560038" or text containing PIN code \b\d{6}\b)
  const pinMatch = lowerMsg.match(/\b([1-9][0-9]{5})\b/);
  const isAddressInput = (pinMatch || lowerMsg.includes('address is') || lowerMsg.includes('deliver to') || lowerMsg.includes('ship to')) &&
    (lowerMsg.includes('road') || lowerMsg.includes('street') || lowerMsg.includes('lane') || lowerMsg.includes('flat') || lowerMsg.includes('nagar') || lowerMsg.includes('sector') || lowerMsg.includes('colony') || lowerMsg.includes('layout') || lowerMsg.includes('bangalore') || lowerMsg.includes('delhi') || lowerMsg.includes('mumbai') || lowerMsg.includes('kolkata') || pinMatch);

  if (isAddressInput && session.customerId) {
    try {
      const pinCode = pinMatch ? pinMatch[1] : '560038';
      const cleanAddressLine = userMessage.replace(/(?:my\s+address\s+is|deliver\s+to|ship\s+to|please\s+send\s+to)\s*:?/gi, '').trim();
      const customer = db.prepare('SELECT id, name, email, phone FROM customers WHERE id = ?').get(session.customerId) as any;

      const saved = addCustomerAddress(session.customerId, {
        name: customer?.name || 'Customer',
        phone: customer?.phone || '+91 98765 43210',
        addressLine: cleanAddressLine.split(',')[0]?.trim() || cleanAddressLine,
        city: cleanAddressLine.includes('Bangalore') ? 'Bangalore' : cleanAddressLine.includes('Delhi') ? 'New Delhi' : cleanAddressLine.includes('Mumbai') ? 'Mumbai' : 'Bangalore',
        state: cleanAddressLine.includes('Karnataka') ? 'Karnataka' : cleanAddressLine.includes('Delhi') ? 'Delhi' : cleanAddressLine.includes('Maharashtra') ? 'Maharashtra' : 'Karnataka',
        postalCode: pinCode,
        isDefault: true
      });

      session.shippingAddress = saved;

      const cart = getCart(sessionId, 'agent');
      if (cart.items.length > 0) {
        const prep = prepareCheckout(sessionId);
        const itemsSummary = (prep.items || [])
          .map((it, idx) => `${idx + 1}. **${it.name}**\n   Size: ${it.size || 'M'} — Quantity: ${it.quantity} — ₹${it.price.toLocaleString('en-IN')}`)
          .join('\n\n');

        return {
          sessionId,
          message: `Thank you! We have saved your delivery address:\n**${saved.addressLine}, ${saved.city}, ${saved.state} - ${saved.postalCode}**\n\nYour order review is ready:\n\n${itemsSummary}\n\n**Total:** ₹${(prep.totalAmount || 0).toLocaleString('en-IN')}\n\nPlease click the **Confirm & Pay** button below to complete your order.`,
          products: [],
          actions: ['prepare_checkout'],
          context: session.shoppingContext,
          cart,
          checkout: prep,
          shippingAddress: saved
        };
      }
    } catch {
      // fallback
    }
  }

  // =========================================================================
  // MULTI-PRODUCT SELECTION & NATURAL LANGUAGE COMMANDS
  // =========================================================================

  // Ambiguity Case 1: "buy 2" / "buy two"
  const isBuyTwoQuery = /^(?:buy\s+2|buy\s+two)$/i.test(lowerMsg.trim());
  if (isBuyTwoQuery) {
    if (session.lastProducts.length > 1 || session.displayedProductIds.length > 1) {
      // Multiple products in view -> ask clarification without guessing!
      return {
        sessionId,
        message: "Sure — which two would you like? You can tap the cards above or tell me.",
        products: session.lastProducts,
        actions: ['clarification_required'],
        clarificationOptions: session.lastProducts,
        context: session.shoppingContext,
        cart: getCart(sessionId, 'agent')
      };
    } else if (session.shoppingContext.activeProductId || session.lastProducts.length === 1) {
      const targetProd = (session.shoppingContext.activeProductId ? getProductById(session.shoppingContext.activeProductId) : null) || session.lastProducts[0];
      if (targetProd) {
        if (targetProd.price * 2 > 10000) {
          return {
            sessionId,
            message: `I can help you purchase up to ₹10,000 at a time. Your selected items total ₹${(targetProd.price * 2).toLocaleString('en-IN')}. Would you like to buy one first, or continue to manual checkout for the full order?`,
            products: [targetProd],
            actions: ['guardrail_prevented'],
            context: session.shoppingContext,
            cart: getCart(sessionId, 'agent')
          };
        }
        addToCart({
          sessionId,
          productId: targetProd.id,
          quantity: 2,
          channel: 'agent'
        });
        const currentCart = getCart(sessionId, 'agent');
        return {
          sessionId,
          message: `Added 2 of the **${targetProd.name}** to your bag (Total: ₹${currentCart.total.toLocaleString('en-IN')}).`,
          products: [targetProd],
          actions: ['update_quantity'],
          context: session.shoppingContext,
          cart: currentCart,
          statusIndicator: 'updating_bag'
        };
      }
    }
  }

  // Ambiguity Case 2: "Buy two of this" / "buy 2 of this"
  const isBuyTwoOfThis = /(?:buy\s+(?:2|two)\s+of\s+(?:this|the\s+item|this\s+dress|this\s+jacket|this\s+shirt)|2\s+of\s+this)/i.test(lowerMsg);
  if (isBuyTwoOfThis) {
    const targetProd = (session.shoppingContext.activeProductId ? getProductById(session.shoppingContext.activeProductId) : null) || session.lastProducts[0];
    if (targetProd) {
      if (targetProd.price * 2 > 10000) {
        return {
          sessionId,
          message: `I can help you purchase up to ₹10,000 at a time. Your selected items total ₹${(targetProd.price * 2).toLocaleString('en-IN')}. Would you like to buy one first, or continue to manual checkout for the full order?`,
          products: [targetProd],
          actions: ['guardrail_prevented'],
          context: session.shoppingContext,
          cart: getCart(sessionId, 'agent')
        };
      }
      clearCart(sessionId, 'agent');
      addToCart({
        sessionId,
        productId: targetProd.id,
        quantity: 2,
        channel: 'agent'
      });
      if (!session.customerId) {
        return {
          sessionId,
          message: `I've set quantity to 2 for the **${targetProd.name}** (Total: ₹${(targetProd.price * 2).toLocaleString('en-IN')}). Please sign in to your Vastra.AI customer account before completing your purchase.`,
          products: [],
          actions: ['require_login'],
          requireLogin: true,
          requiresAuth: true,
          context: session.shoppingContext,
          cart: getCart(sessionId, 'agent')
        };
      }
      const addresses = getCustomerAddresses(session.customerId);
      const effectiveAddr = addresses.find((a) => a.isDefault) || addresses[0] || session.shippingAddress;
      if (!effectiveAddr || !effectiveAddr.addressLine || !effectiveAddr.city || !effectiveAddr.postalCode) {
        return {
          sessionId,
          message: `I've set quantity to 2 for the **${targetProd.name}** (Total: ₹${(targetProd.price * 2).toLocaleString('en-IN')}). Please provide your delivery address so we can prepare your order review.`,
          products: [],
          actions: ['require_address'],
          requireAddress: true,
          context: session.shoppingContext,
          cart: getCart(sessionId, 'agent')
        };
      }
      const prep = prepareCheckout(sessionId);
      return {
        sessionId,
        message: `I've prepared your order review for 2 of the **${targetProd.name}** (Total: ₹${(targetProd.price * 2).toLocaleString('en-IN')}). Please click **Confirm & Pay** to complete your order.`,
        products: [],
        actions: ['prepare_checkout'],
        context: session.shoppingContext,
        cart: getCart(sessionId, 'agent'),
        checkout: prep
      };
    }
  }

  // Ambiguity Case 3: "Buy the blue one" when multiple blue options exist
  const isBlueOneQuery = /(?:buy\s+(?:the\s+)?blue\s+one|the\s+blue\s+one|blue\s+one\s+please)/i.test(lowerMsg);
  if (isBlueOneQuery && session.lastProducts.length > 0) {
    const blueProds = session.lastProducts.filter(p =>
      (p.colors || []).some(c => c.toLowerCase().includes('blue') || c.toLowerCase().includes('indigo')) ||
      p.name.toLowerCase().includes('blue') || p.name.toLowerCase().includes('indigo')
    );
    if (blueProds.length > 1) {
      return {
        sessionId,
        message: `I found ${blueProds.length} blue options. Which one would you like?`,
        products: blueProds,
        actions: ['clarification_required'],
        clarificationOptions: blueProds,
        context: session.shoppingContext,
        cart: getCart(sessionId, 'agent')
      };
    } else if (blueProds.length === 1) {
      session.selectedProductIds = [blueProds[0].id];
      session.shoppingContext.selectedProductIds = [blueProds[0].id];
    }
  }

  // Selection Case 4: Append selection ("and the third one too", "and the third one", "and the last one too")
  const isAppendSelection = /(?:and\s+(?:the\s+)?(?:third|second|last|fourth|1st|2nd|3rd)\s+one(?:\s+too)?)/i.test(lowerMsg);
  if (isAppendSelection && session.displayedProductIds.length > 0) {
    let targetIdx = 0;
    if (lowerMsg.includes('second') || lowerMsg.includes('2nd')) targetIdx = 1;
    if (lowerMsg.includes('third') || lowerMsg.includes('3rd')) targetIdx = 2;
    if (lowerMsg.includes('fourth') || lowerMsg.includes('4th')) targetIdx = 3;
    if (lowerMsg.includes('last')) targetIdx = session.displayedProductIds.length - 1;

    const pid = session.displayedProductIds[targetIdx];
    const targetProd = pid ? getProductById(pid) : null;
    if (targetProd) {
      if (!session.selectedProductIds.includes(targetProd.id)) {
        session.selectedProductIds.push(targetProd.id);
      }
      session.shoppingContext.selectedProductIds = session.selectedProductIds;
      return {
        sessionId,
        message: `Added the **${targetProd.name}** to your selection. You now have ${session.selectedProductIds.length} pieces selected. Would you like to configure your options or buy selected?`,
        products: session.lastProducts,
        actions: ['select_product'],
        selectedProductIds: session.selectedProductIds,
        context: session.shoppingContext,
        cart: getCart(sessionId, 'agent')
      };
    }
  }

  // Selection Case 5: "I want the first and third", "first and third"
  const isFirstAndThird = /(?:first\s+and\s+third|1st\s+and\s+3rd)/i.test(lowerMsg);
  if (isFirstAndThird && session.displayedProductIds.length >= 3) {
    const p1 = getProductById(session.displayedProductIds[0]);
    const p3 = getProductById(session.displayedProductIds[2]);
    if (p1 && p3) {
      session.selectedProductIds = [p1.id, p3.id];
      session.shoppingContext.selectedProductIds = session.selectedProductIds;
      if (!lowerMsg.includes('buy')) {
        return {
          sessionId,
          message: `Selected **${p1.name}** and **${p3.name}** (2 items selected). Would you like to configure your sizes or buy both?`,
          products: session.lastProducts,
          actions: ['select_product'],
          selectedProductIds: session.selectedProductIds,
          context: session.shoppingContext,
          cart: getCart(sessionId, 'agent')
        };
      }
    }
  }

  // Selection Case 6: "remove the first one", "actually remove the first one"
  const isRemoveFirst = /(?:actually\s+remove\s+the\s+first|remove\s+the\s+first\s+one|remove\s+first\s+one|remove\s+the\s+first)/i.test(lowerMsg);
  if (isRemoveFirst && session.selectedProductIds.length > 0) {
    const removedId = session.selectedProductIds.shift();
    const removedProd = removedId ? getProductById(removedId) : null;
    session.shoppingContext.selectedProductIds = session.selectedProductIds;
    session.selectedItems = (session.selectedItems || []).filter(it => it.productId !== removedId);
    return {
      sessionId,
      message: `Removed ${removedProd ? `**${removedProd.name}**` : 'that item'} from your selection. You currently have ${session.selectedProductIds.length} piece(s) selected.`,
      products: session.lastProducts,
      actions: ['deselect_product'],
      selectedProductIds: session.selectedProductIds,
      context: session.shoppingContext,
      cart: getCart(sessionId, 'agent')
    };
  }

  // 10. Checkout & Multi-Buy Intent
  const isMultiBuyIntent =
    lowerMsg.includes('buy both') ||
    lowerMsg.includes('buy these two') ||
    lowerMsg.includes('buy these') ||
    lowerMsg.includes('buy selected') ||
    lowerMsg.includes('buy the two') ||
    lowerMsg.includes('buy the two i selected') ||
    lowerMsg.includes('buy the first two') ||
    (isFirstAndThird && lowerMsg.includes('buy'));

  const isSingleSelectBuy =
    (lowerMsg === 'buy this' || lowerMsg === 'buy this one' || lowerMsg === 'buy this one.') &&
    session.selectedProductIds.length === 1;

  const isCheckoutIntent = intent.action === 'prepare_checkout' ||
    isPlainTextConfirm ||
    isMultiBuyIntent ||
    isSingleSelectBuy ||
    lowerMsg === 'buy it' || lowerMsg === 'buy it.' || lowerMsg.startsWith('buy ') ||
    lowerMsg.includes('checkout') || lowerMsg.includes('proceed to checkout') ||
    lowerMsg.includes('place order') || lowerMsg.includes('ready to order') ||
    lowerMsg.includes('confirm and proceed');

  if (isCheckoutIntent) {
    let targetProds: Product[] = [];

    if (session.selectedProductIds.length >= 2) {
      targetProds = session.selectedProductIds.map(id => getProductById(id)).filter(Boolean) as Product[];
    } else if (lowerMsg.includes('first two') && session.displayedProductIds.length >= 2) {
      targetProds = [getProductById(session.displayedProductIds[0])!, getProductById(session.displayedProductIds[1])!];
    } else if (isFirstAndThird && session.displayedProductIds.length >= 3) {
      targetProds = [getProductById(session.displayedProductIds[0])!, getProductById(session.displayedProductIds[2])!];
    } else if ((lowerMsg.includes('both') || lowerMsg.includes('these two')) && session.lastProducts.length >= 2) {
      targetProds = [session.lastProducts[0], session.lastProducts[1]];
    } else if (isSingleSelectBuy || session.selectedProductIds.length === 1) {
      const sp = getProductById(session.selectedProductIds[0]);
      if (sp) targetProds = [sp];
    }

    // If target products found for multi-buy, validate spending limit and prepare cart:
    if (targetProds.length > 0) {
      const combinedTotal = targetProds.reduce((sum, p) => {
        const configuredItem = (session.selectedItems || []).find(it => it.productId === p.id);
        const qty = configuredItem?.quantity || 1;
        return sum + (p.price * qty);
      }, 0);
      if (combinedTotal > 10000) {
        return {
          sessionId,
          message: `I can help you purchase up to ₹10,000 at a time. Your selected items total ₹${combinedTotal.toLocaleString('en-IN')}. Would you like to buy one first, or continue to manual checkout for the full order?`,
          products: targetProds,
          actions: ['guardrail_prevented'],
          context: session.shoppingContext,
          cart: getCart(sessionId, 'agent')
        };
      }

      clearCart(sessionId, 'agent');
      for (const p of targetProds) {
        const configuredItem = (session.selectedItems || []).find(it => it.productId === p.id);
        const chosenSize = configuredItem?.size || p.sizes[0] || 'M';
        const chosenColor = configuredItem?.color || p.colors[0] || 'Default';
        const qty = configuredItem?.quantity || 1;
        addToCart({
          sessionId,
          productId: p.id,
          quantity: qty,
          size: chosenSize,
          color: chosenColor,
          channel: 'agent'
        });
      }
    } else if (getCart(sessionId, 'agent').items.length === 0 && session.lastProducts.length > 0 && !lowerMsg.includes('cart')) {
      const activeProd = session.lastProducts[0];
      const addRes = addToCart({
        sessionId,
        productId: activeProd.id,
        quantity: 1,
        channel: 'agent'
      });
    }

    let cart = getCart(sessionId, 'agent');

    if (cart.items.length === 0) {
      return {
        sessionId,
        message: "Your shopping bag is currently empty. Would you like me to help you find something from our collection?",
        products: [],
        actions: ['prepare_checkout'],
        context: session.shoppingContext,
        cart
      };
    }

    // CHECK 1: Customer Authentication Guardrail
    const effectiveCustomerId = session.customerId;
    if (!effectiveCustomerId) {
      return {
        sessionId,
        message: "Please sign in to your Vastra.AI customer account before completing your purchase. Once signed in, we will verify your delivery details and prepare your order review.",
        products: [],
        actions: ['require_login'],
        requireLogin: true,
        requiresAuth: true,
        context: session.shoppingContext,
        cart
      };
    }

    // Verify customer exists in database
    const customer = db.prepare('SELECT id, name, email, phone FROM customers WHERE id = ?').get(effectiveCustomerId) as any;
    if (!customer) {
      return {
        sessionId,
        message: "Please sign in to your Vastra.AI customer account before completing your purchase.",
        products: [],
        actions: ['require_login'],
        requireLogin: true,
        requiresAuth: true,
        context: session.shoppingContext,
        cart
      };
    }

    // CHECK 2: Shipping Address Guardrail
    const addresses = getCustomerAddresses(effectiveCustomerId);
    const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
    const sessionAddr = session.shippingAddress;
    const effectiveAddr = defaultAddr || sessionAddr;

    if (!effectiveAddr || !effectiveAddr.addressLine || !effectiveAddr.city || !effectiveAddr.postalCode) {
      return {
        sessionId,
        message: `Welcome, ${customer.name}. We don't have a delivery address on file for your order yet. Please provide your shipping address (Street address, City, State, and PIN code) so we can prepare your order review.`,
        products: [],
        actions: ['require_address'],
        requireAddress: true,
        context: session.shoppingContext,
        cart
      };
    }

    // CHECK 3: Both Authenticated & Valid Address on file -> Prepare Order Review
    const prep = prepareCheckout(sessionId);
    actions.push('prepare_checkout');

    if (!prep.ready) {
      return {
        sessionId,
        message: `I couldn't prepare the checkout: ${prep.message || 'Validation failed.'}`,
        products: [],
        actions,
        context: session.shoppingContext,
        cart,
        checkout: prep
      };
    }

    const itemsSummary = (prep.items || [])
      .map((it, idx) => `${idx + 1}. **${it.name}**\n   Size: ${it.size || 'M'} — Quantity: ${it.quantity} — ₹${it.price.toLocaleString('en-IN')}`)
      .join('\n\n');

    return {
      sessionId,
      message: `Your order review is ready:\n\n${itemsSummary}\n\n**Delivery Address:** ${effectiveAddr.name || customer.name} • ${effectiveAddr.addressLine}, ${effectiveAddr.city}, ${effectiveAddr.state} - ${effectiveAddr.postalCode}\n\n**Total:** ₹${(prep.totalAmount || 0).toLocaleString('en-IN')}\n\nPlease click the **Confirm & Pay** button below to proceed to secure payment.`,
      products: [], // Rule 25: STOP discovery. No new recommendations!
      actions,
      context: session.shoppingContext,
      cart,
      checkout: prep,
      shippingAddress: effectiveAddr
    };
  }

  // 11. Add to Bag Action ("Add it to my bag", "Add the second one", "Add this dress in M", "add jeans into cart & buy")
  if (intent.action === 'add_to_bag' || lowerMsg.startsWith('add ') || lowerMsg.includes('add to bag') || lowerMsg.includes('add to cart') || lowerMsg.includes('add into cart') || lowerMsg.includes('into cart')) {
    let targetProduct: Product | null = null;

    // 1. Check ordinal index first if user said "the second one" or "add the 2nd one"
    if (intent.ordinalIndex !== undefined) {
      const ordId = session.displayedProductIds[intent.ordinalIndex];
      if (ordId) {
        targetProduct = getProductById(ordId);
      }
      if (!targetProduct && session.lastProducts[intent.ordinalIndex]) {
        targetProduct = session.lastProducts[intent.ordinalIndex];
      }
    } else if (intent.ordinalKeyword === 'cheaper' && session.lastProducts.length > 0) {
      const sorted = [...session.lastProducts].sort((a, b) => a.price - b.price);
      targetProduct = sorted[0];
    } else if (intent.ordinalKeyword === 'expensive' && session.lastProducts.length > 0) {
      const sorted = [...session.lastProducts].sort((a, b) => b.price - a.price);
      targetProduct = sorted[0];
    }

    // 2. Explicit category / keyword search (Fixes "jeans" bug completely: explicit intent overrides stale context)
    const isExplicitJeans = lowerMsg.includes('jean') || lowerMsg.includes('denim');
    const explicitCategory = intent.category || (isExplicitJeans ? 'jeans' : undefined);
    const explicitKeyword = intent.productKeyword || (isExplicitJeans ? 'jeans' : undefined);

    if (!targetProduct && (explicitCategory || explicitKeyword)) {
      const explicitSearchTerm = explicitKeyword || explicitCategory || '';
      const explicitMatches = searchProducts(explicitSearchTerm, {
        category: explicitCategory,
        gender: intent.gender || (isExplicitJeans ? undefined : session.shoppingContext.gender),
        color: intent.color
      });

      if (explicitMatches.length > 0) {
        targetProduct = explicitMatches[0];
      } else {
        // The user explicitly requested an item (e.g. jeans) not in catalog - NEVER fall back to stale cardholder/wallet!
        return {
          sessionId,
          message: `I couldn't find ${explicitSearchTerm} in the current Vastra.AI collection.`,
          products: [],
          actions: [],
          context: session.shoppingContext,
          cart: getCart(sessionId, 'agent')
        };
      }
    }

    // 3. Clean search term fallback if no explicit category
    const cleanSearch = lowerMsg
      .replace(/(?:in\s+size|size|in)\s+[^\s]+/gi, '')
      .replace(/add\s+(?:to\s+(?:my\s+)?cart|into\s+(?:my\s+)?cart|to\s+(?:my\s+)?bag|into\s+(?:my\s+)?bag|it|this|the\s+item)?/gi, '')
      .replace(/(?:to|into|in)\s+(?:my\s+)?(?:cart|bag)/gi, '')
      .replace(/\b(?:it|this|the\s+look|both|that|please|and\s+buy|&\s*buy|and\s+checkout|&\s*checkout)\b/gi, '')
      .trim();

    if (!targetProduct && cleanSearch.length >= 3) {
      const found = searchProducts(cleanSearch);
      if (found.length > 0) {
        targetProduct = found[0];
      }
    }

    // 4. Stale context fallback ONLY when user did NOT specify a product/category (e.g. "add it to my bag", "add this")
    if (!targetProduct && !explicitCategory && !explicitKeyword) {
      if (session.shoppingContext.activeProductId) {
        targetProduct = getProductById(session.shoppingContext.activeProductId);
      } else if (session.lastProducts.length > 0) {
        targetProduct = session.lastProducts[0];
      }
    }

    if (!targetProduct) {
      return {
        sessionId,
        message: "Which piece would you like to add? Let me know the garment or explore our handcrafted collection first.",
        products: [],
        actions: [],
        context: session.shoppingContext,
        cart: getCart(sessionId, 'agent')
      };
    }

    const chosenSize = intent.size || session.shoppingContext.size || targetProduct.sizes[0] || 'M';
    const chosenColor = intent.color || session.shoppingContext.color || targetProduct.colors[0] || 'Default';
    const currentCartBefore = getCart(sessionId, 'agent');

    // Server-side ₹10,000 spending guardrail check
    if (currentCartBefore.total + targetProduct.price > 10000) {
      const remainingBudget = Math.max(0, 10000 - currentCartBefore.total);
      const alternative = searchProducts(undefined, { maxPrice: remainingBudget })[0];
      let altSuggestion = '';
      if (alternative) {
        altSuggestion = ` I can suggest a piece like the **${alternative.name}** (₹${alternative.price.toLocaleString('en-IN')}) within your remaining limit.`;
      }
      return {
        sessionId,
        message: `That would take your bag to ₹${(currentCartBefore.total + targetProduct.price).toLocaleString('en-IN')}, which exceeds Vastra.AI's ₹10,000 spending limit. I haven't added it.${altSuggestion}`,
        products: alternative ? [alternative] : [targetProduct],
        actions: ['guardrail_check'],
        context: session.shoppingContext,
        cart: currentCartBefore,
        statusIndicator: 'ready'
      };
    }

    const addRes = addToCart({
      sessionId,
      productId: targetProduct.id,
      quantity: 1,
      size: chosenSize,
      color: chosenColor,
      channel: 'agent'
    });
    actions.push('add_to_cart');

    const currentCart = getCart(sessionId, 'agent');

    // If user asked to buy and checkout immediately (e.g. "add jeans into cart & buy")
    if (intent.isBuyAndCheckout || lowerMsg.includes('& buy') || lowerMsg.includes('and buy') || lowerMsg.includes('& checkout') || lowerMsg.includes('and checkout')) {
      const effectiveCustomerId = session.customerId;

      // Check 1: Login check
      if (!effectiveCustomerId) {
        return {
          sessionId,
          message: `Added the **${targetProduct.name}** (${chosenSize} • ${chosenColor}) to your bag.\n\nPlease sign in to your Vastra.AI customer account before completing your purchase. Once signed in, we will verify your delivery details and prepare your order review.`,
          products: [targetProduct],
          actions: ['add_to_cart', 'require_login'],
          requireLogin: true,
          requiresAuth: true,
          context: session.shoppingContext,
          cart: currentCart,
          statusIndicator: 'ready'
        };
      }

      // Check 2: Customer check
      const customer = db.prepare('SELECT id, name, email, phone FROM customers WHERE id = ?').get(effectiveCustomerId) as any;
      if (!customer) {
        return {
          sessionId,
          message: `Added the **${targetProduct.name}** (${chosenSize} • ${chosenColor}) to your bag.\n\nPlease sign in to your Vastra.AI customer account before completing your purchase.`,
          products: [targetProduct],
          actions: ['add_to_cart', 'require_login'],
          requireLogin: true,
          requiresAuth: true,
          context: session.shoppingContext,
          cart: currentCart,
          statusIndicator: 'ready'
        };
      }

      // Check 3: Address check
      const addresses = getCustomerAddresses(effectiveCustomerId);
      const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
      const effectiveAddr = defaultAddr || session.shippingAddress;

      if (!effectiveAddr || !effectiveAddr.addressLine || !effectiveAddr.city || !effectiveAddr.postalCode) {
        return {
          sessionId,
          message: `Added the **${targetProduct.name}** (${chosenSize} • ${chosenColor}) to your bag.\n\nWelcome, ${customer.name}. Please provide your delivery address (Street address, City, State, PIN) so we can prepare your order review.`,
          products: [targetProduct],
          actions: ['add_to_cart', 'require_address'],
          requireAddress: true,
          context: session.shoppingContext,
          cart: currentCart,
          statusIndicator: 'ready'
        };
      }

      // Check 4: Both pass -> prepare checkout review card
      const prep = prepareCheckout(sessionId);
      actions.push('prepare_checkout');
      const itemsSummary = (prep.items || []).map((it, idx) => `${idx + 1}. **${it.name}**\n   Size: ${it.size || 'M'} — Quantity: ${it.quantity} — ₹${it.price.toLocaleString('en-IN')}`).join('\n\n');
      return {
        sessionId,
        message: `Added the **${targetProduct.name}** (${chosenSize} • ${chosenColor}) to your bag.\n\nYour order review is ready:\n\n${itemsSummary}\n\n**Delivery Address:** ${effectiveAddr.name || customer.name} • ${effectiveAddr.addressLine}, ${effectiveAddr.city}, ${effectiveAddr.state} - ${effectiveAddr.postalCode}\n\n**Total:** ₹${(prep.totalAmount || 0).toLocaleString('en-IN')}\n\nPlease click the **Confirm & Pay** button below to proceed to secure payment.`,
        products: [targetProduct],
        actions,
        context: session.shoppingContext,
        cart: currentCart,
        checkout: prep,
        statusIndicator: 'ready',
        shippingAddress: effectiveAddr
      };
    }

    return {
      sessionId,
      message: `Added the **${targetProduct.name}** (${chosenSize} • ${chosenColor}) to your shopping bag. Bag Total: ₹${currentCart.total.toLocaleString('en-IN')} (${currentCart.itemCount} piece(s)).`,
      products: [targetProduct],
      actions,
      context: session.shoppingContext,
      cart: currentCart,
      statusIndicator: 'updating_bag'
    };
  }

  // =========================================================================
  // SCENARIO: User Selects or Inspects Specific Item ("Show me the second one", "I like this one") -> Inspection & Bounded Upsell
  // =========================================================================
  if (
    lowerMsg.includes('i like this') ||
    lowerMsg.includes('i like the') ||
    lowerMsg.includes('i want this') ||
    lowerMsg.includes('this one looks good') ||
    lowerMsg.includes('love this') ||
    lowerMsg.includes('show me the second') ||
    lowerMsg.includes('show me the 2nd') ||
    lowerMsg.includes('show me the first') ||
    lowerMsg.includes('show me the 1st') ||
    lowerMsg.includes('show me the third') ||
    lowerMsg.includes('show the second') ||
    lowerMsg.includes('show the first') ||
    lowerMsg.includes('the second one') ||
    lowerMsg.includes('the 2nd one') ||
    lowerMsg.includes('the first one') ||
    lowerMsg.includes('the 1st one') ||
    lowerMsg === 'second one' ||
    lowerMsg === '2nd one' ||
    lowerMsg === 'first one' ||
    lowerMsg === '1st one' ||
    lowerMsg.includes('tell me more') ||
    lowerMsg.includes('more about') ||
    lowerMsg.includes('details on') ||
    lowerMsg.includes('describe the')
  ) {
    let targetIndex = 0;
    if (lowerMsg.includes('second') || lowerMsg.includes('2nd')) targetIndex = 1;
    if (lowerMsg.includes('third') || lowerMsg.includes('3rd')) targetIndex = 2;

    let refProd: Product | null = null;
    if (session.displayedProductIds[targetIndex]) {
      refProd = getProductById(session.displayedProductIds[targetIndex]);
    }
    if (!refProd) {
      refProd = session.lastProducts[targetIndex] || session.lastProducts[0];
    }

    if (refProd) {
      session.shoppingContext.activeProductId = refProd.id;
      session.shoppingContext.activeRecommendation = {
        productId: refProd.id,
        productName: refProd.name,
        price: refProd.price,
        rating: refProd.rating,
        reason: `Selected ${refProd.name}`
      };
      collectedProducts.push(refProd);

      let upsellPayload: UpsellSuggestion | undefined = session.shoppingContext.upsellSuggestion;

      if (!session.shoppingContext.upsellDeclined && !session.shoppingContext.upsellAccepted && !session.shoppingContext.upsellSuggestion) {
        const comp = getComplementaryProduct(refProd.id);
        if (comp) {
          upsellPayload = {
            productId: comp.id,
            productName: comp.name,
            price: comp.price,
            targetProductId: refProd.id,
            message: `Would you like to complete the look with the **${comp.name}** for ₹${comp.price.toLocaleString('en-IN')}?`,
            requiresConfirmation: true,
            status: 'suggested'
          };
          session.shoppingContext.upsellSuggestion = upsellPayload;
          actions.push('suggest_upsell');

          logAuditEvent({
            sessionId,
            channel: 'agent',
            action: 'upsell_suggested',
            details: {
              productId: comp.id,
              productName: comp.name,
              price: comp.price,
              targetProductId: refProd.id,
              reason: `Pairs with ${refProd.name}`
            },
            outcome: 'success'
          });

          collectedProducts.push(comp);

          return {
            sessionId,
            message: `The **${refProd.name}** (₹${refProd.price.toLocaleString('en-IN')}) is crafted from ${refProd.description} Rated ${refProd.rating}★ (${refProd.reviewCount} verified reviews).\n\nWould you like to complete the look with the **${comp.name}** for ₹${comp.price.toLocaleString('en-IN')}?`,
            products: collectedProducts,
            actions,
            context: session.shoppingContext,
            recommendation: session.shoppingContext.activeRecommendation,
            upsell: upsellPayload,
            cart: getCart(sessionId, 'agent')
          };
        }
      }

      return {
        sessionId,
        message: `The **${refProd.name}** (₹${refProd.price.toLocaleString('en-IN')}) is crafted from ${refProd.description} (${refProd.stock} pieces in stock, sizes: ${refProd.sizes.join(', ')}).`,
        products: collectedProducts,
        actions,
        context: session.shoppingContext,
        recommendation: session.shoppingContext.activeRecommendation,
        upsell: upsellPayload,
        cart: getCart(sessionId, 'agent')
      };
    }
  }

  // =========================================================================
  // SCENARIO: Price Overwrite ("Actually make it ₹7000")
  // =========================================================================
  const priceOverwriteMatch = lowerMsg.match(
    /(?:actually\s+make\s+it|make\s+it|change\s+(?:budget|price)\s+to|actually|budget\s+is)\s*(?:₹|inr|rs\.?)?\s*(\d{3,6})/i
  );

  if (priceOverwriteMatch && !lowerMsg.includes('cheaper') && !lowerMsg.includes('less')) {
    const newMaxPrice = parseInt(priceOverwriteMatch[1], 10);

    const searchRes = executeTool(
      'recommend_products',
      {
        query: undefined,
        gender: session.shoppingContext.gender,
        category: session.shoppingContext.category,
        color: session.shoppingContext.color,
        maxPrice: newMaxPrice
      },
      session,
      sessionId,
      collectedProducts,
      actions
    );

    const prods = (searchRes.productsFound || []).slice(0, 4);

    return {
      sessionId,
      message: `I updated your budget limit to ₹${newMaxPrice.toLocaleString('en-IN')}. Here are curated ${session.shoppingContext.category || 'pieces'} within your new price range.`,
      products: prods,
      actions,
      context: session.shoppingContext,
      recommendation: searchRes.recommendation,
      upsell: session.shoppingContext.upsellSuggestion,
      cart: getCart(sessionId, 'agent')
    };
  }

  // =========================================================================
  // SCENARIO: Contextual Refinement ("Anything cheaper?")
  // =========================================================================
  if (lowerMsg.includes('cheaper') || lowerMsg.includes('less expensive') || lowerMsg.includes('lower price') || lowerMsg.includes('budget friendly')) {
    let maxP = 4000;
    if (session.lastProducts.length > 0) {
      const minPrev = Math.min(...session.lastProducts.map((p) => p.price));
      maxP = Math.max(1500, minPrev - 500);
    } else if (session.shoppingContext.maxPrice) {
      maxP = Math.max(1500, Math.floor(session.shoppingContext.maxPrice * 0.7));
    }

    const searchRes = executeTool(
      'search_products',
      {
        query: undefined,
        category: session.shoppingContext.category,
        gender: session.shoppingContext.gender,
        color: session.shoppingContext.color,
        maxPrice: maxP,
        sort: 'price_low_high'
      },
      session,
      sessionId,
      collectedProducts,
      actions
    );

    let prods = (searchRes.productsFound || []).slice(0, 3);

    if (prods.length === 0) {
      const fallbackSearch = executeTool(
        'search_products',
        {
          gender: session.shoppingContext.gender || 'women',
          maxPrice: maxP,
          sort: 'price_low_high'
        },
        session,
        sessionId,
        collectedProducts,
        actions
      );
      prods = (fallbackSearch.productsFound || []).slice(0, 3);
    }

    if (prods.length > 0) {
      const topPick = prods[0];
      const categoryDesc = session.shoppingContext.category ? ` ${session.shoppingContext.category}` : ' pieces';
      return {
        sessionId,
        message: `I refined our selection for more accessible${categoryDesc}. Our top option is the **${topPick.name}** at ₹${topPick.price.toLocaleString('en-IN')} (${topPick.rating}★ rating, ${topPick.stock} in stock).`,
        products: prods,
        actions,
        context: session.shoppingContext,
        recommendation: session.shoppingContext.activeRecommendation,
        upsell: session.shoppingContext.upsellSuggestion,
        cart: getCart(sessionId, 'agent')
      };
    }

    return {
      sessionId,
      message: `I checked for options under ₹${maxP.toLocaleString('en-IN')}, but our handcrafted ${session.shoppingContext.category || 'garments'} in this collection start from ₹${(session.lastProducts[0]?.price || 3499).toLocaleString('en-IN')}.`,
      products: session.lastProducts.slice(0, 2),
      actions,
      context: session.shoppingContext,
      recommendation: session.shoppingContext.activeRecommendation,
      upsell: session.shoppingContext.upsellSuggestion,
      cart: getCart(sessionId, 'agent')
    };
  }

  // =========================================================================
  // SCENARIO: Product Reference Details ("Tell me more about the second one")
  // =========================================================================
  if (
    lowerMsg.includes('tell me more') ||
    lowerMsg.includes('more about') ||
    lowerMsg.includes('details on') ||
    lowerMsg.includes('describe the') ||
    lowerMsg.includes('more info')
  ) {
    let targetIndex = 0;
    if (lowerMsg.includes('second') || lowerMsg.includes('2nd')) targetIndex = 1;
    if (lowerMsg.includes('third') || lowerMsg.includes('3rd')) targetIndex = 2;

    const targetProduct = session.lastProducts[targetIndex] || session.lastProducts[0];

    if (targetProduct) {
      const toolRes = executeTool('get_product', { productId: targetProduct.id }, session, sessionId, collectedProducts, actions);
      const fullProd = toolRes.result;

      return {
        sessionId,
        message: `The **${fullProd.name}** (₹${fullProd.price.toLocaleString('en-IN')}) is crafted from ${fullProd.description} It is rated ${fullProd.rating}★ (${fullProd.reviewCount || 30}+ reviews), available in sizes ${Array.isArray(fullProd.sizes) ? fullProd.sizes.join(', ') : fullProd.sizes} and colors ${Array.isArray(fullProd.colors) ? fullProd.colors.join(', ') : fullProd.colors}. We currently have ${fullProd.stock} pieces in stock.`,
        products: [targetProduct],
        actions,
        context: session.shoppingContext,
        recommendation: session.shoppingContext.activeRecommendation,
        upsell: session.shoppingContext.upsellSuggestion,
        cart: getCart(sessionId, 'agent')
      };
    }
  }

  // =========================================================================
  // SCENARIO: Similarity Inquiry ("Show me something similar")
  // =========================================================================
  if (lowerMsg.includes('similar') || lowerMsg.includes('complete the look') || lowerMsg.includes('matching')) {
    let targetIndex = 0;
    if (lowerMsg.includes('second') || lowerMsg.includes('2nd')) targetIndex = 1;
    if (lowerMsg.includes('third') || lowerMsg.includes('3rd')) targetIndex = 2;

    const refProd = session.lastProducts[targetIndex] || session.lastProducts[0] || getProductById('men-001') || getProductById('women-001');
    if (refProd) {
      executeTool('get_similar_products', { productId: refProd.id }, session, sessionId, collectedProducts, actions);
      return {
        sessionId,
        message: `Here are complementary and similar handcrafted pieces designed to pair seamlessly with the **${refProd.name}**.`,
        products: collectedProducts,
        actions,
        context: session.shoppingContext,
        recommendation: session.shoppingContext.activeRecommendation,
        upsell: session.shoppingContext.upsellSuggestion,
        cart: getCart(sessionId, 'agent')
      };
    }
  }

  // =========================================================================
  // SCENARIO: Size Availability Inquiry ("Do you have them in L?")
  // =========================================================================
  const sizeQueryMatch = lowerMsg.match(/(?:in|size)\s*(xs|s|m|l|xl|xxl|38|39|40|41|42|43|44|free size)\b/i);
  if (sizeQueryMatch || lowerMsg.includes('do you have them in') || lowerMsg.includes('do you have this in') || lowerMsg.includes('available in')) {
    const targetSize = sizeQueryMatch ? sizeQueryMatch[1].toUpperCase() : 'L';
    const activeProducts = session.lastProducts.length > 0 ? session.lastProducts : searchProducts('', { category: session.shoppingContext.category });

    if (activeProducts.length > 0) {
      const availableItems = activeProducts.filter((p) =>
        p.sizes.some((s) => s.toUpperCase() === targetSize)
      );

      actions.push('get_product');

      if (availableItems.length > 0) {
        return {
          sessionId,
          message: `Yes! We have ${availableItems.length} piece(s) available in size **${targetSize}**, including the **${availableItems[0].name}** (Stock: ${availableItems[0].stock} remaining in ${availableItems[0].colors.join(', ')}).`,
          products: availableItems,
          actions,
          context: session.shoppingContext,
          recommendation: session.shoppingContext.activeRecommendation,
          upsell: session.shoppingContext.upsellSuggestion,
          cart: getCart(sessionId, 'agent')
        };
      } else {
        const first = activeProducts[0];
        return {
          sessionId,
          message: `The **${first.name}** is currently crafted in sizes **${first.sizes.join(', ')}**. Size **${targetSize}** is not in this production run.`,
          products: [first],
          actions,
          context: session.shoppingContext,
          recommendation: session.shoppingContext.activeRecommendation,
          upsell: session.shoppingContext.upsellSuggestion,
          cart: getCart(sessionId, 'agent')
        };
      }
    }
  }

  // =========================================================================
  // SCENARIO: Style & Narrowing Refinement ("Something more formal" / "Only formal ones")
  // =========================================================================
  if (
    (lowerMsg.includes('more formal') || lowerMsg.includes('something more formal') || lowerMsg.includes('casual ones') || lowerMsg === 'formal' || lowerMsg === 'formal ones') &&
    !lowerMsg.includes('shirt') && !lowerMsg.includes('jacket') && !lowerMsg.includes('kurta') && !lowerMsg.includes('dress')
  ) {
    const isFormal = lowerMsg.includes('formal');
    const targetGender = session.shoppingContext.gender;
    const targetCategory = session.shoppingContext.category === 'dresses' ? 'dresses' : session.shoppingContext.category;

    const searchRes = executeTool(
      'recommend_products',
      {
        query: isFormal ? 'formal silk evening' : 'casual',
        category: targetCategory,
        gender: targetGender
      },
      session,
      sessionId,
      collectedProducts,
      actions
    );

    let prods = (searchRes.productsFound || []).slice(0, 4);

    if (prods.length === 0) {
      const fallbackSearch = executeTool(
        'recommend_products',
        {
          gender: targetGender || 'women',
          query: 'silk formal'
        },
        session,
        sessionId,
        collectedProducts,
        actions
      );
      prods = (fallbackSearch.productsFound || []).slice(0, 4);
    }

    return {
      sessionId,
      message: `I refined our selection for more **formal handcrafted silhouettes**${targetGender ? ` for ${targetGender}` : ''}. Here are our elevated silk and tailored formal pieces:`,
      products: prods,
      actions,
      context: session.shoppingContext,
      recommendation: searchRes.recommendation,
      upsell: session.shoppingContext.upsellSuggestion,
      cart: getCart(sessionId, 'agent')
    };
  }

  // =========================================================================
  // GENERAL DISCOVERY & RECOMMENDATION QUERY
  // =========================================================================
  let maxPrice: number | undefined = undefined;
  const noCommaMsg = lowerMsg.replace(/,/g, '');
  const priceMatch = noCommaMsg.match(/(?:under|below|less than|within|budget\s+(?:of|is)?|₹|inr|rs\.?)\s*(\d{3,6})/i);
  if (priceMatch) maxPrice = parseInt(priceMatch[1], 10);

  let gender: string | undefined = undefined;
  if (lowerMsg.includes('men') || lowerMsg.includes("men's") || lowerMsg.includes('menswear') || lowerMsg.includes('bandhgala')) gender = 'men';
  if (lowerMsg.includes('women') || lowerMsg.includes("women's") || lowerMsg.includes('dress') || lowerMsg.includes('saree')) gender = 'women';
  if (lowerMsg.includes('unisex') || lowerMsg.includes('tote') || lowerMsg.includes('shawl')) gender = 'unisex';

  let category: string | undefined = undefined;
  if (lowerMsg.includes('dress') || lowerMsg.includes('dresses')) category = 'dresses';
  else if (lowerMsg.includes('jacket') || lowerMsg.includes('jackets') || lowerMsg.includes('bomber') || lowerMsg.includes('blazer') || lowerMsg.includes('bandhgala') || lowerMsg.includes('trench') || lowerMsg.includes('coat') || lowerMsg.includes('overshirt')) category = 'jackets';
  else if (lowerMsg.includes('shirt') || lowerMsg.includes('shirts')) category = lowerMsg.includes('formal') ? 'formal shirts' : 'shirts';
  else if (lowerMsg.includes('kurta') || lowerMsg.includes('kurtas')) category = 'kurtas';
  else if (lowerMsg.includes('saree') || lowerMsg.includes('sarees')) category = 'sarees';
  else if (lowerMsg.includes('tote') || lowerMsg.includes('tote bag') || (Boolean(lowerMsg.match(/\bbags?\b/i)) && !lowerMsg.includes('my bag') && !lowerMsg.includes('to bag') && !lowerMsg.includes('in bag') && !lowerMsg.includes('into bag') && !lowerMsg.includes('the bag'))) category = 'tote bags';
  else if (lowerMsg.includes('jean') || lowerMsg.includes('jeans') || lowerMsg.includes('denim')) category = 'jeans';

  let color: string | undefined = undefined;
  if (lowerMsg.includes('black') || lowerMsg.includes('obsidian') || lowerMsg.includes('midnight')) color = 'Black';
  if (lowerMsg.includes('white') || lowerMsg.includes('ecru') || lowerMsg.includes('ivory')) color = 'White';
  if (lowerMsg.includes('gold') || lowerMsg.includes('zari')) color = 'Gold';
  if (lowerMsg.includes('green') || lowerMsg.includes('sage') || lowerMsg.includes('emerald')) color = 'Green';
  if (lowerMsg.includes('indigo') || lowerMsg.includes('blue') || lowerMsg.includes('navy')) color = 'Blue';
  if (lowerMsg.includes('red') || lowerMsg.includes('crimson') || lowerMsg.includes('ruby')) color = 'Crimson';
  if (lowerMsg.includes('rose') || lowerMsg.includes('pink') || lowerMsg.includes('peach')) color = 'Rose';
  if (lowerMsg.includes('tan') || lowerMsg.includes('brown') || lowerMsg.includes('terracotta') || lowerMsg.includes('sand') || lowerMsg.includes('khaki')) color = 'Tan';

  let queryClean = userMessage
    .replace(/,/g, '')
    .replace(/(?:i need|show me|find me|looking for|under|below|less than|within|₹|inr|rs\.?|\b\d{3,6}\b|\ba\b|\ban\b|\bthe\b|\bone\b|\bones\b)/gi, '')
    .trim();

  if (category) {
    queryClean = queryClean.replace(new RegExp(`\\b${category}\\b`, 'gi'), '').replace(/dresses|shirts|jackets|kurtas|sarees|totes|jeans/gi, '').trim();
  }
  if (color) {
    queryClean = queryClean.replace(new RegExp(`\\b${color}\\b`, 'gi'), '').trim();
  }

  // Contextual refinement check: e.g. "Something in blue instead"
  const isColorRefinement = Boolean(lowerMsg.match(/\b(instead|different color|another color|in blue|in black|in red|in green|in white)\b/i)) && Boolean(color);
  const effectiveCategory = category || (isColorRefinement ? session.shoppingContext.category : category);
  const effectiveGender = gender || (isColorRefinement ? session.shoppingContext.gender : gender);
  const effectiveMaxPrice = maxPrice !== undefined ? maxPrice : (isColorRefinement ? session.shoppingContext.maxPrice : maxPrice);
  const effectiveColor = color;
  const effectiveOccasion = lowerMsg.includes('wedding') ? 'wedding' : (lowerMsg.includes('formal') ? 'formal' : (lowerMsg.includes('casual') ? 'casual' : undefined));

  const recRes = executeTool(
    'search_products',
    {
      query: queryClean || undefined,
      gender: effectiveGender,
      category: effectiveCategory,
      maxPrice: effectiveMaxPrice,
      color: effectiveColor,
      occasion: effectiveOccasion
    },
    session,
    sessionId,
    collectedProducts,
    actions
  );

  const products = (recRes.productsFound || []).slice(0, 4);

  if (products.length > 0) {
    const top = recRes.recommendation || {
      productId: products[0].id,
      productName: products[0].name,
      price: products[0].price,
      rating: products[0].rating,
      reason: `I curated ${products.length} artisanal pieces. My top recommendation is the **${products[0].name}** at ₹${products[0].price.toLocaleString('en-IN')} (${products[0].rating}★ rating, ${products[0].stock} in stock).`
    };

    const matchReasons: Record<string, string> = {};
    products.forEach((p) => {
      matchReasons[p.id] = generateProductMatchReason(p, session.shoppingContext, userMessage);
    });

    return {
      sessionId,
      message: top.reason,
      products,
      actions: ['search_products'],
      context: session.shoppingContext,
      recommendation: top,
      matchReasons,
      upsell: session.shoppingContext.upsellSuggestion,
      cart: getCart(sessionId, 'agent'),
      statusIndicator: 'ready'
    };
  }

  let notFoundMsg = "I couldn't find that item in the current Vastra.AI collection.";
  if (effectiveMaxPrice !== undefined && effectiveCategory) {
    notFoundMsg = `I searched our collection for handcrafted ${effectiveCategory}${effectiveGender ? ` for ${effectiveGender}` : ''} under ₹${effectiveMaxPrice.toLocaleString('en-IN')}, but our artisanal pieces in this collection start from ₹2,899 (and tailored formal shirts from ₹3,499). Would you like to explore our accessible options or adjust your budget?`;
  } else if (effectiveColor && effectiveCategory) {
    notFoundMsg = `I searched our ateliers for ${effectiveColor} ${effectiveCategory}, but we currently have no pieces in that exact combination. Would you like to explore other handcrafted tones in ${effectiveCategory}?`;
  }

  return {
    sessionId,
    message: notFoundMsg,
    products: [],
    actions: ['search_products'],
    context: session.shoppingContext,
    upsell: session.shoppingContext.upsellSuggestion,
    cart: getCart(sessionId, 'agent')
  };
}

/**
 * Handles incoming customer and agent shopping queries with Gemini and robust failure handling.
 */
export async function handleAgentMessage(request: AgentMessageRequest): Promise<AgentMessageResponse> {
  const sessionId = request.sessionId && request.sessionId.trim().length > 0
    ? request.sessionId.trim()
    : `sess_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  const session = getOrCreateSession(sessionId);

  // Synchronize customer identity and shipping address if present
  if (request.customerId) {
    session.customerId = request.customerId;
  }
  if (request.customerInfo) {
    session.customerInfo = { ...session.customerInfo, ...request.customerInfo };
    if (request.customerInfo.customerId) {
      session.customerId = request.customerInfo.customerId;
    }
  }
  if (request.shippingAddress) {
    session.shippingAddress = { ...session.shippingAddress, ...request.shippingAddress };
  }

  // Synchronize selection state if passed from client
  if (Array.isArray(request.selectedProductIds)) {
    session.selectedProductIds = request.selectedProductIds;
    session.shoppingContext.selectedProductIds = request.selectedProductIds;
  }
  if (Array.isArray(request.selectedItems)) {
    session.selectedItems = request.selectedItems;
    session.shoppingContext.selectedItems = request.selectedItems;
  }

  const userMessage = (request.message || '').trim();

  if (!userMessage) {
    return {
      sessionId,
      message: "Welcome to Vastra.AI. How may I assist your style discovery today?",
      products: [],
      actions: [],
      context: session.shoppingContext,
      recommendation: session.shoppingContext.activeRecommendation,
      upsell: session.shoppingContext.upsellSuggestion,
      selectedProductIds: session.selectedProductIds,
      selectedItems: session.selectedItems,
      cart: getCart(sessionId, 'agent')
    };
  }

  session.lastToolCall = undefined;
  session.lastToolResult = undefined;

  // Check for explicit customer request to transition from AI to manual shopping
  const lowerMsg = userMessage.toLowerCase();
  if (
    lowerMsg.includes('shop manually') ||
    lowerMsg.includes('continue without ai') ||
    lowerMsg.includes('switch to manual') ||
    lowerMsg.includes('manual shopping') ||
    lowerMsg.includes('take me to the product page') ||
    lowerMsg.includes('take me to the shop')
  ) {
    clearAiCheckoutSession(sessionId);
    const manualResp: AgentMessageResponse = {
      sessionId,
      message: "Understood. Switching you to our manual storefront where you can browse and purchase independently.",
      products: [],
      actions: ['switch_to_manual'],
      context: session.shoppingContext,
      selectedProductIds: session.selectedProductIds,
      selectedItems: session.selectedItems,
      cart: getCart(sessionId, 'agent')
    };
    logAgentDiagnostic({
      rawMessage: userMessage,
      toolCall: undefined,
      toolResult: undefined,
      finalReply: manualResp.message
    });
    return manualResp;
  }

  const intent = extractShoppingIntent(userMessage, session.shoppingContext);

  // Deterministic actions that must be fast, accurate, and execute business logic directly:
  const isDeterministicAction =
    !isClaudeConfigured() ||
    intent.isImpossibleItem ||
    Boolean(intent.category || intent.productKeyword) ||
    intent.action === 'view_cart' ||
    intent.action === 'add_to_bag' ||
    intent.action === 'remove_from_cart' ||
    intent.action === 'update_quantity' ||
    intent.action === 'clear_cart' ||
    intent.action === 'prepare_checkout' ||
    intent.action === 'cancel' ||
    intent.action === 'complete_look' ||
    intent.action === 'check_size' ||
    Boolean(session.shoppingContext.pendingClearCartConfirmation) ||
    Boolean(userMessage.toLowerCase().match(/(?:checkout|buy\s+it|buy|confirm|confirm\s+order|confirm\s+and\s+pay|pay\s+now|what\s+is\s+in\s+my\s+bag|what's\s+in\s+my\s+bag|add\s+|remove\s+|the\s+second\s+one|the\s+2nd\s+one|the\s+first\s+one|second\s+one|2nd\s+one|buy\s+(?:both|these|these\s+two|all|the\s+two|selected|the\s+first|the\s+second|the\s+third|this\s+one|this|2|two)|buy\s+(?:2|two)\s+of\s+this|and\s+(?:the\s+)?(?:third|second|last|fourth|1st|2nd|3rd)\s+one|actually\s+remove|remove\s+the\s+first|first\s+and\s+third|1st\s+and\s+3rd|blue\s+one)/i));

  if (isDeterministicAction) {
    const response = handleDeterministicConcierge(userMessage, session, sessionId);
    if (response.products.length > 0) {
      session.displayedProductIds = response.products.map((p) => p.id);
      session.lastProducts = response.products;
    }
    session.lastMessage = userMessage;
    response.selectedProductIds = session.selectedProductIds;
    response.selectedItems = session.selectedItems;
    logAgentDiagnostic({
      rawMessage: userMessage,
      toolCall: session.lastToolCall,
      toolResult: session.lastToolResult,
      finalReply: response.message
    });
    return response;
  }

  try {
    // 1. Query real SQLite products deterministically before calling Claude
    const recResult = recommendProducts({
      query: userMessage,
      category: intent.category || session.shoppingContext.category,
      gender: intent.gender || session.shoppingContext.gender,
      color: intent.color || session.shoppingContext.color,
      maxPrice: intent.maxPrice || session.shoppingContext.maxPrice || 10000,
      limit: 4
    });

    const candidates = recResult.products;
    session.lastToolCall = {
      name: 'search_products',
      params: {
        category: intent.category || session.shoppingContext.category,
        gender: intent.gender || session.shoppingContext.gender,
        color: intent.color || session.shoppingContext.color,
        maxPrice: intent.maxPrice || session.shoppingContext.maxPrice,
        query: userMessage
      }
    };
    session.lastToolResult = {
      count: candidates.length,
      products: candidates
    };

    // 2. Call Claude Sonnet 5 with strictly grounded catalog candidates
    const claudeResponse = await generateClaudeStylistResponse({
      userMessage,
      candidateProducts: candidates,
      currentCart: getCart(sessionId, 'agent'),
      context: session.shoppingContext,
      history: session.history
    });

    if (claudeResponse.success && claudeResponse.message) {
      session.history.push({ role: 'user', content: userMessage });
      session.history.push({ role: 'assistant', content: claudeResponse.message });
      if (session.history.length > MAX_HISTORY_TURNS + 4) {
        session.history = session.history.slice(-MAX_HISTORY_TURNS);
      }

      if (candidates.length > 0) {
        session.displayedProductIds = candidates.map((p) => p.id);
        session.lastProducts = candidates;
      }
      session.lastMessage = userMessage;

      const claudeRes = {
        sessionId,
        message: claudeResponse.message,
        products: candidates.length > 0 ? candidates : session.lastProducts,
        actions: ['search_products'],
        context: session.shoppingContext,
        recommendation: recResult.topRecommendation,
        cart: getCart(sessionId, 'agent')
      };

      logAgentDiagnostic({
        rawMessage: userMessage,
        toolCall: session.lastToolCall,
        toolResult: session.lastToolResult,
        finalReply: claudeRes.message
      });

      return claudeRes;
    }

    // Fallback to deterministic concierge if Claude returned empty
    const fallbackResponse = handleDeterministicConcierge(userMessage, session, sessionId);
    if (fallbackResponse.products.length > 0) {
      session.displayedProductIds = fallbackResponse.products.map((p) => p.id);
      session.lastProducts = fallbackResponse.products;
    }
    session.lastMessage = userMessage;
    logAgentDiagnostic({
      rawMessage: userMessage,
      toolCall: session.lastToolCall,
      toolResult: session.lastToolResult,
      finalReply: fallbackResponse.message
    });
    return fallbackResponse;
  } catch (error: any) {
    console.error('[AgentService] Claude processing error, fallback to concierge:', error?.message || error);
    logAuditEvent({
      sessionId,
      channel: 'agent',
      action: 'tool_failure',
      details: { error: 'Claude service unreachable, engaging fallback concierge' },
      outcome: 'failure'
    });
    const fallbackResponse = handleDeterministicConcierge(userMessage, session, sessionId);
    if (fallbackResponse.products.length > 0) {
      session.displayedProductIds = fallbackResponse.products.map((p) => p.id);
      session.lastProducts = fallbackResponse.products;
    }
    session.lastMessage = userMessage;
    logAgentDiagnostic({
      rawMessage: userMessage,
      toolCall: session.lastToolCall,
      toolResult: session.lastToolResult,
      finalReply: fallbackResponse.message
    });
    return fallbackResponse;
  }
}

export default {
  handleAgentMessage,
  getOrCreateSession,
  prepareCheckout,
  confirmAgentCheckout
};
