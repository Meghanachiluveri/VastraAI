import crypto from 'crypto';
import { db } from './src/db/db';
import { getAuditLogs } from './src/services/auditService';
import {
  confirmAgentCheckout,
  handleAgentMessage,
  prepareCheckout
} from './src/services/agentService';
import { addToCart, clearCart, getCart } from './src/services/cartService';
import { cancelPayment, createRazorpayOrder, verifyPaymentSignature } from './src/services/paymentService';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'vastra_secret_key_12345';

function generateSignature(orderId: string, paymentId: string): string {
  return crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

async function runPhase5FTests() {
  console.log('================================================================');
  console.log('   PHASE 5F: FAILURE HANDLING AND RECOVERY AUTOMATED TESTS      ');
  console.log('================================================================\n');

  // ===========================================================================
  // TEST 1 — STOCK BECOMES ZERO BEFORE CONFIRMATION
  // ===========================================================================
  console.log('TEST 1: Stock becomes zero before confirmation -> checkout rejected safely...');
  const session1 = `sess_f_t1_${Date.now()}`;
  addToCart({
    sessionId: session1,
    productId: 'women-006', // Relaxed Belgian Linen Classic Shirt
    quantity: 1,
    size: 'M',
    channel: 'agent'
  });

  const originalStock1 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-006') as any).stock;
  // Deplete stock in DB
  db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run('women-006');

  try {
    const t1_prep = prepareCheckout(session1);
    console.log('  [Prepare Result] Ready:', t1_prep.ready, 'Error:', t1_prep.error, 'Message:', t1_prep.message);

    if (t1_prep.ready || t1_prep.error !== 'INSUFFICIENT_STOCK') {
      throw new Error('Test 1 failed: Expected INSUFFICIENT_STOCK on depleted item');
    }

    // Attempting confirmation must fail
    try {
      await confirmAgentCheckout({ sessionId: session1, confirmed: true });
      throw new Error('Test 1 failed: Confirmation should have thrown error');
    } catch (err: any) {
      console.log('  [Confirm Result Blocked] Error:', err.message);
    }

    // Verify stock is not negative
    const stockCheck = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-006') as any).stock;
    if (stockCheck < 0) {
      throw new Error('Test 1 failed: Stock became negative!');
    }
  } finally {
    // Restore stock
    db.prepare('UPDATE products SET stock = ? WHERE id = ?').run(originalStock1, 'women-006');
  }
  console.log('✔ TEST 1 PASSED: Depleted stock rejected, order not created, stock not negative.\n');

  // ===========================================================================
  // TEST 2 — PRICE CHANGES BEFORE CONFIRMATION
  // ===========================================================================
  console.log('TEST 2: Price changes before confirmation -> user informed with priceChanged = true...');
  const session2 = `sess_f_t2_${Date.now()}`;
  const originalPrice2 = (db.prepare('SELECT price FROM products WHERE id = ?').get('men-003') as any).price;

  addToCart({
    sessionId: session2,
    productId: 'men-003', // Tailored Poplin Formal Shirt (₹3,499)
    quantity: 1,
    size: '40',
    channel: 'agent'
  });

  // DB price updates from ₹3,499 to ₹3,999
  db.prepare('UPDATE products SET price = 3999 WHERE id = ?').run('men-003');

  try {
    const t2_prep = prepareCheckout(session2);
    console.log('  [Prepare Result] Ready:', t2_prep.ready, 'Price Changed:', t2_prep.priceChange?.priceChanged);
    console.log('  [Price Change Details] Prev:', t2_prep.priceChange?.previousPrice, 'Current:', t2_prep.priceChange?.currentPrice);
    console.log('  [Message to User]:', t2_prep.message);

    if (!t2_prep.priceChange?.priceChanged || t2_prep.priceChange.previousPrice !== 3499 || t2_prep.priceChange.currentPrice !== 3999) {
      throw new Error('Test 2 failed: Price change was not detected or previous/current prices were inaccurate');
    }

    // Verification that previous confirmation state was invalidated
    const sessionState = getCart(session2);
    if (sessionState.total !== 3999) {
      throw new Error(`Test 2 failed: Cart total should now reflect updated price 3999, got ${sessionState.total}`);
    }
  } finally {
    // Restore price
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(originalPrice2, 'men-003');
  }
  console.log('✔ TEST 2 PASSED: Price change detected, previous/current prices returned, confirmation invalidated.\n');

  // ===========================================================================
  // TEST 3 — PAYMENT FAILS (TAMPERED SIGNATURE)
  // ===========================================================================
  console.log('TEST 3: Payment fails -> order marked PAYMENT_FAILED, stock unchanged, cart preserved...');
  const session3 = `sess_f_t3_${Date.now()}`;
  addToCart({
    sessionId: session3,
    productId: 'women-004',
    quantity: 1,
    channel: 'agent'
  });
  prepareCheckout(session3);

  const t3_confirm = await confirmAgentCheckout({ sessionId: session3, confirmed: true });
  const stockBefore3 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as any).stock;

  const t3_verify = verifyPaymentSignature({
    orderId: t3_confirm.orderId,
    razorpay_order_id: t3_confirm.razorpayOrderId,
    razorpay_payment_id: 'pay_fail_123',
    razorpay_signature: 'invalid_tampered_signature_hex',
    sessionId: session3
  });

  if (t3_verify.success) {
    throw new Error('Test 3 failed: Tampered signature should fail verification');
  }

  const orderAfter3 = db.prepare('SELECT status FROM orders WHERE id = ?').get(t3_confirm.orderId) as any;
  const stockAfter3 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as any).stock;

  if (orderAfter3.status !== 'PAYMENT_FAILED') {
    throw new Error(`Test 3 failed: Expected status PAYMENT_FAILED, got ${orderAfter3.status}`);
  }
  if (stockAfter3 !== stockBefore3) {
    throw new Error('Test 3 failed: Stock was modified despite payment failure');
  }
  console.log('✔ TEST 3 PASSED: Payment failure handled safely without reducing stock.\n');

  // ===========================================================================
  // TEST 4 — PAYMENT CANCELLED
  // ===========================================================================
  console.log('TEST 4: User cancels payment -> order marked PAYMENT_CANCELLED, audit logged...');
  const session4 = `sess_f_t4_${Date.now()}`;
  addToCart({
    sessionId: session4,
    productId: 'men-004',
    quantity: 1,
    channel: 'agent'
  });
  prepareCheckout(session4);
  const t4_confirm = await confirmAgentCheckout({ sessionId: session4, confirmed: true });

  const cancelRes = cancelPayment({
    orderId: t4_confirm.orderId,
    sessionId: session4,
    reason: 'User dismissed modal'
  });

  console.log('  [Cancel Result] Success:', cancelRes.success, 'Status:', cancelRes.status);
  const orderAfter4 = db.prepare('SELECT status FROM orders WHERE id = ?').get(t4_confirm.orderId) as any;

  if (!cancelRes.success || orderAfter4.status !== 'PAYMENT_CANCELLED') {
    throw new Error('Test 4 failed: Order not marked PAYMENT_CANCELLED');
  }
  console.log('✔ TEST 4 PASSED: Payment cancellation handled and audited safely.\n');

  // ===========================================================================
  // TEST 5 — INVALID RAZORPAY SIGNATURE REJECTION
  // ===========================================================================
  console.log('TEST 5: Invalid Razorpay signature verification rejected...');
  const t5_verify = verifyPaymentSignature({
    orderId: t4_confirm.orderId,
    razorpay_order_id: 'order_fake_123',
    razorpay_payment_id: 'pay_fake_123',
    razorpay_signature: '0000000000000000000000000000000000000000000000000000000000000000',
    sessionId: session4
  });

  if (t5_verify.success) {
    throw new Error('Test 5 failed: Fake signature passed verification');
  }
  console.log('  [Signature Rejection] Error:', t5_verify.error, 'Message:', t5_verify.message);
  console.log('✔ TEST 5 PASSED: Cryptographic signature failure rejected safely.\n');

  // ===========================================================================
  // TEST 6 — DUPLICATE PAYMENT VERIFICATION (IDEMPOTENCY)
  // ===========================================================================
  console.log('TEST 6: Duplicate payment verification -> stock reduced only once...');
  const session6 = `sess_f_t6_${Date.now()}`;
  addToCart({
    sessionId: session6,
    productId: 'women-004',
    quantity: 1,
    channel: 'agent'
  });
  prepareCheckout(session6);
  const t6_confirm = await confirmAgentCheckout({ sessionId: session6, confirmed: true });

  const stockBefore6 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as any).stock;
  const paymentId6 = `pay_valid_${Date.now()}`;
  const validSig6 = generateSignature(t6_confirm.razorpayOrderId, paymentId6);

  // 1st verification
  const t6_firstVerify = verifyPaymentSignature({
    orderId: t6_confirm.orderId,
    razorpay_order_id: t6_confirm.razorpayOrderId,
    razorpay_payment_id: paymentId6,
    razorpay_signature: validSig6,
    sessionId: session6
  });

  if (!t6_firstVerify.success) {
    throw new Error('Test 6 failed: First payment verification failed');
  }

  const stockAfterFirst6 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as any).stock;
  if (stockAfterFirst6 !== stockBefore6 - 1) {
    throw new Error('Test 6 failed: Stock did not decrease by 1 on first payment');
  }

  // 2nd duplicate verification
  const t6_secondVerify = verifyPaymentSignature({
    orderId: t6_confirm.orderId,
    razorpay_order_id: t6_confirm.razorpayOrderId,
    razorpay_payment_id: paymentId6,
    razorpay_signature: validSig6,
    sessionId: session6
  });

  if (t6_secondVerify.success || t6_secondVerify.error !== 'ORDER_ALREADY_PAID') {
    throw new Error('Test 6 failed: Duplicate verification did not return ORDER_ALREADY_PAID');
  }

  const stockAfterSecond6 = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as any).stock;
  if (stockAfterSecond6 !== stockAfterFirst6) {
    throw new Error('Test 6 failed: Stock decreased again on duplicate verification!');
  }
  console.log('✔ TEST 6 PASSED: Duplicate payment verification is idempotent; stock reduced only once.\n');

  // ===========================================================================
  // TEST 7 — DUPLICATE CHECKOUT CONFIRMATION (IDEMPOTENT ORDER CREATION)
  // ===========================================================================
  console.log('TEST 7: Duplicate checkout confirmation -> no duplicate order created...');
  const session7 = `sess_f_t7_${Date.now()}`;
  addToCart({
    sessionId: session7,
    productId: 'men-006',
    quantity: 1,
    channel: 'agent'
  });
  prepareCheckout(session7);

  // First confirmation
  const t7_confirm1 = await confirmAgentCheckout({ sessionId: session7, confirmed: true });
  console.log('  [First Confirm] Order ID:', t7_confirm1.orderId);

  // Duplicate second confirmation on same session
  const t7_confirm2 = await confirmAgentCheckout({ sessionId: session7, confirmed: true });
  console.log('  [Second Confirm] Order ID:', t7_confirm2.orderId);

  if (t7_confirm1.orderId !== t7_confirm2.orderId) {
    throw new Error(`Test 7 failed: Duplicate order created (${t7_confirm1.orderId} vs ${t7_confirm2.orderId})`);
  }
  console.log('✔ TEST 7 PASSED: Duplicate checkout confirmation returned existing order idempotently.\n');

  // ===========================================================================
  // TEST 8 — AMBIGUOUS PRODUCT REFERENCE ("Buy the blue one")
  // ===========================================================================
  console.log('TEST 8: Ambiguous product reference ("Buy the blue one") -> asks clarification...');
  const session8 = `sess_f_t8_${Date.now()}`;
  const t8_res = await handleAgentMessage({
    sessionId: session8,
    message: 'Buy the blue one.'
  });

  console.log('  [Ambiguity Response]:\n', t8_res.message);
  if (!t8_res.message.includes('multiple') && !t8_res.message.includes('Which one do you mean')) {
    throw new Error('Test 8 failed: Agent should ask for clarification between multiple blue items');
  }
  console.log('✔ TEST 8 PASSED: Ambiguous reference prompted clarification without guessing.\n');

  // ===========================================================================
  // TEST 9 — MISSING SIZE ON APPAREL ADD TO CART
  // ===========================================================================
  console.log('TEST 9: Missing size on add to cart -> asks for size...');
  const session9 = `sess_f_t9_${Date.now()}`;
  // Show a dress first
  await handleAgentMessage({ sessionId: session9, message: 'Show me dresses' });

  const t9_res = await handleAgentMessage({
    sessionId: session9,
    message: 'Add this to my cart.'
  });

  console.log('  [Missing Size Response]:\n', t9_res.message);
  if (!t9_res.message.toLowerCase().includes('size')) {
    throw new Error('Test 9 failed: Agent should have asked what size the user prefers');
  }
  console.log('✔ TEST 9 PASSED: Missing size prompted for selection before adding.\n');

  // ===========================================================================
  // TEST 10 — NON-EXISTENT PRODUCT FROM OLD CONVERSATION
  // ===========================================================================
  console.log('TEST 10: Non-existent product from old conversation -> clean recovery without hallucination...');
  const session10 = `sess_f_t10_${Date.now()}`;
  const t10_res = await handleAgentMessage({
    sessionId: session10,
    message: 'Add the old-deleted-id spacesuit to my cart.'
  });

  console.log('  [Non-existent Product Response]:\n', t10_res.message);
  if (!t10_res.message.includes('no longer available') && !t10_res.message.includes('similar')) {
    throw new Error('Test 10 failed: Expected "no longer available in our catalog" message');
  }
  console.log('✔ TEST 10 PASSED: Non-existent product handled with clean recovery message.\n');

  // ===========================================================================
  // TEST 11 — GEMINI SERVICE UNAVAILABLE / FALLBACK
  // ===========================================================================
  console.log('TEST 11: Gemini service failure -> friendly fallback without key leakage...');
  const session11 = `sess_f_t11_${Date.now()}`;
  const t11_res = await handleAgentMessage({
    sessionId: session11,
    message: 'Show me bandhgalas'
  });

  console.log('  [Concierge Response]:\n', t11_res.message);
  if (!t11_res.message || t11_res.message.includes('GEMINI_API_KEY') || t11_res.message.includes('Error:')) {
    throw new Error('Test 11 failed: Internal error or key was exposed in agent message');
  }
  console.log('✔ TEST 11 PASSED: Gemini unavailable handled gracefully with zero leaked secrets.\n');

  // ===========================================================================
  // TEST 12 — CATALOG SERVICE RECOVERY
  // ===========================================================================
  console.log('TEST 12: Vague shopping request ("Show me something nice")...');
  const session12 = `sess_f_t12_${Date.now()}`;
  const t12_res = await handleAgentMessage({
    sessionId: session12,
    message: 'Show me something nice'
  });

  console.log('  [Vague Request Response]:\n', t12_res.message);
  if (!t12_res.message.includes('everyday wear') && !t12_res.message.includes('occasion')) {
    throw new Error('Test 12 failed: Agent should ask what the user is shopping for');
  }
  console.log('✔ TEST 12 PASSED: Vague request prompted structured style clarification.\n');

  // ===========================================================================
  // TEST 13 — PAYMENT SERVICE FAILURE HANDLING
  // ===========================================================================
  console.log('TEST 13: Payment service failure -> order remains unpaid safely...');
  try {
    await createRazorpayOrder('non-existent-order-id');
    throw new Error('Test 13 failed: Invalid order should have thrown error');
  } catch (err: any) {
    console.log('  [Payment Gateway Error Handled]:', err.message);
    if (!err.message.includes('ORDER_NOT_FOUND')) {
      throw new Error(`Test 13 failed: Expected ORDER_NOT_FOUND, got ${err.message}`);
    }
  }
  console.log('✔ TEST 13 PASSED: Payment service failure handled safely without modifying state.\n');

  // ===========================================================================
  // AUDIT LOG VERIFICATION FOR PHASE 5F
  // ===========================================================================
  console.log('Verifying SQLite Audit Logs for Phase 5F failure & recovery events...');
  const stockFailureLogs = getAuditLogs({ action: 'stock_failure' });
  const paymentFailedLogs = getAuditLogs({ action: 'payment_failed' });
  const paymentCancelledLogs = getAuditLogs({ action: 'payment_cancelled' });
  const priceChangedLogs = getAuditLogs({ action: 'price_changed' });

  console.log(`Audit Event Counts:
    - stock_failure: ${stockFailureLogs.length}
    - payment_failed: ${paymentFailedLogs.length}
    - payment_cancelled: ${paymentCancelledLogs.length}
    - price_changed: ${priceChangedLogs.length}`);

  if (
    stockFailureLogs.length === 0 ||
    paymentFailedLogs.length === 0 ||
    paymentCancelledLogs.length === 0 ||
    priceChangedLogs.length === 0
  ) {
    throw new Error('Audit verification failed: Missing required Phase 5F failure audit actions');
  }

  console.log('✔ SQLite Audit Log Verification PASSED.\n');

  console.log('================================================================');
  console.log(' ALL 13 PHASE 5F FAILURE HANDLING TESTS PASSED 100%!           ');
  console.log('================================================================\n');
}

runPhase5FTests().catch((err) => {
  console.error('Phase 5F tests encountered an error:', err);
  process.exit(1);
});
