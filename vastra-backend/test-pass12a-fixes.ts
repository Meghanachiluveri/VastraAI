import { db, initDatabase } from './src/db/db';
import { seedProducts } from './src/db/seed';
import { handleAgentMessage } from './src/services/agentService';
import { getAllProducts, recommendProducts } from './src/services/catalogService';
import { createOrder } from './src/services/orderService';
import { cancelPayment, createRazorpayOrder, verifyPaymentSignature } from './src/services/paymentService';
import crypto from 'crypto';

async function runPass12AFixesTests() {
  console.log('================================================================');
  console.log('   BUG FIX PASS 12A: CORRECTIVE QA & VERIFICATION AUDIT         ');
  console.log('================================================================\n');

  initDatabase();
  seedProducts();

  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || 'vastra_secret_key_12345';

  // ===========================================================================
  // TEST 1 — RAZORPAY TEST MODE PAYMENT & SETTLEMENT FLOW
  // ===========================================================================
  console.log('TEST 1: Razorpay Test Mode Order Creation -> Signature Verification -> Settlement...');
  const testSessionId = `sess_fix12a_${Date.now()}`;

  // 1. Create order
  const orderRes = createOrder({
    channel: 'human',
    sessionId: testSessionId,
    items: [{ productId: 'men-003', quantity: 1, size: '40', color: 'Crisp White' }],
    confirmed: true,
    customerInfo: { name: 'Priya Sharma', email: 'priya.sharma@example.com' }
  });

  if (!orderRes.success || !orderRes.order) {
    throw new Error('Test 1 failed: Could not create order');
  }

  const orderId = orderRes.order.id;
  const stockBefore = (db.prepare('SELECT stock FROM products WHERE id = ?').get('men-003') as any).stock;

  // 2. Create Razorpay Order
  const paymentOrder = await createRazorpayOrder(orderId, testSessionId);
  console.log('  [Razorpay Order ID Generated]:', paymentOrder.razorpayOrderId);
  console.log('  [Amount in Paise]:', paymentOrder.amount, '(₹' + paymentOrder.amount / 100 + ')');

  if (!paymentOrder.razorpayOrderId || paymentOrder.amount <= 0) {
    throw new Error('Test 1 failed: Invalid Razorpay order response');
  }

  // 3. Generate Cryptographic Signature & Verify
  const testPaymentId = `pay_test_${Date.now()}_12a`;
  const signature = crypto
    .createHmac('sha256', rzpKeySecret)
    .update(`${paymentOrder.razorpayOrderId}|${testPaymentId}`)
    .digest('hex');

  const verifyRes = verifyPaymentSignature({
    orderId,
    razorpay_order_id: paymentOrder.razorpayOrderId,
    razorpay_payment_id: testPaymentId,
    razorpay_signature: signature,
    sessionId: testSessionId
  });

  if (!verifyRes.success) {
    throw new Error('Test 1 failed: Signature verification failed');
  }

  const orderDb = db.prepare('SELECT status FROM orders WHERE id = ?').get(orderId) as any;
  const stockAfter = (db.prepare('SELECT stock FROM products WHERE id = ?').get('men-003') as any).stock;

  console.log('  [Order Status]:', orderDb.status);
  console.log('  [Stock Before -> After]:', stockBefore, '->', stockAfter);

  if (orderDb.status !== 'PAID' || stockAfter !== stockBefore - 1) {
    throw new Error('Test 1 failed: Order not marked PAID or stock not decremented');
  }
  console.log('✔ TEST 1 PASSED: Razorpay Test Mode checkout and settlement verified.\n');

  // ===========================================================================
  // TEST 2 — CATALOG PRICING DISTRIBUTION (>= 80% <= ₹10,000)
  // ===========================================================================
  console.log('TEST 2: Catalog Pricing Distribution (>= 24 of 30 products <= ₹10,000)...');
  const products = getAllProducts();
  console.log('  [Total Seeded Products]:', products.length);

  const belowOrEqual10k = products.filter((p) => p.price <= 10000);
  const above10k = products.filter((p) => p.price > 10000);

  console.log('  [Products <= ₹10,000]:', belowOrEqual10k.length, `(${((belowOrEqual10k.length / products.length) * 100).toFixed(1)}%)`);
  console.log('  [Products > ₹10,000]:', above10k.length, `(${((above10k.length / products.length) * 100).toFixed(1)}%)`);

  if (products.length !== 30) {
    throw new Error(`Test 2 failed: Expected 30 products, found ${products.length}`);
  }
  if (belowOrEqual10k.length < 24) {
    throw new Error(`Test 2 failed: Expected >= 24 products <= ₹10,000, found ${belowOrEqual10k.length}`);
  }
  for (const p of products) {
    if (p.price <= 0 || p.stock < 0 || p.rating < 0 || !p.imageUrl || !p.name) {
      throw new Error(`Test 2 failed: Invalid product integrity in ${p.id}`);
    }
  }
  console.log('✔ TEST 2 PASSED: Catalog pricing distribution complies with >= 80% <= ₹10,000 requirement.\n');

  // ===========================================================================
  // TEST 3 — AI RECOMMENDATION STRICT BUDGET CONSTRAINT ("black dress under ₹5000")
  // ===========================================================================
  console.log('TEST 3: AI Recommendation Strict Budget Constraint ("black dress under ₹5000")...');
  const recRes = recommendProducts({
    query: 'black dress',
    category: 'dresses',
    maxPrice: 5000
  });

  if (!recRes.topRecommendation) {
    throw new Error('Test 3 failed: No recommendation returned for black dress under ₹5000');
  }

  console.log('  [Top Recommendation]:', recRes.topRecommendation.productName, '(₹' + recRes.topRecommendation.price + ')');
  console.log('  [Reason]:', recRes.topRecommendation.reason);

  if (recRes.topRecommendation.price > 5000) {
    throw new Error(`Test 3 failed: Recommended product priced at ₹${recRes.topRecommendation.price} exceeds budget of ₹5000`);
  }

  // Also test conversational agent
  const agentRes = await handleAgentMessage({
    sessionId: `sess_rec_${Date.now()}`,
    message: 'Find me a black dress under ₹5000'
  });
  console.log('  [Agent Response]:', agentRes.message.substring(0, 100) + '...');
  console.log('✔ TEST 3 PASSED: Strict budget constraints enforced on AI recommendations.\n');

  // ===========================================================================
  // TEST 4 — PAYMENT CANCELLATION PRESERVES CART & INVENTORY
  // ===========================================================================
  console.log('TEST 4: Payment cancellation preserves cart and inventory...');
  const cancelOrderRes = createOrder({
    channel: 'human',
    items: [{ productId: 'men-006', quantity: 2, size: 'L' }],
    confirmed: true
  });

  if (!cancelOrderRes.success || !cancelOrderRes.order) {
    throw new Error('Test 4 failed: Could not create order for cancellation test');
  }

  const cancelOrderId = cancelOrderRes.order.id;
  const stockBeforeCancel = (db.prepare('SELECT stock FROM products WHERE id = ?').get('men-006') as any).stock;

  cancelPayment({ orderId: cancelOrderId, reason: 'Dismissed by user' });

  const stockAfterCancel = (db.prepare('SELECT stock FROM products WHERE id = ?').get('men-006') as any).stock;
  const cancelStatus = (db.prepare('SELECT status FROM orders WHERE id = ?').get(cancelOrderId) as any).status;

  console.log('  [Order Status]:', cancelStatus);
  console.log('  [Stock Preserved]:', stockBeforeCancel === stockAfterCancel);

  if (cancelStatus !== 'PAYMENT_CANCELLED' || stockBeforeCancel !== stockAfterCancel) {
    throw new Error('Test 4 failed: Cancelled payment did not preserve stock');
  }
  console.log('✔ TEST 4 PASSED: Payment cancellation handled safely without deducting inventory.\n');

  console.log('================================================================');
  console.log(' ALL BUG FIX PASS 12A TESTS PASSED 100%!                       ');
  console.log('================================================================\n');
}

runPass12AFixesTests().catch((err) => {
  console.error('Pass 12A tests encountered an error:', err);
  process.exit(1);
});
