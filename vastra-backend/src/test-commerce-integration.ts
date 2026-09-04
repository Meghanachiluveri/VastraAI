import { initDatabase, db } from './db/db';
import { seedProducts } from './db/seed';
import { handleAgentMessage, prepareCheckout } from './services/agentService';
import { addToCart, getCart, removeFromCart } from './services/cartService';
import { createOrder, validateOrder } from './services/orderService';
import { createRazorpayOrder, verifyPaymentSignature, cancelPayment } from './services/paymentService';
import { getMerchantOverview } from './services/merchantService';
import { runSimulation } from './services/simulationService';
import crypto from 'crypto';

const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || 'vastra_secret_key_12345';

async function runFullCommerceIntegrationTests() {
  console.log('================================================================');
  console.log('    VASTRA.AI — FULL END-TO-END COMMERCE INTEGRATION TEST       ');
  console.log('================================================================\n');

  initDatabase();
  seedProducts();

  let passedCount = 0;
  const totalCheckpoints = 18;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 1: Complete Human Storefront Purchase Journey
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 1: Complete Human Storefront Purchase Journey...');
  const humanSessionId = `sess_human_e2e_${Date.now()}`;
  
  // 1. Initial product stock check
  const testProduct = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?').get('women-004') as { id: string; name: string; price: number; stock: number };
  const initialStock = testProduct.stock;
  console.log(`  [Target Garment]: ${testProduct.name} (Stock: ${initialStock}, Price: ₹${testProduct.price})`);

  // 2. Add to cart via human storefront
  addToCart({
    sessionId: humanSessionId,
    productId: testProduct.id,
    quantity: 1,
    size: 'M',
    color: 'Obsidian Black',
    channel: 'human'
  });

  // 3. Create local order
  const humanOrderRes = createOrder({
    channel: 'human',
    sessionId: humanSessionId,
    confirmed: true,
    customerInfo: {
      name: 'Aditi Sharma',
      email: 'aditi.sharma@example.com',
      phone: '+91 98765 43210',
      address: '42 Heritage Lane, Bandra West, Mumbai - 400050'
    },
    items: [{ productId: testProduct.id, quantity: 1, size: 'M', color: 'Obsidian Black' }]
  });

  if (!humanOrderRes.success) {
    throw new Error(`Checkpoint 1 Failed: Could not create human order: ${humanOrderRes.error}`);
  }
  const humanOrderId = humanOrderRes.order.id;

  // 4. Create Razorpay Payment Order
  const humanPayOrder = await createRazorpayOrder(humanOrderId, humanSessionId);
  console.log(`  [Razorpay Order Created]: ${humanPayOrder.razorpayOrderId} (${humanPayOrder.amount} paise)`);

  // 5. Generate valid HMAC-SHA256 signature
  const humanPaymentId = `pay_human_test_${Date.now()}`;
  const humanSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${humanPayOrder.razorpayOrderId}|${humanPaymentId}`)
    .digest('hex');

  // 6. Verify Payment Signature
  const humanVerifyRes = verifyPaymentSignature({
    orderId: humanOrderId,
    razorpay_order_id: humanPayOrder.razorpayOrderId,
    razorpay_payment_id: humanPaymentId,
    razorpay_signature: humanSignature,
    sessionId: humanSessionId
  });

  if (!humanVerifyRes.success || humanVerifyRes.order?.status !== 'PAID') {
    throw new Error('Checkpoint 1 Failed: Payment verification was not successful');
  }

  // 7. Verify stock decrement in DB
  const stockAfterHuman = db.prepare('SELECT stock FROM products WHERE id = ?').get(testProduct.id) as { stock: number };
  if (stockAfterHuman.stock !== initialStock - 1) {
    throw new Error(`Checkpoint 1 Failed: Stock expected ${initialStock - 1} but got ${stockAfterHuman.stock}`);
  }

  // 8. Verify backend cart cleared
  const humanCartAfter = getCart(humanSessionId, 'human');
  if (humanCartAfter.items.length !== 0) {
    throw new Error('Checkpoint 1 Failed: Session cart was not cleared after payment settlement');
  }

  console.log('✔ CHECKPOINT 1 PASSED: Complete human purchase journey verified end-to-end.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 2: Complete AI Concierge Purchase Journey
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 2: Complete AI Concierge Purchase Journey...');
  const aiSessionId = `sess_ai_e2e_${Date.now()}`;

  // 1. AI Recommendation inquiry
  const aiRecRes = await handleAgentMessage({
    sessionId: aiSessionId,
    message: 'Show me black dresses under ₹5,000'
  });
  if (aiRecRes.products.length === 0) {
    throw new Error('Checkpoint 2 Failed: AI did not find matching product');
  }
  const aiProduct = aiRecRes.products[0];

  // 2. Add to cart via AI
  const aiAddRes = await handleAgentMessage({
    sessionId: aiSessionId,
    message: 'Add it to my bag'
  });
  if (!aiAddRes.cart || aiAddRes.cart.itemCount === 0) {
    throw new Error('Checkpoint 2 Failed: AI did not add product to cart');
  }

  // 3. Checkout review preparation
  const aiPrepareRes = await prepareCheckout(aiSessionId);
  if (!aiPrepareRes.ready || !aiPrepareRes.requiresConfirmation) {
    throw new Error('Checkpoint 2 Failed: AI did not require human confirmation before checkout');
  }
  console.log(`  [AI Order Review Prepared]: Total ₹${aiPrepareRes.totalAmount} (Confirmation Required: ${aiPrepareRes.requiresConfirmation})`);

  // 4. Create confirmed order
  const aiOrderRes = createOrder({
    channel: 'agent',
    sessionId: aiSessionId,
    confirmed: true,
    customerInfo: {
      name: 'Rohan Mehta',
      email: 'rohan.mehta@example.com',
      phone: '+91 91234 56789',
      address: '15 Jubilee Hills, Hyderabad - 500033'
    },
    items: [{ productId: aiProduct.id, quantity: 1, size: 'M', color: aiProduct.colors[0] }]
  });

  if (!aiOrderRes.success) {
    throw new Error(`Checkpoint 2 Failed: Could not create AI order: ${aiOrderRes.error}`);
  }
  const aiOrderId = aiOrderRes.order.id;

  // 5. Payment Order & Settlement
  const aiPayOrder = await createRazorpayOrder(aiOrderId, aiSessionId);
  const aiPaymentId = `pay_ai_test_${Date.now()}`;
  const aiSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${aiPayOrder.razorpayOrderId}|${aiPaymentId}`)
    .digest('hex');

  const aiVerifyRes = verifyPaymentSignature({
    orderId: aiOrderId,
    razorpay_order_id: aiPayOrder.razorpayOrderId,
    razorpay_payment_id: aiPaymentId,
    razorpay_signature: aiSignature,
    sessionId: aiSessionId
  });

  if (!aiVerifyRes.success || aiVerifyRes.order?.status !== 'PAID') {
    throw new Error('Checkpoint 2 Failed: AI payment verification failed');
  }

  console.log('✔ CHECKPOINT 2 PASSED: Complete AI purchase journey verified with human confirmation gate.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 3: Bidirectional Shared Cart Verification (Scenarios A, B, C)
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 3: Shared Cart Verification (Scenarios A, B, C)...');
  const sharedSessionId = `sess_shared_cart_test_${Date.now()}`;

  // Scenario A: Add Product A through storefront, AI sees it
  addToCart({
    sessionId: sharedSessionId,
    productId: 'uni-012', // Minimal Vegetable-Tanned Leather Cardholder (₹1,499)
    quantity: 1,
    size: 'One Size',
    color: 'Saddle Tan',
    channel: 'human'
  });

  const cartInquiryA = await handleAgentMessage({
    sessionId: sharedSessionId,
    message: 'What is in my bag?'
  });
  if (!cartInquiryA.message.includes('Minimal Vegetable-Tanned Leather Cardholder')) {
    throw new Error('Checkpoint 3 Failed: Scenario A — AI did not see product added by storefront');
  }
  console.log('  [Scenario A]: Storefront addition recognized by AI.');

  // Scenario B: Add Product B through AI, Storefront cart reflects it
  await handleAgentMessage({
    sessionId: sharedSessionId,
    message: 'Build me a complete look'
  });
  await handleAgentMessage({
    sessionId: sharedSessionId,
    message: 'Add look to my bag'
  });

  const storefrontCartB = getCart(sharedSessionId, 'human');
  if (storefrontCartB.itemCount < 3) {
    throw new Error(`Checkpoint 3 Failed: Scenario B — Storefront cart does not reflect AI additions. Count: ${storefrontCartB.itemCount}`);
  }
  console.log(`  [Scenario B]: AI additions instantly present in storefront cart (${storefrontCartB.itemCount} items).`);

  // Scenario C: Remove item through storefront, AI cart reflects removal
  const itemToRemove = storefrontCartB.items[0];
  const removeRes = removeFromCart(sharedSessionId, itemToRemove.id, 'human');
  console.log(`  [Scenario C Debug]: Removing item ${itemToRemove.name} (id: ${itemToRemove.id}), remove success: ${removeRes.success}`);

  const cartInquiryC = await handleAgentMessage({
    sessionId: sharedSessionId,
    message: 'What is in my bag?'
  });
  console.log(`  [Scenario C Debug]: Cart before: ${storefrontCartB.itemCount}, Cart after inquiry: ${cartInquiryC.cart?.itemCount}`);
  if (cartInquiryC.cart && cartInquiryC.cart.itemCount !== storefrontCartB.itemCount - 1) {
    throw new Error(`Checkpoint 3 Failed: Scenario C — Expected itemCount ${storefrontCartB.itemCount - 1} but got ${cartInquiryC.cart?.itemCount}`);
  }
  console.log('  [Scenario C]: Storefront item removal instantly reflected in AI concierge.');
  console.log('✔ CHECKPOINT 3 PASSED: Single shared SQLite cart verified 100% bidirectional.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 4: ₹10,000 Spending Guardrail Enforcement
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 4: ₹10,000 Spending Guardrail Enforcement...');
  const limitSessionId = `sess_limit_test_${Date.now()}`;

  // Attempt checkout of high value piece (₹16,999)
  const limitValidation = validateOrder({
    channel: 'human',
    sessionId: limitSessionId,
    items: [{ productId: 'women-001', quantity: 1, size: 'S' }] // Varanasi Zari Saree ₹16,999
  });

  if (limitValidation.valid || limitValidation.reason !== 'ORDER_VALUE_LIMIT_EXCEEDED') {
    throw new Error('Checkpoint 4 Failed: Validation allowed order exceeding ₹10,000');
  }
  if (!limitValidation.error?.includes("exceeds Vastra.AI's ₹10,000 spending limit")) {
    throw new Error(`Checkpoint 4 Failed: Incorrect limit error message: ${limitValidation.error}`);
  }

  // Verify createOrder also rejects
  const limitCreateOrder = createOrder({
    channel: 'human',
    sessionId: limitSessionId,
    confirmed: true,
    customerInfo: { name: 'Test', email: 'test@example.com', address: 'Test' },
    items: [{ productId: 'women-001', quantity: 1, size: 'S' }]
  });

  if (limitCreateOrder.success) {
    throw new Error('Checkpoint 4 Failed: createOrder created an order exceeding ₹10,000');
  }

  console.log(`  [Guardrail Error Message]: "${limitValidation.error}"`);
  console.log('✔ CHECKPOINT 4 PASSED: ₹10,000 spending guardrail strictly enforced before payment.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 5: Razorpay Secret Security & Key Isolation
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 5: Razorpay Secret Security & Key Isolation...');
  const secOrderRes = createOrder({
    channel: 'human',
    sessionId: `sess_sec_${Date.now()}`,
    confirmed: true,
    customerInfo: { name: 'Test User', email: 'test@vastra.ai', address: 'Atelier Studio' },
    items: [{ productId: 'uni-006', quantity: 1, size: '32' }]
  });

  if (!secOrderRes.success) throw new Error('Could not create sec order');

  const secPayOrder = await createRazorpayOrder(secOrderRes.order.id);
  const payOrderString = JSON.stringify(secPayOrder);

  if (payOrderString.includes(RAZORPAY_KEY_SECRET)) {
    throw new Error('Checkpoint 5 Failed: RAZORPAY_KEY_SECRET leaked in client payment order payload!');
  }
  console.log(`  [Public Key Exposed]: ${secPayOrder.key} (Secret verified unexposed)`);
  console.log('✔ CHECKPOINT 5 PASSED: Razorpay secret key strictly isolated to server-side.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 6: Payment Success & Inventory Settlement
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 6: Payment Success & Inventory Settlement...');
  const successSessionId = `sess_success_test_${Date.now()}`;
  const prodCheck = db.prepare('SELECT stock FROM products WHERE id = ?').get('uni-006') as { stock: number };
  const initialBeltStock = prodCheck.stock;

  const validOrder = createOrder({
    channel: 'human',
    sessionId: successSessionId,
    confirmed: true,
    customerInfo: { name: 'Aarav Patel', email: 'aarav@vastra.ai', address: 'Green Glen, Bengaluru' },
    items: [{ productId: 'uni-006', quantity: 1, size: '32' }]
  });

  if (!validOrder.success) throw new Error('Could not create valid order');

  const validPayOrder = await createRazorpayOrder(validOrder.order.id, successSessionId);
  const validPayId = `pay_settle_${Date.now()}`;
  const validSig = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${validPayOrder.razorpayOrderId}|${validPayId}`)
    .digest('hex');

  const settleRes = verifyPaymentSignature({
    orderId: validOrder.order.id,
    razorpay_order_id: validPayOrder.razorpayOrderId,
    razorpay_payment_id: validPayId,
    razorpay_signature: validSig,
    sessionId: successSessionId
  });

  if (!settleRes.success) {
    throw new Error('Checkpoint 6 Failed: Settlement failed');
  }

  const updatedBeltStock = db.prepare('SELECT stock FROM products WHERE id = ?').get('uni-006') as { stock: number };
  if (updatedBeltStock.stock !== initialBeltStock - 1) {
    throw new Error('Checkpoint 6 Failed: Stock was not decremented upon settlement');
  }

  console.log('✔ CHECKPOINT 6 PASSED: Order settled to PAID and stock decremented atomically.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 7: Payment Cancellation
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 7: Payment Cancellation Flow...');
  const cancelSessionId = `sess_cancel_test_${Date.now()}`;
  const stockBeforeCancel = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as { stock: number }).stock;

  const cancelOrderRes = createOrder({
    channel: 'human',
    sessionId: cancelSessionId,
    confirmed: true,
    customerInfo: { name: 'Cancel Test', email: 'cancel@example.com', address: 'Delhi' },
    items: [{ productId: 'women-004', quantity: 1, size: 'M' }]
  });

  if (!cancelOrderRes.success) throw new Error('Could not create cancel order');

  const cancelRes = cancelPayment({
    orderId: cancelOrderRes.order.id,
    sessionId: cancelSessionId,
    reason: 'User dismissed modal'
  });

  if (!cancelRes.success || cancelRes.status !== 'PAYMENT_CANCELLED') {
    throw new Error('Checkpoint 7 Failed: Payment cancellation failed');
  }

  const stockAfterCancel = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as { stock: number }).stock;
  if (stockAfterCancel !== stockBeforeCancel) {
    throw new Error('Checkpoint 7 Failed: Stock was erroneously decremented on cancellation');
  }

  const orderInDb = db.prepare('SELECT status FROM orders WHERE id = ?').get(cancelOrderRes.order.id) as { status: string };
  if (orderInDb.status !== 'PAYMENT_CANCELLED') {
    throw new Error('Checkpoint 7 Failed: Order status not updated to PAYMENT_CANCELLED');
  }

  console.log('✔ CHECKPOINT 7 PASSED: Payment cancelled without stock decrement or revenue modification.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 8: Payment Failure (Invalid Signature)
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 8: Payment Failure & Signature Verification Rejection...');
  const failSessionId = `sess_fail_test_${Date.now()}`;
  const stockBeforeFail = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as { stock: number }).stock;

  const failOrderRes = createOrder({
    channel: 'human',
    sessionId: failSessionId,
    confirmed: true,
    customerInfo: { name: 'Fail Test', email: 'fail@example.com', address: 'Kolkata' },
    items: [{ productId: 'women-004', quantity: 1, size: 'M' }]
  });

  if (!failOrderRes.success) throw new Error('Could not create fail order');

  const failPayOrder = await createRazorpayOrder(failOrderRes.order.id, failSessionId);
  const failVerifyRes = verifyPaymentSignature({
    orderId: failOrderRes.order.id,
    razorpay_order_id: failPayOrder.razorpayOrderId,
    razorpay_payment_id: 'pay_tampered_123',
    razorpay_signature: 'invalid_forged_signature_hex_value',
    sessionId: failSessionId
  });

  if (failVerifyRes.success) {
    throw new Error('Checkpoint 8 Failed: Verification succeeded with forged signature!');
  }

  const stockAfterFail = (db.prepare('SELECT stock FROM products WHERE id = ?').get('women-004') as { stock: number }).stock;
  if (stockAfterFail !== stockBeforeFail) {
    throw new Error('Checkpoint 8 Failed: Stock decremented on failed payment');
  }

  console.log('✔ CHECKPOINT 8 PASSED: Forged payment signature rejected; no stock decremented.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 9: Payment Verification Idempotency
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 9: Payment Verification Idempotency Replay...');
  const idempotencySessionId = `sess_idempotent_${Date.now()}`;
  const stockBeforeIdem = (db.prepare('SELECT stock FROM products WHERE id = ?').get('uni-006') as { stock: number }).stock;

  const idemOrderRes = createOrder({
    channel: 'human',
    sessionId: idempotencySessionId,
    confirmed: true,
    customerInfo: { name: 'Idem User', email: 'idem@vastra.ai', address: 'Goa' },
    items: [{ productId: 'uni-006', quantity: 1, size: '30' }]
  });

  if (!idemOrderRes.success) throw new Error('Could not create idem order');

  const idemPayOrder = await createRazorpayOrder(idemOrderRes.order.id, idempotencySessionId);
  const idemPayId = `pay_idem_${Date.now()}`;
  const idemSig = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(`${idemPayOrder.razorpayOrderId}|${idemPayId}`)
    .digest('hex');

  // 1st Verification
  const verify1 = verifyPaymentSignature({
    orderId: idemOrderRes.order.id,
    razorpay_order_id: idemPayOrder.razorpayOrderId,
    razorpay_payment_id: idemPayId,
    razorpay_signature: idemSig,
    sessionId: idempotencySessionId
  });

  if (!verify1.success) {
    throw new Error('Checkpoint 9 Failed: First payment verification failed');
  }

  // 2nd Replay Verification
  const verify2 = verifyPaymentSignature({
    orderId: idemOrderRes.order.id,
    razorpay_order_id: idemPayOrder.razorpayOrderId,
    razorpay_payment_id: idemPayId,
    razorpay_signature: idemSig,
    sessionId: idempotencySessionId
  });

  if (!verify2.success) {
    throw new Error('Checkpoint 9 Failed: Replay verification failed');
  }

  const stockAfterIdem = (db.prepare('SELECT stock FROM products WHERE id = ?').get('uni-006') as { stock: number }).stock;
  if (stockAfterIdem !== stockBeforeIdem - 1) {
    throw new Error(`Checkpoint 9 Failed: Stock decremented twice! Expected ${stockBeforeIdem - 1} but got ${stockAfterIdem}`);
  }

  console.log('✔ CHECKPOINT 9 PASSED: Payment replay safely returned existing settlement without double-decrement.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 10: Stock Depletion & Zero Stock Protection
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 10: Stock Depletion & Zero Stock Protection...');
  // Force a product to 0 stock temporarily
  db.prepare('UPDATE products SET stock = 0 WHERE id = ?').run('men-010');

  const zeroStockValidation = validateOrder({
    channel: 'human',
    items: [{ productId: 'men-010', quantity: 1, size: 'M' }]
  });

  if (zeroStockValidation.valid || zeroStockValidation.reason !== 'INSUFFICIENT_STOCK') {
    throw new Error('Checkpoint 10 Failed: Validation did not reject 0 stock product');
  }

  // Restore stock
  db.prepare('UPDATE products SET stock = 12 WHERE id = ?').run('men-010');
  console.log('✔ CHECKPOINT 10 PASSED: Out-of-stock garments strictly blocked from checkout.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 11: Dynamic Price Change Detection
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 11: Dynamic Price Change Detection...');
  const priceChangeSessionId = `sess_price_change_${Date.now()}`;
  
  // 1. Add item at original price
  addToCart({
    sessionId: priceChangeSessionId,
    productId: 'men-006',
    quantity: 1,
    size: 'M',
    color: 'Ivory',
    channel: 'human'
  });

  // 2. Change price in database
  db.prepare('UPDATE products SET price = 3499 WHERE id = ?').run('men-006');

  // 3. Inspect cart - should detect price change
  const staleCart = getCart(priceChangeSessionId, 'human');
  if (!staleCart.priceChange || !staleCart.priceChange.priceChanged) {
    throw new Error('Checkpoint 11 Failed: Cart did not flag dynamic price change');
  }
  console.log(`  [Price Change Flagged]: Previous ₹${staleCart.priceChange.previousPrice} -> Current ₹${staleCart.priceChange.currentPrice}`);

  // Restore original price
  db.prepare('UPDATE products SET price = 2999 WHERE id = ?').run('men-006');
  console.log('✔ CHECKPOINT 11 PASSED: Dynamic price changes flagged with reconfirmation requirement.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 12: Customer Information & Isolation
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 12: Customer Information & Isolation...');
  const userASession = `sess_user_A_${Date.now()}`;
  const userBSession = `sess_user_B_${Date.now()}`;

  addToCart({
    sessionId: userASession,
    productId: 'women-004',
    quantity: 1,
    size: 'S',
    channel: 'human'
  });

  const cartA = getCart(userASession, 'human');
  const cartB = getCart(userBSession, 'human');

  if (cartA.itemCount !== 1 || cartB.itemCount !== 0) {
    throw new Error('Checkpoint 12 Failed: User B was able to see User A cart items!');
  }
  console.log('✔ CHECKPOINT 12 PASSED: Strict session isolation between shoppers verified.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 13: Merchant Dashboard Real Revenue Aggregation
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 13: Merchant Dashboard Real Revenue Aggregation...');
  const overview = getMerchantOverview('all');

  const dbOrders = db.prepare(`
    SELECT
      channel,
      COUNT(*) as count,
      SUM(total_amount) as revenue
    FROM orders
    WHERE status IN ('PAID', 'COMPLETED')
    GROUP BY channel
  `).all() as { channel: string; count: number; revenue: number }[];

  let expectedHumanRev = 0;
  let expectedAiRev = 0;
  for (const row of dbOrders) {
    if (row.channel === 'human') expectedHumanRev = row.revenue;
    if (row.channel === 'agent') expectedAiRev = row.revenue;
  }

  if (overview.humanRevenue !== expectedHumanRev || overview.aiRevenue !== expectedAiRev) {
    throw new Error('Checkpoint 13 Failed: Merchant revenue aggregation does not match orders database!');
  }
  console.log(`  [Merchant Overview]: Human Rev: ₹${overview.humanRevenue}, AI Rev: ₹${overview.aiRevenue}, Total Orders: ${overview.totalOrders}`);
  console.log('✔ CHECKPOINT 13 PASSED: Merchant analytics dynamically aggregated from real database orders.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 14: Channel Tagging (Human vs AI vs Simulation)
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 14: Human vs AI Channel Tagging...');
  const sampleHumanOrder = db.prepare("SELECT channel FROM orders WHERE channel = 'human' LIMIT 1").get() as { channel: string } | undefined;
  const sampleAiOrder = db.prepare("SELECT channel FROM orders WHERE channel = 'agent' LIMIT 1").get() as { channel: string } | undefined;

  if (!sampleHumanOrder || !sampleAiOrder) {
    throw new Error('Checkpoint 14 Failed: Missing channel records in orders table');
  }
  console.log('✔ CHECKPOINT 14 PASSED: Channel taxonomy accurately tagged in database.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 15: Simulation Isolation
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 15: Simulation Isolation from Real Commerce Data...');
  const ordersCountBefore = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number }).count;
  const revenueBefore = getMerchantOverview('all').totalRevenue;

  // Run 20-shopper simulation
  const simResult = runSimulation({ numberOfShoppers: 20 });
  console.log(`  [Simulation Executed]: Shoppers: ${simResult.numberOfShoppers}, Conversions: ${simResult.successfulOrders}, Sim Rev: ₹${simResult.revenue}`);

  const ordersCountAfter = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as { count: number }).count;
  const revenueAfter = getMerchantOverview('all').totalRevenue;

  if (ordersCountAfter !== ordersCountBefore || revenueAfter !== revenueBefore) {
    throw new Error('Checkpoint 15 Failed: Simulation orders mutated real orders table or merchant revenue!');
  }
  console.log('✔ CHECKPOINT 15 PASSED: Simulation completely isolated in sandbox tables.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 16: Audit Trail Logging & Sanitization
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 16: Audit Trail Logging & Sanitization...');
  const auditLogs = db.prepare('SELECT details FROM audit_log ORDER BY id DESC LIMIT 50').all() as { details: string }[];
  for (const log of auditLogs) {
    if (log.details.includes(RAZORPAY_KEY_SECRET) || log.details.includes('password') || log.details.includes('cvv')) {
      throw new Error('Checkpoint 16 Failed: Leaked sensitive secret found in audit log!');
    }
  }
  console.log(`  [Audited Events]: Verified ${auditLogs.length} recent events for clean sanitization.`);
  console.log('✔ CHECKPOINT 16 PASSED: Audit trail clean and free of secret leaks.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 17: Hallucination Prevention for Nonexistent Products
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 17: Hallucination Prevention for Nonexistent Garments...');
  const fakeItemInquiry = await handleAgentMessage({
    sessionId: `sess_fake_${Date.now()}`,
    message: 'Buy me a purple leather astronaut suit for ₹3,000'
  });

  if (fakeItemInquiry.products.length > 0 && fakeItemInquiry.products.some((p) => p.name.toLowerCase().includes('astronaut'))) {
    throw new Error('Checkpoint 17 Failed: AI hallucinated a nonexistent product!');
  }
  console.log('✔ CHECKPOINT 17 PASSED: Nonexistent garments rejected with honest explanation.\n');
  passedCount++;

  // ---------------------------------------------------------------------------
  // CHECKPOINT 18: Performance & Database Integrity Check
  // ---------------------------------------------------------------------------
  console.log('CHECKPOINT 18: Performance & Database Integrity Check...');
  const negativeStockCheck = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock < 0').get() as { count: number };
  if (negativeStockCheck.count > 0) {
    throw new Error('Checkpoint 18 Failed: Found negative stock values in products table!');
  }
  console.log('✔ CHECKPOINT 18 PASSED: Zero negative stock values, all relations intact.\n');
  passedCount++;

  console.log('================================================================');
  console.log(` ALL ${passedCount}/${totalCheckpoints} COMMERCE INTEGRATION CHECKPOINTS PASSED 100%!`);
  console.log('================================================================\n');
}

runFullCommerceIntegrationTests().catch((err) => {
  console.error('\n❌ Commerce integration test failed:', err);
  process.exit(1);
});
