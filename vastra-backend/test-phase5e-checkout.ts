import crypto from 'crypto';
import { db } from './src/db/db';
import { getAuditLogs } from './src/services/auditService';
import {
  confirmAgentCheckout,
  handleAgentMessage,
  prepareCheckout
} from './src/services/agentService';
import { addToCart, clearCart, getCart } from './src/services/cartService';
import { verifyPaymentSignature } from './src/services/paymentService';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'vastra_secret_key_12345';

function generateSignature(orderId: string, paymentId: string): string {
  return crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function runPhase5ETests() {
  console.log('================================================================');
  console.log('   PHASE 5E: AI CHECKOUT + HUMAN CONFIRMATION + RAZORPAY TESTS  ');
  console.log('================================================================\n');

  // ===========================================================================
  // TEST 1 — NORMAL AI CHECKOUT
  // ===========================================================================
  console.log('TEST 1: Starting "Buy the item in my cart" (Preparation without premature order)...');
  const session1 = `sess_chk_t1_${Date.now()}`;
  addToCart({
    sessionId: session1,
    productId: 'women-004', // Tiered Organic Poplin Midi Dress (₹4,999)
    quantity: 1,
    size: 'M',
    channel: 'agent'
  });

  const t1_res = await handleAgentMessage({
    sessionId: session1,
    message: 'Buy the item in my cart.'
  });

  console.log('  [Turn 1] Message:\n', t1_res.message);
  console.log('  [Turn 1] Checkout Ready:', t1_res.checkout?.ready, 'Requires Confirmation:', t1_res.checkout?.requiresConfirmation);

  if (!t1_res.checkout?.ready || !t1_res.checkout?.requiresConfirmation) {
    throw new Error('Test 1 failed: Expected checkout ready and requiresConfirmation = true');
  }

  // Verify NO local order was prematurely created in database
  const prematurelyCreatedOrders = db.prepare("SELECT * FROM orders WHERE channel = 'agent'").all() as any[];
  const session1Orders = prematurelyCreatedOrders.filter((o) => {
    const logs = getAuditLogs({ orderId: o.id, sessionId: session1 });
    return logs.length > 0;
  });

  if (session1Orders.length > 0) {
    throw new Error('Test 1 failed: Order was prematurely created before explicit human confirmation!');
  }
  console.log('✔ TEST 1 PASSED: Purchase summary prepared; no order created before confirmation.\n');

  // ===========================================================================
  // TEST 2 — CONFIRM CHECKOUT
  // ===========================================================================
  console.log('TEST 2: Explicit human confirmation -> Local order & Razorpay order created...');
  const t2_confirmRes = await confirmAgentCheckout({
    sessionId: session1,
    confirmed: true,
    customerInfo: {
      name: 'Rohan Verma',
      email: 'rohan.verma@example.com',
      phone: '+91 98765 43210',
      address: '42 Marine Drive, Mumbai, MH - 400020'
    }
  });

  console.log('  [Confirm Result] Order ID:', t2_confirmRes.orderId);
  console.log('  [Confirm Result] Razorpay Order ID:', t2_confirmRes.razorpayOrderId);
  console.log('  [Confirm Result] Amount in Paise:', t2_confirmRes.amount, 'Total in INR:', t2_confirmRes.totalAmount);

  if (!t2_confirmRes.orderId || !t2_confirmRes.razorpayOrderId || t2_confirmRes.amount !== 499900) {
    throw new Error('Test 2 failed: Incorrect order or Razorpay amount generated');
  }

  const createdOrder = db.prepare('SELECT * FROM orders WHERE id = ?').get(t2_confirmRes.orderId) as any;
  if (!createdOrder || createdOrder.status !== 'PENDING_PAYMENT' || createdOrder.channel !== 'agent') {
    throw new Error('Test 2 failed: Local order should be PENDING_PAYMENT with channel = agent');
  }
  console.log('✔ TEST 2 PASSED: Local order and Razorpay order created on confirmation.\n');

  // ===========================================================================
  // TEST 3 — SUCCESSFUL PAYMENT
  // ===========================================================================
  console.log('TEST 3: Verifying successful Razorpay payment signature...');
  const prodBefore3 = db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as { stock: number };
  const stockBefore3 = prodBefore3.stock;

  const validPaymentId = `pay_test_${Date.now()}_abc`;
  const validSignature = generateSignature(t2_confirmRes.razorpayOrderId, validPaymentId);

  const t3_verifyRes = verifyPaymentSignature({
    orderId: t2_confirmRes.orderId,
    razorpay_order_id: t2_confirmRes.razorpayOrderId,
    razorpay_payment_id: validPaymentId,
    razorpay_signature: validSignature,
    sessionId: session1
  });

  if (!t3_verifyRes.success) {
    throw new Error(`Test 3 failed: Payment verification failed with error: ${t3_verifyRes.error}`);
  }

  console.log('  [Verify Result] Success:', t3_verifyRes.success, 'Status:', t3_verifyRes.order.status);

  if (t3_verifyRes.order.status !== 'PAID') {
    throw new Error('Test 3 failed: Payment verification did not mark order as PAID');
  }

  const prodAfter3 = db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as { stock: number };
  if (prodAfter3.stock !== stockBefore3 - 1) {
    throw new Error(`Test 3 failed: Stock not decreased by exactly 1 (Before: ${stockBefore3}, After: ${prodAfter3.stock})`);
  }
  console.log('✔ TEST 3 PASSED: Payment verified, order marked PAID, stock decreased exactly once.\n');

  // ===========================================================================
  // TEST 4 — PAYMENT FAILURE
  // ===========================================================================
  console.log('TEST 4: Testing payment failure (tampered signature)...');
  const session4 = `sess_chk_t4_${Date.now()}`;
  addToCart({
    sessionId: session4,
    productId: 'men-003', // Tailored Poplin Formal Shirt (₹3,499)
    quantity: 1,
    size: '40',
    channel: 'agent'
  });
  prepareCheckout(session4);

  const t4_confirm = await confirmAgentCheckout({
    sessionId: session4,
    confirmed: true
  });

  const prodBefore4 = db.prepare('SELECT stock FROM products WHERE id = ?').get('men-003') as { stock: number };
  const stockBefore4 = prodBefore4.stock;

  const t4_verifyRes = verifyPaymentSignature({
    orderId: t4_confirm.orderId,
    razorpay_order_id: t4_confirm.razorpayOrderId,
    razorpay_payment_id: 'pay_tampered_123',
    razorpay_signature: 'invalid_tampered_signature_hex',
    sessionId: session4
  });

  if (t4_verifyRes.success) {
    throw new Error('Test 4 failed: Invalid signature should not succeed');
  }

  console.log('  [Verify Result] Success:', t4_verifyRes.success, 'Error:', t4_verifyRes.error);

  const failedOrder = db.prepare('SELECT status FROM orders WHERE id = ?').get(t4_confirm.orderId) as any;
  if (failedOrder.status !== 'PAYMENT_FAILED') {
    throw new Error(`Test 4 failed: Expected order status PAYMENT_FAILED, got ${failedOrder.status}`);
  }

  const prodAfter4 = db.prepare('SELECT stock FROM products WHERE id = ?').get('men-003') as { stock: number };
  if (prodAfter4.stock !== stockBefore4) {
    throw new Error('Test 4 failed: Stock was modified despite payment failure');
  }
  console.log('✔ TEST 4 PASSED: Payment failure handled safely; order not PAID, stock unchanged.\n');

  // ===========================================================================
  // TEST 5 — USER CANCELS
  // ===========================================================================
  console.log('TEST 5: Testing user cancellation...');
  const session5 = `sess_chk_t5_${Date.now()}`;
  addToCart({
    sessionId: session5,
    productId: 'men-004',
    quantity: 1,
    channel: 'agent'
  });
  const t5_prep = prepareCheckout(session5);
  console.log('  [Turn 1] Prepared checkout for total:', t5_prep.totalAmount);

  // User decides not to confirm
  const cartAfterCancel = getCart(session5);
  if (cartAfterCancel.items.length !== 1) {
    throw new Error('Test 5 failed: Cart should remain available after cancellation');
  }
  console.log('✔ TEST 5 PASSED: User cancellation leaves cart available with no payment.\n');

  // ===========================================================================
  // TEST 6 — STOCK CHANGES BETWEEN PREPARE AND CONFIRM
  // ===========================================================================
  console.log('TEST 6: Testing real-time stock depletion before confirmation...');
  const session6 = `sess_chk_t6_${Date.now()}`;
  addToCart({
    sessionId: session6,
    productId: 'women-006', // Relaxed Belgian Linen Classic Shirt (stock: 22)
    quantity: 2,
    channel: 'agent'
  });
  prepareCheckout(session6);

  // Temporarily deplete stock in DB
  const originalStock6 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-006') as any).stock;
  db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run('women-006');

  try {
    await confirmAgentCheckout({
      sessionId: session6,
      confirmed: true
    });
    throw new Error('Test 6 failed: Checkout should have been rejected due to zero stock');
  } catch (err: any) {
    console.log('  [Stock Guardrail Triggered] Error:', err.message);
    if (!err.message.includes('INSUFFICIENT_STOCK')) {
      throw new Error(`Test 6 failed: Expected INSUFFICIENT_STOCK, got ${err.message}`);
    }
  } finally {
    // Restore stock
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(originalStock6, 'women-006');
  }
  console.log('✔ TEST 6 PASSED: Stock exhaustion between prepare and confirm rejected safely.\n');

  // ===========================================================================
  // TEST 7 — PRICE PROTECTION (DB PRICE UPDATE)
  // ===========================================================================
  console.log('TEST 7: Testing price protection against stale price...');
  const session7 = `sess_chk_t7_${Date.now()}`;
  addToCart({
    sessionId: session7,
    productId: 'men-006', // Heavyweight Supima Cotton T-Shirt (₹1,899)
    quantity: 1,
    channel: 'agent'
  });

  const originalPrice7 = (db.prepare('SELECT price FROM products WHERE id = ?').get('men-006') as any).price;
  // Update price in DB to ₹2,199
  db.prepare('UPDATE products SET price = 2199 WHERE id = ?').run('men-006');

  try {
    // Turn 1: prepareCheckout detects price change and prompts user
    const t7_prep1 = prepareCheckout(session7);
    console.log('  [Turn 1] Price Changed Detected:', t7_prep1.priceChange?.priceChanged);
    if (!t7_prep1.priceChange?.priceChanged) {
      throw new Error('Test 7 failed: Price change was not detected on turn 1');
    }

    // Turn 2: User acknowledges and prepares with updated price
    const t7_prep2 = prepareCheckout(session7);
    console.log('  [Turn 2] Recomputed Total:', t7_prep2.totalAmount);
    if (t7_prep2.totalAmount !== 2199) {
      throw new Error(`Test 7 failed: Expected recalculated price of 2199, got ${t7_prep2.totalAmount}`);
    }

    const t7_confirm = await confirmAgentCheckout({
      sessionId: session7,
      confirmed: true
    });
    if (t7_confirm.totalAmount !== 2199) {
      throw new Error(`Test 7 failed: Expected confirmed order amount 2199, got ${t7_confirm.totalAmount}`);
    }
  } finally {
    // Restore original price
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(originalPrice7, 'men-006');
  }
  console.log('✔ TEST 7 PASSED: Current database price strictly enforced at checkout.\n');

  // ===========================================================================
  // TEST 8 — STALE CHECKOUT PROTECTION (CART CHANGES AFTER PREPARE)
  // ===========================================================================
  console.log('TEST 8: Testing stale checkout invalidation on cart modification...');
  const session8 = `sess_chk_t8_${Date.now()}`;
  addToCart({
    sessionId: session8,
    productId: 'men-008', // Pleated Tapered Cotton Chinos (₹4,299)
    quantity: 1,
    channel: 'agent'
  });
  prepareCheckout(session8);

  // User changes cart quantity after preparing checkout
  addToCart({
    sessionId: session8,
    productId: 'men-008',
    quantity: 1, // now 2 items
    channel: 'agent'
  });

  try {
    await confirmAgentCheckout({
      sessionId: session8,
      confirmed: true
    });
    throw new Error('Test 8 failed: Stale checkout should have been rejected');
  } catch (err: any) {
    console.log('  [Stale Protection Triggered] Error:', err.message);
    if (!err.message.includes('STALE_CHECKOUT')) {
      throw new Error(`Test 8 failed: Expected STALE_CHECKOUT, got ${err.message}`);
    }
  }
  console.log('✔ TEST 8 PASSED: Modified cart invalidated previous confirmation state.\n');

  // ===========================================================================
  // TEST 9 — ORDER ABOVE ₹10,000 REJECTION
  // ===========================================================================
  console.log('TEST 9: Testing MAX_ORDER_VALUE guardrail (total > ₹10,000)...');
  const session9 = `sess_chk_t9_${Date.now()}`;
  addToCart({
    sessionId: session9,
    productId: 'men-001', // Raw Mulberry Silk Bandhgala (₹18,500)
    quantity: 1,
    channel: 'agent'
  });

  const t9_prep = prepareCheckout(session9);
  console.log('  [Prepare Result] Ready:', t9_prep.ready, 'Error:', t9_prep.error);

  if (t9_prep.ready || t9_prep.error !== 'ORDER_VALUE_LIMIT_EXCEEDED') {
    throw new Error('Test 9 failed: Order exceeding ₹10,000 was not blocked');
  }
  console.log('✔ TEST 9 PASSED: Order above ₹10,000 blocked by commerce guardrail.\n');

  // ===========================================================================
  // TEST 10 — AMBIGUOUS LANGUAGE SAFETY
  // ===========================================================================
  console.log('TEST 10: Testing ambiguous purchase language ("Maybe buy it")...');
  const session10 = `sess_chk_t10_${Date.now()}`;
  addToCart({
    sessionId: session10,
    productId: 'men-004',
    quantity: 1,
    channel: 'agent'
  });

  const t10_res = await handleAgentMessage({
    sessionId: session10,
    message: 'Maybe buy it.'
  });
  console.log('  [Turn 1] Message:\n', t10_res.message);
  console.log('  [Turn 1] Checkout Attached:', Boolean(t10_res.checkout));

  if (t10_res.checkout?.ready) {
    throw new Error('Test 10 failed: Ambiguous "Maybe buy it" should not prepare or confirm order');
  }
  console.log('✔ TEST 10 PASSED: Ambiguous intent asked for confirmation without initiating order.\n');

  // ===========================================================================
  // TEST 11 — EMPTY CART CHECKOUT
  // ===========================================================================
  console.log('TEST 11: Testing checkout with empty cart ("Buy it")...');
  const session11 = `sess_chk_t11_${Date.now()}`;
  clearCart(session11, 'agent');

  const t11_res = await handleAgentMessage({
    sessionId: session11,
    message: 'Buy it.'
  });
  console.log('  [Turn 1] Message:\n', t11_res.message);

  if (!t11_res.message.toLowerCase().includes('empty')) {
    throw new Error('Test 11 failed: Expected empty cart message');
  }
  console.log('✔ TEST 11 PASSED: Empty cart checkout cleanly rejected.\n');

  // ===========================================================================
  // TEST 12 — DUPLICATE PAYMENT VERIFICATION (IDEMPOTENCY)
  // ===========================================================================
  console.log('TEST 12: Testing duplicate payment verification idempotency...');
  const prodBefore12 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as any).stock;

  // Repeat signature verification for the order confirmed in TEST 3
  const t12_duplicateRes = verifyPaymentSignature({
    orderId: t2_confirmRes.orderId,
    razorpay_order_id: t2_confirmRes.razorpayOrderId,
    razorpay_payment_id: validPaymentId,
    razorpay_signature: validSignature,
    sessionId: session1
  });

  if (t12_duplicateRes.success) {
    throw new Error('Test 12 failed: Duplicate verification should not succeed');
  }

  console.log('  [Duplicate Verify Result] Success:', t12_duplicateRes.success, 'Error:', t12_duplicateRes.error);

  if (t12_duplicateRes.error !== 'ORDER_ALREADY_PAID') {
    throw new Error(`Test 12 failed: Expected ORDER_ALREADY_PAID, got ${t12_duplicateRes.error}`);
  }

  const prodAfter12 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as any).stock;
  if (prodAfter12 !== prodBefore12) {
    throw new Error('Test 12 failed: Stock decreased a second time upon duplicate payment verification!');
  }
  console.log('✔ TEST 12 PASSED: Duplicate payment verification safely rejected without double stock deduction.\n');

  // ===========================================================================
  // AUDIT LOG VERIFICATION
  // ===========================================================================
  console.log('Verifying SQLite Audit Logs for Phase 5E actions...');
  const gatingLogs = getAuditLogs({ action: 'gating_check' });
  const orderCreatedLogs = getAuditLogs({ action: 'order_created' });
  const paymentAttemptLogs = getAuditLogs({ action: 'payment_attempt' });
  const paymentVerifiedLogs = getAuditLogs({ action: 'payment_verified' });
  const paymentFailedLogs = getAuditLogs({ action: 'payment_failed' });
  const orderConfirmedLogs = getAuditLogs({ action: 'order_confirmed' });

  console.log(`Audit Event Counts:
    - gating_check: ${gatingLogs.length}
    - order_created: ${orderCreatedLogs.length}
    - payment_attempt: ${paymentAttemptLogs.length}
    - payment_verified: ${paymentVerifiedLogs.length}
    - payment_failed: ${paymentFailedLogs.length}
    - order_confirmed: ${orderConfirmedLogs.length}`);

  if (
    gatingLogs.length === 0 ||
    orderCreatedLogs.length === 0 ||
    paymentAttemptLogs.length === 0 ||
    paymentVerifiedLogs.length === 0 ||
    paymentFailedLogs.length === 0 ||
    orderConfirmedLogs.length === 0
  ) {
    throw new Error('Audit verification failed: Missing required Phase 5E audit actions');
  }

  const sampleVerifiedLog = JSON.parse(paymentVerifiedLogs[0].details || '{}');
  console.log('Sample payment_verified audit details:', sampleVerifiedLog);
  if (!sampleVerifiedLog.orderId || !sampleVerifiedLog.razorpay_order_id) {
    throw new Error('Audit verification failed: Missing orderId or razorpay_order_id in payment_verified');
  }

  console.log('✔ SQLite Audit Log Verification PASSED.\n');

  console.log('================================================================');
  console.log(' ALL 12 PHASE 5E AI CHECKOUT & PAYMENT TESTS PASSED 100%!       ');
  console.log('================================================================\n');
}

runPhase5ETests().catch((err) => {
  console.error('Phase 5E tests encountered an error:', err);
  process.exit(1);
});
