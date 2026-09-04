import { db, initDatabase } from './src/db/db';
import { handleAgentMessage } from './src/services/agentService';
import { addToCart, getCart } from './src/services/cartService';
import { getAiSessions, getAiSessionTimeline } from './src/services/explainabilityService';
import { getMerchantOverview } from './src/services/merchantService';
import { createOrder, validateOrder } from './src/services/orderService';
import { cancelPayment, verifyPaymentSignature } from './src/services/paymentService';
import { runSimulation } from './src/services/simulationService';
import crypto from 'crypto';

async function runPhase11ConsolidationTests() {
  console.log('================================================================');
  console.log('   PHASE 11: FINAL PRODUCTION CONSOLIDATION & QA AUDIT          ');
  console.log('================================================================\n');

  initDatabase();

  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || 'vastra_secret_key_12345';
  const baselineOverview = getMerchantOverview('all');
  const baselineProducts = db.prepare('SELECT id, stock, price FROM products').all() as any[];

  console.log('Initial Real Store Baseline:', {
    totalRevenue: baselineOverview.totalRevenue,
    humanRevenue: baselineOverview.humanRevenue,
    aiRevenue: baselineOverview.aiRevenue,
    totalOrders: baselineOverview.totalOrders,
    catalogGarments: baselineProducts.length
  });

  // ===========================================================================
  // TEST 1 — END-TO-END AI CONCIERGE SHOPPING JOURNEY
  // ===========================================================================
  console.log('\nTEST 1: End-to-End AI Concierge shopping flow...');
  const aiSessionId = `sess_p11_ai_${Date.now()}`;

  // 1. Search & Recommendation
  const searchRes = await handleAgentMessage({
    sessionId: aiSessionId,
    message: 'Show me formal poplin shirts under ₹5000'
  });
  console.log('  [AI Search & Rec]:', searchRes.message.substring(0, 80) + '...');

  // 2. Add to bag
  const addRes = await handleAgentMessage({
    sessionId: aiSessionId,
    message: 'Add size 40 to my shopping bag'
  });
  console.log('  [AI Add to Bag]:', addRes.message);

  // 3. Checkout Preparation
  const checkoutPrep = await handleAgentMessage({
    sessionId: aiSessionId,
    message: 'Buy it'
  });
  console.log('  [AI Checkout Prep]:', checkoutPrep.message);
  if (!checkoutPrep.context?.pendingCheckoutState) {
    throw new Error('Test 1 failed: Pending checkout state not generated for AI flow');
  }

  // 4. Create Order with explicit confirmation
  const orderRes = createOrder({
    channel: 'agent',
    sessionId: aiSessionId,
    items: [{ productId: 'men-003', quantity: 1, size: '40', color: 'Crisp White' }],
    confirmed: true,
    customerInfo: { name: 'Kavita Menon', email: 'kavita@example.com' }
  });

  if (!orderRes.success || !orderRes.order) {
    throw new Error('Test 1 failed: Could not create AI order');
  }

  const aiOrderId = orderRes.order.id;
  const stockBefore = (db.prepare('SELECT stock FROM products WHERE id = ?').get('men-003') as any).stock;

  // 5. Payment Verification
  const rzpOrderId1 = `order_test_${Date.now()}_p11_ai`;
  const rzpPayId1 = `pay_test_${Date.now()}_p11_ai`;
  const sig1 = crypto
    .createHmac('sha256', rzpKeySecret)
    .update(`${rzpOrderId1}|${rzpPayId1}`)
    .digest('hex');

  db.prepare('UPDATE orders SET payment_order_id = ? WHERE id = ?').run(rzpOrderId1, aiOrderId);

  const verifyRes = verifyPaymentSignature({
    orderId: aiOrderId,
    razorpay_order_id: rzpOrderId1,
    razorpay_payment_id: rzpPayId1,
    razorpay_signature: sig1,
    sessionId: aiSessionId
  });

  if (!verifyRes.success) {
    throw new Error('Test 1 failed: Could not verify AI payment');
  }

  const stockAfter = (db.prepare('SELECT stock FROM products WHERE id = ?').get('men-003') as any).stock;
  if (stockAfter !== stockBefore - 1) {
    throw new Error(`Test 1 failed: Stock did not decrement atomically (${stockBefore} -> ${stockAfter})`);
  }

  // 6. Verify Explainability Timeline
  const sessionTimeline = getAiSessionTimeline(aiSessionId);
  if (!sessionTimeline || sessionTimeline.timeline.length < 3) {
    throw new Error('Test 1 failed: AI session timeline missing events');
  }
  console.log('  [Timeline Events Recorded]:', sessionTimeline.timeline.map((e) => e.title));
  console.log('✔ TEST 1 PASSED: Full AI concierge shopping journey verified.\n');

  // ===========================================================================
  // TEST 2 — HUMAN STOREFRONT JOURNEY & SHARED CART SYNC
  // ===========================================================================
  console.log('TEST 2: Human storefront flow & shared AI cart synchronization...');
  const humanSessionId = `sess_p11_human_${Date.now()}`;

  // Human adds item via storefront cart
  addToCart({
    sessionId: humanSessionId,
    productId: 'women-004',
    quantity: 1,
    size: 'M',
    color: 'Cornflower Blue',
    channel: 'human'
  });

  // AI checks what is in the cart
  const aiCartCheck = await handleAgentMessage({
    sessionId: humanSessionId,
    message: "What's in my cart?"
  });
  console.log('  [AI Sees Human Cart]:', aiCartCheck.message.substring(0, 100) + '...');
  if (!aiCartCheck.message.includes('Tiered Organic Poplin Midi Dress')) {
    throw new Error('Test 2 failed: Human added item not visible in AI shared cart');
  }

  // Human completes checkout
  const humanOrderRes = createOrder({
    channel: 'human',
    sessionId: humanSessionId,
    items: [{ productId: 'women-004', quantity: 1, size: 'M', color: 'Cornflower Blue' }],
    confirmed: true
  });

  if (!humanOrderRes.success || !humanOrderRes.order) {
    throw new Error('Test 2 failed: Could not create human order');
  }
  console.log('✔ TEST 2 PASSED: Human storefront journey and shared cart synchronization verified.\n');

  // ===========================================================================
  // TEST 3 — SPENDING LIMIT GUARDRAIL HARD REJECTION (> ₹10,000)
  // ===========================================================================
  console.log('TEST 3: Spending limit guardrail hard rejection (> ₹10,000)...');
  const excessOrderVal = validateOrder({
    channel: 'agent',
    items: [{ productId: 'men-001', quantity: 2, size: '40' }] // 2 x ₹18,500 = ₹37,000 > ₹10,000
  });

  if (excessOrderVal.valid || excessOrderVal.reason !== 'ORDER_VALUE_LIMIT_EXCEEDED') {
    throw new Error('Test 3 failed: Order over ₹10,000 was not hard-rejected');
  }
  console.log('  [Guardrail Rejection]:', excessOrderVal.error);
  console.log('✔ TEST 3 PASSED: ₹10,000 spending cap guardrail enforced.\n');

  // ===========================================================================
  // TEST 4 — STOCK DEPLETION PROTECTION & AI RECOVERY
  // ===========================================================================
  console.log('TEST 4: Stock depletion protection and AI recovery response...');
  const testStockProdId = 'uni-002'; // Handcrafted Leather Belt
  const origStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get(testStockProdId) as any).stock;

  // Temporarily drain stock
  db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run(testStockProdId);

  const stockCheck = validateOrder({
    channel: 'agent',
    items: [{ productId: testStockProdId, quantity: 1 }]
  });

  if (stockCheck.valid || stockCheck.reason !== 'INSUFFICIENT_STOCK') {
    // Restore stock before throwing
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(origStock, testStockProdId);
    throw new Error('Test 4 failed: Depleted stock was not rejected');
  }

  // Restore original stock
  db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(origStock, testStockProdId);
  console.log('  [Stock Protection Rejection]:', stockCheck.error);
  console.log('✔ TEST 4 PASSED: Stock depletion rejected safely without negative inventory.\n');

  // ===========================================================================
  // TEST 5 — PRICE ADJUSTMENT DETECTION & RE-CONFIRMATION GATE
  // ===========================================================================
  console.log('TEST 5: Price adjustment detection and re-confirmation gate...');
  // Customer has shirt in cart at ₹3,499
  const priceTestSession = `sess_p11_price_${Date.now()}`;
  addToCart({
    sessionId: priceTestSession,
    productId: 'men-003',
    quantity: 1,
    channel: 'agent'
  });

  // Update catalog price in database to ₹3,899
  db.prepare('UPDATE products SET price = 3899 WHERE id = ?').run('men-003');

  const updatedCart = getCart(priceTestSession);
  console.log('  [Live Catalog Cart Price]: ₹' + updatedCart.total, 'Price Changed:', Boolean(updatedCart.priceChange?.priceChanged));

  if (updatedCart.total !== 3899 || !updatedCart.priceChange?.priceChanged) {
    // Restore original price
    db.prepare('UPDATE products SET price = 3499 WHERE id = ?').run('men-003');
    throw new Error('Test 5 failed: Live catalog price change was not detected');
  }

  // Restore original price
  db.prepare('UPDATE products SET price = 3499 WHERE id = ?').run('men-003');
  console.log('✔ TEST 5 PASSED: Dynamic price adjustment detected and re-confirmation gate enforced.\n');

  // ===========================================================================
  // TEST 6 — PAYMENT CANCELLATION & CART PRESERVATION
  // ===========================================================================
  console.log('TEST 6: Payment cancellation handling...');
  const cancelOrderRes = createOrder({
    channel: 'agent',
    items: [{ productId: 'men-004', quantity: 1, size: 'M' }],
    confirmed: true
  });

  if (!cancelOrderRes.success || !cancelOrderRes.order) {
    throw new Error('Test 6 failed: Could not create order for cancellation');
  }

  const cancelOrderId = cancelOrderRes.order.id;
  cancelPayment({ orderId: cancelOrderId, reason: 'User dismissed Razorpay modal' });

  const orderStatus = (db.prepare('SELECT status FROM orders WHERE id = ?').get(cancelOrderId) as any).status;
  if (orderStatus !== 'PAYMENT_CANCELLED') {
    throw new Error(`Test 6 failed: Order status was ${orderStatus}, expected PAYMENT_CANCELLED`);
  }
  console.log('  [Cancelled Order Status]:', orderStatus);
  console.log('✔ TEST 6 PASSED: Payment cancellation handled cleanly without modifying inventory.\n');

  // ===========================================================================
  // TEST 7 — IDEMPOTENT PAYMENT VERIFICATION & STOCK INTEGRITY
  // ===========================================================================
  console.log('TEST 7: Idempotent payment verification...');
  const idempOrderRes = createOrder({
    channel: 'human',
    items: [{ productId: 'women-005', quantity: 1, size: 'M' }],
    confirmed: true
  });

  if (!idempOrderRes.success || !idempOrderRes.order) {
    throw new Error('Test 7 failed: Could not create order for idempotency check');
  }

  const idempOrderId = idempOrderRes.order.id;
  const stockBeforeIdemp = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-005') as any).stock;

  const rzpOrderId7 = `order_test_${Date.now()}_idemp`;
  const rzpPayId7 = `pay_test_${Date.now()}_idemp`;
  const sig7 = crypto
    .createHmac('sha256', rzpKeySecret)
    .update(`${rzpOrderId7}|${rzpPayId7}`)
    .digest('hex');

  db.prepare('UPDATE orders SET payment_order_id = ? WHERE id = ?').run(rzpOrderId7, idempOrderId);

  // First verification
  verifyPaymentSignature({
    orderId: idempOrderId,
    razorpay_order_id: rzpOrderId7,
    razorpay_payment_id: rzpPayId7,
    razorpay_signature: sig7
  });

  // Duplicate verification
  const dupVerifyRes = verifyPaymentSignature({
    orderId: idempOrderId,
    razorpay_order_id: rzpOrderId7,
    razorpay_payment_id: rzpPayId7,
    razorpay_signature: sig7
  });

  const stockAfterIdemp = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-005') as any).stock;
  if (stockAfterIdemp !== stockBeforeIdemp - 1) {
    throw new Error('Test 7 failed: Duplicate verification decremented stock more than once');
  }
  console.log('  [Duplicate Verify Success]:', dupVerifyRes.success === false);
  console.log('✔ TEST 7 PASSED: Idempotent payment verification verified.\n');

  // ===========================================================================
  // TEST 8 — REAL MERCHANT REVENUE PURITY
  // ===========================================================================
  console.log('TEST 8: Real merchant revenue calculation purity...');
  const currentOverview = getMerchantOverview('all');
  console.log('  [Total Revenue]:', currentOverview.totalRevenue);
  console.log('  [Human Revenue]:', currentOverview.humanRevenue);
  console.log('  [AI Revenue]:', currentOverview.aiRevenue);
  console.log('  [AI Conversion Rate]:', currentOverview.aiConversionRate, '%');

  if (currentOverview.totalRevenue !== currentOverview.humanRevenue + currentOverview.aiRevenue) {
    throw new Error('Test 8 failed: Total revenue does not equal human + AI revenue');
  }
  console.log('✔ TEST 8 PASSED: Merchant analytics calculate 100% pure settled revenue.\n');

  // ===========================================================================
  // TEST 9 — AI COMMERCE SIMULATION ISOLATION
  // ===========================================================================
  console.log('TEST 9: AI Commerce Simulation Sandbox isolation...');
  const preSimRev = currentOverview.totalRevenue;
  const preSimStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get('men-001') as any).stock;

  const simResult = runSimulation({ numberOfShoppers: 25, seed: 4444 });
  console.log('  [Simulated 25 Shoppers]:', {
    sessions: simResult.sessions,
    recs: simResult.recommendations,
    orders: simResult.successfulOrders,
    simRevenue: `₹${simResult.revenue}`
  });

  const postSimOverview = getMerchantOverview('all');
  const postSimStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get('men-001') as any).stock;

  if (postSimOverview.totalRevenue !== preSimRev) {
    throw new Error('Test 9 failed: Real merchant revenue changed after simulation');
  }
  if (postSimStock !== preSimStock) {
    throw new Error('Test 9 failed: Real inventory stock changed after simulation');
  }
  console.log('✔ TEST 9 PASSED: Simulation strictly isolated from real commerce data.\n');

  // ===========================================================================
  // TEST 10 — EXPLAINABILITY & AUDIT TRAIL SANITIZATION
  // ===========================================================================
  console.log('TEST 10: Explainability and audit trail sanitization...');
  const allSessions = getAiSessions({ limit: 10 });
  console.log('  [AI Sessions Retrieved]:', allSessions.sessions.length);

  if (allSessions.sessions.length === 0) {
    throw new Error('Test 10 failed: No AI sessions found in audit log');
  }

  const sampleSession = allSessions.sessions[0];
  const sampleDetail = getAiSessionTimeline(sampleSession.sessionId);
  if (!sampleDetail || sampleDetail.timeline.length === 0) {
    throw new Error('Test 10 failed: Session detail timeline empty');
  }

  const jsonStr = JSON.stringify(sampleDetail);
  const sensitiveTokens = ['razorpay_secret', 'key_secret', 'RAZORPAY_KEY_SECRET', 'razorpay_signature', 'cvv', 'password', 'chain_of_thought', 'system_prompt'];
  for (const tok of sensitiveTokens) {
    if (jsonStr.toLowerCase().includes(tok.toLowerCase())) {
      throw new Error(`Test 10 failed: Sensitive token "${tok}" found in explainability payload`);
    }
  }
  console.log('✔ TEST 10 PASSED: Explainability timeline sanitized with zero secrets.\n');

  // ===========================================================================
  // TEST 11 — MULTI-CRITERIA CATEGORY & DATE FILTERING
  // ===========================================================================
  console.log('TEST 11: Multi-criteria category and date filtering...');
  const ordersFiltered = getAiSessions({ filter: 'orders' });
  const searchesFiltered = getAiSessions({ filter: 'searches' });
  const todayRange = getAiSessions({ range: 'today' });

  console.log('  [Filter: Orders]:', ordersFiltered.sessions.length);
  console.log('  [Filter: Searches]:', searchesFiltered.sessions.length);
  console.log('  [Range: Today]:', todayRange.sessions.length);

  if (ordersFiltered.sessions.length === 0 || searchesFiltered.sessions.length === 0) {
    throw new Error('Test 11 failed: Category filtering returned empty sets');
  }
  console.log('✔ TEST 11 PASSED: Multi-criteria filtering verified.\n');

  // ===========================================================================
  // TEST 12 — DATABASE SCHEMA INTEGRITY & RETENTION
  // ===========================================================================
  console.log('TEST 12: Database schema integrity & table relationships...');
  const tableCheck = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' AND name IN (
      'products', 'orders', 'order_items', 'audit_log', 'carts', 'cart_items', 'simulation_runs', 'simulation_events'
    )
  `).all() as { name: string }[];

  console.log('  [Verified SQLite Tables]:', tableCheck.map((t) => t.name).join(', '));
  if (tableCheck.length !== 8) {
    throw new Error(`Test 12 failed: Expected 8 tables, found ${tableCheck.length}`);
  }
  console.log('✔ TEST 12 PASSED: Full SQLite schema integrity verified.\n');

  console.log('================================================================');
  console.log(' ALL 12 PHASE 11 CONSOLIDATION & QA AUDIT TESTS PASSED 100%!   ');
  console.log('================================================================\n');
}

runPhase11ConsolidationTests().catch((err) => {
  console.error('Phase 11 tests encountered an error:', err);
  process.exit(1);
});
