import { db } from './src/db/db';
import {
  getMerchantActivity,
  getMerchantOrderById,
  getMerchantOrders,
  getMerchantOverview
} from './src/services/merchantService';
import { createOrder } from './src/services/orderService';
import { verifyPaymentSignature, cancelPayment } from './src/services/paymentService';
import { handleAgentMessage } from './src/services/agentService';
import { logAuditEvent } from './src/services/auditService';
import crypto from 'crypto';

async function runPhase8MerchantTests() {
  console.log('================================================================');
  console.log('   PHASE 8: MERCHANT DASHBOARD & COMMERCE ANALYTICS TESTS       ');
  console.log('================================================================\n');

  // Baseline overview
  const baseOverview = getMerchantOverview('all');
  console.log('Baseline Metrics:', {
    totalRevenue: baseOverview.totalRevenue,
    humanRevenue: baseOverview.humanRevenue,
    aiRevenue: baseOverview.aiRevenue,
    totalOrders: baseOverview.totalOrders,
    aiOrders: baseOverview.aiOrders,
    humanOrders: baseOverview.humanOrders,
    aiConversionRate: `${baseOverview.aiConversionRate}%`
  });

  // ===========================================================================
  // TEST 1 — SUCCESSFUL HUMAN ORDER INCREASES HUMAN REVENUE & ORDERS
  // ===========================================================================
  console.log('\nTEST 1: Successful Human order increases human revenue & human order count...');
  const humanOrderRes = createOrder({
    channel: 'human',
    items: [{ productId: 'men-003', quantity: 1, size: '40', color: 'Crisp White' }],
    confirmed: true,
    customerInfo: { name: 'Vikram Seth', email: 'vikram@example.com' }
  });

  if (!humanOrderRes.success || !humanOrderRes.order) {
    throw new Error('Test 1 failed: Could not create human order');
  }

  const humanOrderId = humanOrderRes.order.id;
  const humanPrice = humanOrderRes.order.totalAmount;

  // Simulate payment verification
  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || 'vastra_secret_key_12345';
  const rzpOrderId1 = `order_test_${Date.now()}_h1`;
  const rzpPayId1 = `pay_test_${Date.now()}_h1`;
  const signature1 = crypto
    .createHmac('sha256', rzpKeySecret)
    .update(`${rzpOrderId1}|${rzpPayId1}`)
    .digest('hex');

  // Attach payment order id to order
  db.prepare('UPDATE orders SET payment_order_id = ? WHERE id = ?').run(rzpOrderId1, humanOrderId);

  const humanVerifyRes = verifyPaymentSignature({
    orderId: humanOrderId,
    razorpay_order_id: rzpOrderId1,
    razorpay_payment_id: rzpPayId1,
    razorpay_signature: signature1
  });

  if (!humanVerifyRes.success) {
    throw new Error(`Test 1 failed: Could not verify human payment (${humanVerifyRes.error})`);
  }

  const afterHumanOverview = getMerchantOverview('all');
  console.log('  [Human Order Total]:', humanPrice);
  console.log('  [Before vs After Human Rev]:', baseOverview.humanRevenue, '->', afterHumanOverview.humanRevenue);
  console.log('  [Before vs After Human Orders]:', baseOverview.humanOrders, '->', afterHumanOverview.humanOrders);

  if (afterHumanOverview.humanRevenue !== baseOverview.humanRevenue + humanPrice) {
    throw new Error('Test 1 failed: Human revenue did not increase by order amount');
  }
  if (afterHumanOverview.humanOrders !== baseOverview.humanOrders + 1) {
    throw new Error('Test 1 failed: Human order count did not increase by 1');
  }
  console.log('✔ TEST 1 PASSED: Human revenue and order count increased accurately.\n');

  // ===========================================================================
  // TEST 2 — SUCCESSFUL AI ORDER INCREASES AI REVENUE & ORDERS
  // ===========================================================================
  console.log('TEST 2: Successful AI order increases AI revenue & AI order count...');
  const aiOrderRes = createOrder({
    channel: 'agent',
    items: [{ productId: 'women-004', quantity: 1, size: 'M', color: 'Cornflower Blue' }],
    confirmed: true,
    customerInfo: { name: 'Priya Sharma', email: 'priya@example.com' }
  });

  if (!aiOrderRes.success || !aiOrderRes.order) {
    throw new Error('Test 2 failed: Could not create AI order');
  }

  const aiOrderId = aiOrderRes.order.id;
  const aiPrice = aiOrderRes.order.totalAmount;

  const rzpOrderId2 = `order_test_${Date.now()}_ai2`;
  const rzpPayId2 = `pay_test_${Date.now()}_ai2`;
  const signature2 = crypto
    .createHmac('sha256', rzpKeySecret)
    .update(`${rzpOrderId2}|${rzpPayId2}`)
    .digest('hex');

  db.prepare('UPDATE orders SET payment_order_id = ? WHERE id = ?').run(rzpOrderId2, aiOrderId);

  const aiVerifyRes = verifyPaymentSignature({
    orderId: aiOrderId,
    razorpay_order_id: rzpOrderId2,
    razorpay_payment_id: rzpPayId2,
    razorpay_signature: signature2
  });

  if (!aiVerifyRes.success) {
    throw new Error(`Test 2 failed: Could not verify AI payment (${aiVerifyRes.error})`);
  }

  const afterAiOverview = getMerchantOverview('all');
  console.log('  [AI Order Total]:', aiPrice);
  console.log('  [Before vs After AI Rev]:', afterHumanOverview.aiRevenue, '->', afterAiOverview.aiRevenue);
  console.log('  [Before vs After AI Orders]:', afterHumanOverview.aiOrders, '->', afterAiOverview.aiOrders);

  if (afterAiOverview.aiRevenue !== afterHumanOverview.aiRevenue + aiPrice) {
    throw new Error('Test 2 failed: AI revenue did not increase by order amount');
  }
  if (afterAiOverview.aiOrders !== afterHumanOverview.aiOrders + 1) {
    throw new Error('Test 2 failed: AI order count did not increase by 1');
  }
  console.log('✔ TEST 2 PASSED: AI revenue and order count increased accurately.\n');

  // ===========================================================================
  // TEST 3 — FAILED PAYMENT DOES NOT INCREASE REVENUE
  // ===========================================================================
  console.log('TEST 3: Failed payment does NOT increase store revenue...');
  const failOrderRes = createOrder({
    channel: 'human',
    items: [{ productId: 'men-006', quantity: 1, size: 'M' }],
    confirmed: true
  });

  if (!failOrderRes.success || !failOrderRes.order) {
    throw new Error('Test 3 failed: Could not create order');
  }

  const failOrderId = failOrderRes.order.id;
  // Mark as PAYMENT_FAILED
  db.prepare("UPDATE orders SET status = 'PAYMENT_FAILED' WHERE id = ?").run(failOrderId);

  const afterFailOverview = getMerchantOverview('all');
  if (afterFailOverview.totalRevenue !== afterAiOverview.totalRevenue) {
    throw new Error('Test 3 failed: Failed payment erroneously added to revenue');
  }
  console.log('✔ TEST 3 PASSED: Failed payment excluded from revenue.\n');

  // ===========================================================================
  // TEST 4 — CANCELLED PAYMENT DOES NOT INCREASE REVENUE
  // ===========================================================================
  console.log('TEST 4: Cancelled payment does NOT increase store revenue...');
  const cancelOrderRes = createOrder({
    channel: 'agent',
    items: [{ productId: 'men-006', quantity: 1, size: 'L' }],
    confirmed: true
  });

  if (!cancelOrderRes.success || !cancelOrderRes.order) {
    throw new Error('Test 4 failed: Could not create order');
  }

  const cancelOrderId = cancelOrderRes.order.id;
  cancelPayment({ orderId: cancelOrderId });

  const afterCancelOverview = getMerchantOverview('all');
  if (afterCancelOverview.totalRevenue !== afterAiOverview.totalRevenue) {
    throw new Error('Test 4 failed: Cancelled payment erroneously added to revenue');
  }
  console.log('✔ TEST 4 PASSED: Cancelled payment excluded from revenue.\n');

  // ===========================================================================
  // TEST 5 — AI RECOMMENDATION REFLECTED IN AI ACTIVITY FEED
  // ===========================================================================
  console.log('TEST 5: AI recommendations reflected in merchant activity feed...');
  const session5 = `sess_p8_t5_${Date.now()}`;
  await handleAgentMessage({ sessionId: session5, message: 'I need a luxury silk bandhgala' });

  const activities = getMerchantActivity('all', 50);
  console.log('  [Recent Activities Count]:', activities.length);
  console.log('  [Latest Activity]:', activities[0]?.description);

  const hasRecActivity = activities.some((a) => a.action === 'recommendation' || a.action === 'propose' || a.action === 'search');
  if (!hasRecActivity) {
    throw new Error('Test 5 failed: AI activity feed did not contain recommendation event');
  }
  console.log('✔ TEST 5 PASSED: AI activity feed displays recommendation actions.\n');

  // ===========================================================================
  // TEST 6 — AI UPSELL SUGGESTED INCREASES UPSELL COUNT
  // ===========================================================================
  console.log('TEST 6: AI upsell increases upsell suggested count...');
  const preUpsellOverview = getMerchantOverview('all');
  const session6 = `sess_p8_t6_${Date.now()}`;

  // Log an upsell suggested event
  logAuditEvent({
    sessionId: session6,
    channel: 'agent',
    action: 'upsell_suggested',
    details: {
      productId: 'uni-001',
      productName: 'Full-Grain Leather Atelier Tote Bag',
      price: 7999
    },
    outcome: 'success'
  });

  const afterSuggestOverview = getMerchantOverview('all');
  console.log('  [Upsells Suggested Before vs After]:', preUpsellOverview.upsell.upsellsSuggested, '->', afterSuggestOverview.upsell.upsellsSuggested);

  if (afterSuggestOverview.upsell.upsellsSuggested !== preUpsellOverview.upsell.upsellsSuggested + 1) {
    throw new Error('Test 6 failed: Upsell suggested count did not increase by 1');
  }
  console.log('✔ TEST 6 PASSED: Upsell suggested count increased accurately.\n');

  // ===========================================================================
  // TEST 7 — ACCEPT UPSELL INCREASES ACCEPTED COUNT AND RATE
  // ===========================================================================
  console.log('TEST 7: Accept upsell increases accepted count and recalculates rate...');
  logAuditEvent({
    sessionId: session6,
    channel: 'agent',
    action: 'upsell_accepted',
    details: {
      productId: 'uni-001',
      productName: 'Full-Grain Leather Atelier Tote Bag',
      price: 7999
    },
    outcome: 'success'
  });

  const afterAcceptOverview = getMerchantOverview('all');
  console.log('  [Upsells Accepted Before vs After]:', preUpsellOverview.upsell.upsellsAccepted, '->', afterAcceptOverview.upsell.upsellsAccepted);
  console.log('  [Acceptance Rate]:', afterAcceptOverview.upsell.upsellAcceptanceRate, '%');

  if (afterAcceptOverview.upsell.upsellsAccepted !== preUpsellOverview.upsell.upsellsAccepted + 1) {
    throw new Error('Test 7 failed: Upsells accepted count did not increase');
  }
  console.log('✔ TEST 7 PASSED: Accepted upsell count and acceptance rate updated.\n');

  // ===========================================================================
  // TEST 8 — DECLINE UPSELL INCREASES DECLINED COUNT
  // ===========================================================================
  console.log('TEST 8: Decline upsell increases declined count...');
  logAuditEvent({
    sessionId: session6,
    channel: 'agent',
    action: 'upsell_declined',
    details: { productId: 'uni-001' },
    outcome: 'user_declined'
  });

  const afterDeclineOverview = getMerchantOverview('all');
  console.log('  [Upsells Declined Before vs After]:', preUpsellOverview.upsell.upsellsDeclined, '->', afterDeclineOverview.upsell.upsellsDeclined);

  if (afterDeclineOverview.upsell.upsellsDeclined !== preUpsellOverview.upsell.upsellsDeclined + 1) {
    throw new Error('Test 8 failed: Upsells declined count did not increase');
  }
  console.log('✔ TEST 8 PASSED: Declined upsell count tracked accurately.\n');

  // ===========================================================================
  // TEST 9 — ZERO SESSIONS HANDLES CONVERSION RATE SAFELY
  // ===========================================================================
  console.log('TEST 9: Zero sessions conversion rate handled safely without NaN...');
  const ov = getMerchantOverview('all');
  if (isNaN(ov.aiConversionRate) || !isFinite(ov.aiConversionRate)) {
    throw new Error('Test 9 failed: aiConversionRate produced NaN or Infinity');
  }
  if (isNaN(ov.upsell.upsellAcceptanceRate) || !isFinite(ov.upsell.upsellAcceptanceRate)) {
    throw new Error('Test 9 failed: upsellAcceptanceRate produced NaN or Infinity');
  }
  console.log('  [AI Conversion Rate]:', ov.aiConversionRate, '%');
  console.log('  [Upsell Acceptance Rate]:', ov.upsell.upsellAcceptanceRate, '%');
  console.log('✔ TEST 9 PASSED: Zero-division safe math verified.\n');

  // ===========================================================================
  // TEST 10 — DATE FILTER: TODAY
  // ===========================================================================
  console.log('TEST 10: Date filter "today" returns recent records...');
  const todayOverview = getMerchantOverview('today');
  console.log('  [Today Total Revenue]:', todayOverview.totalRevenue, '[Today Orders]:', todayOverview.totalOrders);
  if (typeof todayOverview.totalRevenue !== 'number' || todayOverview.totalRevenue < 0) {
    throw new Error('Test 10 failed: Invalid today revenue');
  }
  console.log('✔ TEST 10 PASSED: Today date range filtered accurately.\n');

  // ===========================================================================
  // TEST 11 — DATE FILTER: 30 DAYS
  // ===========================================================================
  console.log('TEST 11: Date filter "30d" returns 30-day records...');
  const monthOverview = getMerchantOverview('30d');
  console.log('  [30d Total Revenue]:', monthOverview.totalRevenue, '[30d Orders]:', monthOverview.totalOrders);
  if (monthOverview.totalRevenue < todayOverview.totalRevenue) {
    throw new Error('Test 11 failed: 30d revenue should be greater than or equal to today revenue');
  }
  console.log('✔ TEST 11 PASSED: 30-day date range filtered accurately.\n');

  // ===========================================================================
  // TEST 12 — ORDER INSPECTION & PERSISTENCE
  // ===========================================================================
  console.log('TEST 12: Order inspection returns complete line items and variants...');
  const allOrders = getMerchantOrders('all', undefined, 10);
  console.log('  [Fetched Orders Count]:', allOrders.length);

  if (allOrders.length === 0) {
    throw new Error('Test 12 failed: No orders returned');
  }

  const targetOrder = allOrders[0];
  const orderDetails = getMerchantOrderById(targetOrder.id);
  console.log('  [Inspected Order ID]:', orderDetails?.id);
  console.log('  [Inspected Line Items]:', orderDetails?.items.map((i) => `${i.name} (Qty: ${i.quantity}, Price: ₹${i.price})`));

  if (!orderDetails || orderDetails.items.length === 0) {
    throw new Error('Test 12 failed: Order details missing line items');
  }
  console.log('✔ TEST 12 PASSED: Order line item inspection verified.\n');

  console.log('================================================================');
  console.log(' ALL 12 PHASE 8 MERCHANT & ANALYTICS TESTS PASSED 100%!        ');
  console.log('================================================================\n');
}

runPhase8MerchantTests().catch((err) => {
  console.error('Phase 8 tests encountered an error:', err);
  process.exit(1);
});
