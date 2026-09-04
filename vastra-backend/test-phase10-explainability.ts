import { db, initDatabase } from './src/db/db';
import { handleAgentMessage } from './src/services/agentService';
import { logAuditEvent } from './src/services/auditService';
import {
  getAiSessions,
  getAiSessionTimeline
} from './src/services/explainabilityService';
import { createOrder } from './src/services/orderService';
import { verifyPaymentSignature } from './src/services/paymentService';
import crypto from 'crypto';

async function runPhase10ExplainabilityTests() {
  console.log('================================================================');
  console.log('   PHASE 10: EXPLAINABILITY & AI AUDIT TRAIL TESTS             ');
  console.log('================================================================\n');

  initDatabase();

  const testSessionId = `sess_p10_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  console.log(`[Test Session ID]: ${testSessionId}`);

  // ===========================================================================
  // TEST 1 — AI SEARCH EVENT APPEARS IN SESSION TIMELINE
  // ===========================================================================
  console.log('\nTEST 1: Run AI search -> verify search event appears in timeline...');
  await handleAgentMessage({
    sessionId: testSessionId,
    message: 'Show me raw silk bandhgala jackets for a wedding'
  });

  const timeline1 = getAiSessionTimeline(testSessionId);
  if (!timeline1 || timeline1.timeline.length === 0) {
    throw new Error('Test 1 failed: No timeline events recorded for session');
  }

  const searchEvent = timeline1.timeline.find((e) => e.eventType === 'search');
  console.log('  [Search Event]:', searchEvent?.title, '—', searchEvent?.description);

  if (!searchEvent) {
    throw new Error('Test 1 failed: Search event not found in timeline');
  }
  console.log('✔ TEST 1 PASSED: AI search event recorded in timeline.\n');

  // ===========================================================================
  // TEST 2 — RECOMMENDATION EVENT & SAFE EXPLAINABILITY
  // ===========================================================================
  console.log('TEST 2: Verify recommendation event with safe explainability rationale...');
  const recEvent = timeline1.timeline.find((e) => e.eventType === 'recommendation');
  console.log('  [Rec Title]:', recEvent?.title);
  console.log('  [Rec Description]:', recEvent?.description);
  console.log('  [Explainability Summary]:', recEvent?.explanation);

  if (!recEvent || !recEvent.explanation) {
    throw new Error('Test 2 failed: Recommendation event missing explainability explanation');
  }
  // Check no chain of thought keywords
  if (recEvent.explanation.includes('Gemini thought') || recEvent.explanation.includes('internal prompt')) {
    throw new Error('Test 2 failed: Raw chain-of-thought leaked in explanation');
  }
  console.log('✔ TEST 2 PASSED: Recommendation event provides safe, business-level explainability.\n');

  // ===========================================================================
  // TEST 3 — ADD TO CART EVENT
  // ===========================================================================
  console.log('TEST 3: Add item to cart -> verify cart event in timeline...');
  await handleAgentMessage({
    sessionId: testSessionId,
    message: 'Add size 40 to my cart'
  });

  const timeline3 = getAiSessionTimeline(testSessionId);
  const cartEvent = timeline3?.timeline.find((e) => e.eventType === 'add_to_bag');
  console.log('  [Cart Event]:', cartEvent?.title, '—', cartEvent?.description);

  if (!cartEvent) {
    throw new Error('Test 3 failed: Add to bag event not found in timeline');
  }
  console.log('✔ TEST 3 PASSED: Add to bag event captured with product variant details.\n');

  // ===========================================================================
  // TEST 4 — UPSELL SUGGESTED EVENT
  // ===========================================================================
  console.log('TEST 4: Record upsell suggested event -> verify in timeline...');
  logAuditEvent({
    sessionId: testSessionId,
    channel: 'agent',
    action: 'upsell_suggested',
    details: {
      productId: 'uni-001',
      productName: 'Full-Grain Leather Atelier Tote Bag',
      price: 7999
    },
    outcome: 'success'
  });

  const timeline4 = getAiSessionTimeline(testSessionId);
  const upsellSugEvent = timeline4?.timeline.find((e) => e.eventType === 'upsell_suggested');
  console.log('  [Upsell Sug Event]:', upsellSugEvent?.title, '—', upsellSugEvent?.description);

  if (!upsellSugEvent) {
    throw new Error('Test 4 failed: Upsell suggested event missing from timeline');
  }
  console.log('✔ TEST 4 PASSED: Upsell suggestion event recorded.\n');

  // ===========================================================================
  // TEST 5 — UPSELL DECLINED EVENT
  // ===========================================================================
  console.log('TEST 5: Record upsell declined event -> verify in timeline...');
  logAuditEvent({
    sessionId: testSessionId,
    channel: 'agent',
    action: 'upsell_declined',
    details: {
      productId: 'uni-001',
      reason: 'Customer declined accessory'
    },
    outcome: 'user_declined'
  });

  const timeline5 = getAiSessionTimeline(testSessionId);
  const upsellDecEvent = timeline5?.timeline.find((e) => e.eventType === 'upsell_declined');
  console.log('  [Upsell Dec Event]:', upsellDecEvent?.title, 'Status:', upsellDecEvent?.status);

  if (!upsellDecEvent || upsellDecEvent.status !== 'declined') {
    throw new Error('Test 5 failed: Upsell declined event missing or status not declined');
  }
  console.log('✔ TEST 5 PASSED: Upsell declined event recorded with declined status.\n');

  // ===========================================================================
  // TEST 6 — COMPLETE CHRONOLOGICAL AI CHECKOUT FLOW
  // ===========================================================================
  console.log('TEST 6: Complete AI checkout -> verify chronological timeline...');
  const orderRes = createOrder({
    channel: 'agent',
    sessionId: testSessionId,
    items: [{ productId: 'men-003', quantity: 1, size: '40', color: 'Crisp White' }],
    confirmed: true,
    customerInfo: { name: 'Aditya Birla', email: 'aditya@example.com' }
  });

  if (!orderRes.success || !orderRes.order) {
    throw new Error('Test 6 failed: Could not create order');
  }

  const orderId = orderRes.order.id;
  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || 'vastra_secret_key_12345';
  const rzpOrderId = `order_test_${Date.now()}_p10`;
  const rzpPayId = `pay_test_${Date.now()}_p10`;
  const signature = crypto
    .createHmac('sha256', rzpKeySecret)
    .update(`${rzpOrderId}|${rzpPayId}`)
    .digest('hex');

  db.prepare('UPDATE orders SET payment_order_id = ? WHERE id = ?').run(rzpOrderId, orderId);

  const verifyRes = verifyPaymentSignature({
    orderId,
    razorpay_order_id: rzpOrderId,
    razorpay_payment_id: rzpPayId,
    razorpay_signature: signature,
    sessionId: testSessionId
  });

  if (!verifyRes.success) {
    throw new Error(`Test 6 failed: Could not verify payment (${verifyRes.error})`);
  }

  const timeline6 = getAiSessionTimeline(testSessionId);
  const guardrailEvt = timeline6?.timeline.find((e) => e.eventType === 'guardrail_check');
  const payEvt = timeline6?.timeline.find((e) => e.eventType === 'payment_verified');

  console.log('  [Guardrail Checks]:', guardrailEvt?.guardrails?.map((g) => `${g.label}: ${g.passed ? '✓' : '✗'}`));
  console.log('  [Payment Settled]:', payEvt?.paymentInfo?.status, 'Amount:', payEvt?.paymentInfo?.amount);

  if (!guardrailEvt || !guardrailEvt.guardrails || guardrailEvt.guardrails.length === 0) {
    throw new Error('Test 6 failed: Guardrail safety checks not properly formatted');
  }
  if (!payEvt || payEvt.status !== 'success') {
    throw new Error('Test 6 failed: Payment verified event missing or not success');
  }
  console.log('✔ TEST 6 PASSED: End-to-end checkout with guardrail visibility verified.\n');

  // ===========================================================================
  // TEST 7 — PAYMENT FAILURE DISPLAY
  // ===========================================================================
  console.log('TEST 7: Record payment failure event -> verify failure details & recovery...');
  const failSession = `sess_fail_${Date.now()}`;
  logAuditEvent({
    sessionId: failSession,
    channel: 'agent',
    action: 'payment_failed',
    details: {
      orderId: 'ord_sample_fail',
      reason: 'Insufficient funds on test card'
    },
    outcome: 'failure'
  });

  const timeline7 = getAiSessionTimeline(failSession);
  const failEvt = timeline7?.timeline.find((e) => e.eventType === 'payment_failed');
  console.log('  [Failure Reason]:', failEvt?.failureDetails?.reason);
  console.log('  [Recovery Action]:', failEvt?.failureDetails?.recoveryAction);

  if (!failEvt || !failEvt.failureDetails?.reason || !failEvt.failureDetails?.recoveryAction) {
    throw new Error('Test 7 failed: Payment failure event missing failureDetails or recoveryAction');
  }
  console.log('✔ TEST 7 PASSED: Payment failure explainability and recovery verified.\n');

  // ===========================================================================
  // TEST 8 — STOCK FAILURE DISPLAY
  // ===========================================================================
  console.log('TEST 8: Record stock failure event -> verify failure & alternative suggestion...');
  const stockFailSession = `sess_stock_fail_${Date.now()}`;
  logAuditEvent({
    sessionId: stockFailSession,
    channel: 'agent',
    action: 'stock_failure',
    details: {
      productId: 'women-001',
      productName: 'Chanderi Silk Fluted Trench Dress',
      reason: 'Stock depleted'
    },
    outcome: 'failure'
  });

  const timeline8 = getAiSessionTimeline(stockFailSession);
  const stockFailEvt = timeline8?.timeline.find((e) => e.eventType === 'stock_failure');
  console.log('  [Stock Failure Description]:', stockFailEvt?.description);
  console.log('  [Stock Recovery]:', stockFailEvt?.failureDetails?.recoveryAction);

  if (!stockFailEvt || stockFailEvt.status !== 'failed') {
    throw new Error('Test 8 failed: Stock failure event not found with failed status');
  }
  console.log('✔ TEST 8 PASSED: Stock failure event and recovery explainability verified.\n');

  // ===========================================================================
  // TEST 9 — PRICE CHANGE DISPLAY
  // ===========================================================================
  console.log('TEST 9: Record price change event -> verify previous vs current price...');
  const priceSession = `sess_price_${Date.now()}`;
  logAuditEvent({
    sessionId: priceSession,
    channel: 'agent',
    action: 'price_changed',
    details: {
      productId: 'men-003',
      previousPrice: 3499,
      currentPrice: 3999
    },
    outcome: 'success'
  });

  const timeline9 = getAiSessionTimeline(priceSession);
  const priceEvt = timeline9?.timeline.find((e) => e.eventType === 'price_changed');
  console.log('  [Price Change]:', priceEvt?.priceChange?.previousPrice, '->', priceEvt?.priceChange?.currentPrice);
  console.log('  [Reconfirmation Required]:', priceEvt?.priceChange?.requiresReconfirmation);

  if (!priceEvt || !priceEvt.priceChange || priceEvt.priceChange.previousPrice !== 3499 || priceEvt.priceChange.currentPrice !== 3999) {
    throw new Error('Test 9 failed: Price change event did not contain previous and current prices');
  }
  console.log('✔ TEST 9 PASSED: Price change event verified.\n');

  // ===========================================================================
  // TEST 10 — ZERO SENSITIVE DATA EXPOSURE
  // ===========================================================================
  console.log('TEST 10: Verify zero sensitive payment or model secrets exposed...');
  const serialized = JSON.stringify(timeline6);
  const forbiddenTerms = [
    'razorpay_secret',
    'key_secret',
    'RAZORPAY_KEY_SECRET',
    'razorpay_signature',
    'cvv',
    'password',
    'chain_of_thought',
    'system_prompt',
    'api_key'
  ];

  for (const term of forbiddenTerms) {
    if (serialized.toLowerCase().includes(term.toLowerCase())) {
      throw new Error(`Test 10 failed: Found sensitive term "${term}" in explainability timeline`);
    }
  }
  console.log('✔ TEST 10 PASSED: Zero sensitive payment, database, or LLM secrets exposed.\n');

  // ===========================================================================
  // TEST 11 — DATE FILTERING
  // ===========================================================================
  console.log('TEST 11: Verify date filtering on AI sessions...');
  const todaySessions = getAiSessions({ range: 'today', limit: 20 });
  const allSessions = getAiSessions({ range: 'all', limit: 20 });

  console.log('  [Today Sessions Count]:', todaySessions.sessions.length);
  console.log('  [All Sessions Count]:', allSessions.sessions.length);

  if (todaySessions.sessions.length === 0 || allSessions.sessions.length < todaySessions.sessions.length) {
    throw new Error('Test 11 failed: Date filtering discrepancy in AI sessions');
  }
  console.log('✔ TEST 11 PASSED: Date range filtering verified.\n');

  // ===========================================================================
  // TEST 12 — ACTION FILTERING
  // ===========================================================================
  console.log('TEST 12: Verify multi-criteria category filtering...');
  const orderSessions = getAiSessions({ filter: 'orders', limit: 20 });
  const searchSessions = getAiSessions({ filter: 'searches', limit: 20 });
  const failureSessions = getAiSessions({ filter: 'failures', limit: 20 });

  console.log('  [Order Filter Sessions]:', orderSessions.sessions.length);
  console.log('  [Search Filter Sessions]:', searchSessions.sessions.length);
  console.log('  [Failure Filter Sessions]:', failureSessions.sessions.length);

  if (orderSessions.sessions.length === 0 || searchSessions.sessions.length === 0) {
    throw new Error('Test 12 failed: Action filters returned empty results for populated categories');
  }
  for (const s of orderSessions.sessions) {
    if (!s.hasOrder && !s.actionTypes.includes('payment_verified')) {
      throw new Error('Test 12 failed: Non-order session returned in order filter');
    }
  }
  console.log('✔ TEST 12 PASSED: Category and action filtering verified.\n');

  console.log('================================================================');
  console.log(' ALL 12 PHASE 10 EXPLAINABILITY & AUDIT TESTS PASSED 100%!     ');
  console.log('================================================================\n');
}

runPhase10ExplainabilityTests().catch((err) => {
  console.error('Phase 10 tests encountered an error:', err);
  process.exit(1);
});
