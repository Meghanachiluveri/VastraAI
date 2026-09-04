import crypto from 'crypto';
import { db, initDatabase } from './db/db';
import { seedProducts } from './db/seed';
import { getAllProducts, getProductById, getProductsByCategory, getProductsByGender, recommendProducts, searchProducts } from './services/catalogService';
import { addToCart, clearCart, getCart, removeFromCart } from './services/cartService';
import { createOrder, validateOrder, MAX_ORDER_VALUE } from './services/orderService';
import { createRazorpayOrder, verifyPaymentSignature } from './services/paymentService';
import { handleAgentMessage } from './services/agentService';
import { authenticateMerchant, verifyMerchantToken } from './services/merchantAuthService';
import { getMerchantOverview } from './services/merchantService';
import { runSimulation, getSimulationRuns } from './services/simulationService';
import { getAuditLogs } from './services/auditService';

async function runComprehensiveAudit() {
  console.log('================================================================');
  console.log('       VASTRA.AI — COMPREHENSIVE END-TO-END AUDIT SUITE         ');
  console.log('================================================================\n');

  initDatabase();
  seedProducts();

  const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET || 'vastra_secret_key_12345';
  let passedTests = 0;
  const totalTests = 14;

  // ---------------------------------------------------------------------------
  // TEST 1 — PRODUCT CATALOG RETRIEVAL & PRICING DISTRIBUTION
  // ---------------------------------------------------------------------------
  console.log('TEST 1: Product catalog inspection & pricing requirement (>= 75% <= ₹10,000)...');
  const allProducts = getAllProducts();
  console.log(`  [Total Products Seeded]: ${allProducts.length}`);
  
  if (allProducts.length < 30) {
    throw new Error(`Test 1 Failed: Expected at least 30 products, found ${allProducts.length}`);
  }

  const underOrEqual10k = allProducts.filter((p) => p.price <= 10000);
  const percentageUnder10k = (underOrEqual10k.length / allProducts.length) * 100;
  console.log(`  [Products <= ₹10,000]: ${underOrEqual10k.length}/${allProducts.length} (${percentageUnder10k.toFixed(1)}%)`);

  if (percentageUnder10k < 75) {
    throw new Error(`Test 1 Failed: Pricing requirement failed! Expected >= 75%, got ${percentageUnder10k}%`);
  }

  const luxuryOver10k = allProducts.filter((p) => p.price > 10000);
  console.log(`  [Luxury Items > ₹10,000 for Guardrail Testing]: ${luxuryOver10k.length} items`);
  console.log('✔ TEST 1 PASSED: Product catalog verified with valid pricing distribution.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 2 — PRODUCT FILTERING & SEARCHING
  // ---------------------------------------------------------------------------
  console.log('TEST 2: Multi-criteria product catalog filtering & search...');
  const menProducts = getProductsByGender('men');
  const womenProducts = getProductsByGender('women');
  const jacketProducts = getProductsByCategory('jackets');

  if (menProducts.length === 0 || womenProducts.length === 0 || jacketProducts.length === 0) {
    throw new Error('Test 2 Failed: Category / gender filtering returned empty sets');
  }

  const searchResults = searchProducts('organic linen');
  console.log(`  [Search "organic linen"]: Found ${searchResults.length} matching pieces`);
  if (searchResults.length === 0) {
    throw new Error('Test 2 Failed: Search query returned 0 results');
  }
  console.log('✔ TEST 2 PASSED: Catalog filtering and full-text search operational.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 3 — SHARED CART SYNCHRONIZATION (STOREFRONT & AI)
  // ---------------------------------------------------------------------------
  console.log('TEST 3: Shared Cart Synchronization between Human Storefront & AI Agent...');
  const sharedSessionId = `sess_shared_audit_${Date.now()}`;

  // 1. Human adds Product A
  addToCart({
    sessionId: sharedSessionId,
    productId: 'men-002', // Hand-Spun Khadi Linen Kurta (₹4,899)
    quantity: 1,
    size: 'L',
    color: 'Chalk White',
    channel: 'human'
  });

  // 2. AI retrieves cart and verifies Product A
  const aiCartView = getCart(sharedSessionId, 'agent');
  if (aiCartView.items.length !== 1 || aiCartView.items[0].productId !== 'men-002') {
    throw new Error('Test 3 Failed: AI agent cart did not reflect item added via Storefront');
  }

  // 3. AI adds Product B
  addToCart({
    sessionId: sharedSessionId,
    productId: 'uni-006', // Solid Brass & Saddle Leather Minimal Belt (₹2,499)
    quantity: 1,
    size: '34',
    color: 'Cognac Tan',
    channel: 'agent'
  });

  // 4. Human retrieves cart and verifies both products
  const humanCartView = getCart(sharedSessionId, 'human');
  if (humanCartView.items.length !== 2) {
    throw new Error('Test 3 Failed: Storefront cart did not reflect item added via AI agent');
  }

  // 5. AI removes Product A
  const itemToRemove = humanCartView.items.find((i) => i.productId === 'men-002')!;
  removeFromCart(sharedSessionId, itemToRemove.id, 'agent');

  const finalCart = getCart(sharedSessionId, 'human');
  if (finalCart.items.length !== 1 || finalCart.items[0].productId !== 'uni-006') {
    throw new Error('Test 3 Failed: Storefront cart did not reflect item removal by AI agent');
  }
  console.log('✔ TEST 3 PASSED: 100% shared cart synchronization verified.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 4 — INVENTORY PROTECTION & OVERSELLING PREVENTION
  // ---------------------------------------------------------------------------
  console.log('TEST 4: Server-side inventory protection against overselling...');
  const targetProduct = getProductById('men-001')!;
  const currentStock = targetProduct.stock;

  // Attempt to validate order requesting more than available stock
  const oversellValidation = validateOrder({
    channel: 'human',
    items: [{ productId: 'men-001', quantity: currentStock + 10, size: '40' }]
  });

  if (oversellValidation.valid || oversellValidation.reason !== 'INSUFFICIENT_STOCK') {
    throw new Error('Test 4 Failed: Server allowed order exceeding current warehouse inventory');
  }

  const stockAfter = getProductById('men-001')!.stock;
  if (stockAfter !== currentStock) {
    throw new Error('Test 4 Failed: Stock changed during failed validation');
  }
  console.log('✔ TEST 4 PASSED: Inventory safely guarded; stock cannot go negative.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 5 — DYNAMIC PRICE CHANGE DETECTION
  // ---------------------------------------------------------------------------
  console.log('TEST 5: Dynamic price change detection before checkout...');
  const priceTestSession = `sess_price_audit_${Date.now()}`;
  
  addToCart({
    sessionId: priceTestSession,
    productId: 'men-005', // Brushed Cotton Flannel Casual Shirt (₹2,999)
    quantity: 1,
    channel: 'human'
  });

  // Simulate price update in database from ₹2999 to ₹3299
  db.prepare('UPDATE products SET price = 3299 WHERE id = ?').run('men-005');

  const cartAfterPriceChange = getCart(priceTestSession, 'human');
  console.log('  [Price Change Detected]:', cartAfterPriceChange.priceChange?.priceChanged);
  console.log('  [Previous Price]: ₹', cartAfterPriceChange.priceChange?.previousPrice);
  console.log('  [Updated Current Price]: ₹', cartAfterPriceChange.priceChange?.currentPrice);

  if (!cartAfterPriceChange.priceChange || !cartAfterPriceChange.priceChange.priceChanged) {
    throw new Error('Test 5 Failed: Cart failed to detect database price change');
  }

  // Restore original price
  db.prepare('UPDATE products SET price = 2999 WHERE id = ?').run('men-005');
  console.log('✔ TEST 5 PASSED: Dynamic price changes flagged with reconfirmation requirement.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 6 — ₹10,000 SPENDING GUARDRAIL
  // ---------------------------------------------------------------------------
  console.log('TEST 6: Server-side ₹10,000 order guardrail enforcement...');
  
  // Valid order under ₹10,000
  const validOrderVal = validateOrder({
    channel: 'human',
    items: [{ productId: 'men-009', quantity: 1, size: 'M' }] // ₹9,499
  });
  if (!validOrderVal.valid || validOrderVal.total > MAX_ORDER_VALUE) {
    throw new Error('Test 6 Failed: Valid order under ₹10,000 was improperly rejected');
  }

  // Invalid order over ₹10,000
  const luxuryOrderVal = validateOrder({
    channel: 'agent',
    items: [{ productId: 'men-001', quantity: 1, size: '40' }] // ₹18,500
  });

  if (luxuryOrderVal.valid || luxuryOrderVal.reason !== 'ORDER_VALUE_LIMIT_EXCEEDED') {
    throw new Error('Test 6 Failed: Order over ₹10,000 was NOT rejected by guardrail');
  }
  console.log('✔ TEST 6 PASSED: ₹10,000 spending limit strictly enforced server-side.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 7 — AI CATALOG SEARCH & RECOMMENDATION GROUNDING
  // ---------------------------------------------------------------------------
  console.log('TEST 7: AI catalog recommendation grounding...');
  const recResult = recommendProducts({
    query: 'black dress under 5000',
    maxPrice: 5000,
    category: 'dresses'
  });

  if (!recResult.topRecommendation) {
    throw new Error('Test 7 Failed: No grounded recommendation found for query');
  }
  console.log('  [Top Recommended Piece]:', recResult.topRecommendation.productName, `(₹${recResult.topRecommendation.price})`);
  
  if (recResult.topRecommendation.price > 5000) {
    throw new Error('Test 7 Failed: Recommended item exceeded specified budget');
  }
  console.log('✔ TEST 7 PASSED: AI recommendations grounded in real catalog with budget constraints.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 8 — AI HALLUCINATION PREVENTION
  // ---------------------------------------------------------------------------
  console.log('TEST 8: AI hallucination prevention for non-existent items...');
  const hallucinationQueryRes = await handleAgentMessage({
    sessionId: `sess_hallucinate_${Date.now()}`,
    message: 'Show me a red leather trench coat'
  });

  console.log('  [AI Unavailability Response]:', hallucinationQueryRes.message.substring(0, 110) + '...');
  
  // The catalog has no red leather trench coat; AI response must indicate unavailability or recommend real alternatives
  const mentionedFakeItem = hallucinationQueryRes.products?.some((p) => p.name.toLowerCase().includes('red leather trench'));
  if (mentionedFakeItem) {
    throw new Error('Test 8 Failed: AI hallucinated a product not present in SQLite catalog');
  }
  console.log('✔ TEST 8 PASSED: Hallucination prevention active; fake items are not fabricated.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 9 — RAZORPAY PAYMENT SETTLEMENT FLOW
  // ---------------------------------------------------------------------------
  console.log('TEST 9: Razorpay Order Creation -> Signature Verification -> Stock Decrement...');
  const paySessionId = `sess_pay_audit_${Date.now()}`;
  
  const orderRes = createOrder({
    channel: 'human',
    sessionId: paySessionId,
    items: [{ productId: 'men-006', quantity: 2, size: 'M', color: 'Bone White' }],
    confirmed: true,
    customerInfo: { name: 'Vikram Mehta', email: 'vikram.mehta@example.com' }
  });

  if (!orderRes.success || !orderRes.order) {
    throw new Error('Test 9 Failed: Order creation failed');
  }

  const testOrderId = orderRes.order.id;
  const stockBeforePay = getProductById('men-006')!.stock;

  const paymentOrder = await createRazorpayOrder(testOrderId, paySessionId);
  console.log('  [Razorpay Order ID]:', paymentOrder.razorpayOrderId);
  console.log('  [Paise Amount]:', paymentOrder.amount, `(₹${paymentOrder.amount / 100})`);

  const testPaymentId = `pay_audit_${Date.now()}`;
  const validSig = crypto
    .createHmac('sha256', rzpKeySecret)
    .update(`${paymentOrder.razorpayOrderId}|${testPaymentId}`)
    .digest('hex');

  const verifyRes = verifyPaymentSignature({
    orderId: testOrderId,
    razorpay_order_id: paymentOrder.razorpayOrderId,
    razorpay_payment_id: testPaymentId,
    razorpay_signature: validSig,
    sessionId: paySessionId
  });

  if (!verifyRes.success || verifyRes.order?.status !== 'PAID') {
    throw new Error('Test 9 Failed: Payment signature verification failed');
  }

  const stockAfterPay = getProductById('men-006')!.stock;
  if (stockAfterPay !== stockBeforePay - 2) {
    throw new Error(`Test 9 Failed: Stock not decremented correctly. Before: ${stockBeforePay}, After: ${stockAfterPay}`);
  }
  console.log('✔ TEST 9 PASSED: Payment verified and inventory settled atomically.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 10 — PAYMENT IDEMPOTENCY
  // ---------------------------------------------------------------------------
  console.log('TEST 10: Payment verification idempotency (duplicate replay)...');
  const duplicateVerify = verifyPaymentSignature({
    orderId: testOrderId,
    razorpay_order_id: paymentOrder.razorpayOrderId,
    razorpay_payment_id: testPaymentId,
    razorpay_signature: validSig,
    sessionId: paySessionId
  });

  if (!duplicateVerify.success || duplicateVerify.order?.status !== 'PAID') {
    throw new Error('Test 10 Failed: Duplicate verification failed to return existing paid order');
  }

  const stockAfterDuplicate = getProductById('men-006')!.stock;
  if (stockAfterDuplicate !== stockAfterPay) {
    throw new Error('Test 10 Failed: Duplicate verification decremented inventory a second time!');
  }
  console.log('✔ TEST 10 PASSED: Payment idempotency safely verified; stock decremented only once.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 11 — SIMULATION ISOLATION FROM REAL COMMERCE
  // ---------------------------------------------------------------------------
  console.log('TEST 11: AI Shopping simulation isolation (50 shoppers)...');
  const initialRealOrders = (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as any).cnt;
  const initialStock = getProductById('men-003')!.stock;

  const simResult = runSimulation({ numberOfShoppers: 50 });
  console.log(`  [Simulation ID]: ${simResult.simulationId}`);
  console.log(`  [Shoppers]: ${simResult.numberOfShoppers}, [Conversions]: ${simResult.successfulOrders}, [Sim Revenue]: ₹${simResult.revenue.toLocaleString('en-IN')}`);

  const postSimRealOrders = (db.prepare('SELECT COUNT(*) as cnt FROM orders').get() as any).cnt;
  const postSimStock = getProductById('men-003')!.stock;

  if (initialRealOrders !== postSimRealOrders) {
    throw new Error('Test 11 Failed: Simulation leaked fake orders into real orders table!');
  }

  if (initialStock !== postSimStock) {
    throw new Error('Test 11 Failed: Simulation modified real inventory!');
  }

  const simRuns = getSimulationRuns(5);
  if (simRuns.length === 0 || simRuns[0].id !== simResult.simulationId) {
    throw new Error('Test 11 Failed: Simulation run was not persisted to simulation_runs table');
  }
  console.log('✔ TEST 11 PASSED: Simulation completely isolated from real commerce data.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 12 — MERCHANT AUTHENTICATION & JWT SECURITY
  // ---------------------------------------------------------------------------
  console.log('TEST 12: Merchant authentication & cryptographically signed bearer tokens...');
  
  // Valid login
  const authSuccess = authenticateMerchant('merchant@vastra.ai', 'VastraMerchant2026!');
  if (!authSuccess.success || !authSuccess.token) {
    throw new Error('Test 12 Failed: Valid merchant credentials rejected');
  }

  const verifiedPayload = verifyMerchantToken(authSuccess.token);
  if (!verifiedPayload || verifiedPayload.role !== 'merchant' || verifiedPayload.email !== 'merchant@vastra.ai') {
    throw new Error('Test 12 Failed: Merchant token verification failed or returned invalid claims');
  }

  // Invalid login
  const authFail = authenticateMerchant('merchant@vastra.ai', 'wrong_password_123');
  if (authFail.success) {
    throw new Error('Test 12 Failed: Invalid credentials should be rejected');
  }
  console.log('✔ TEST 12 PASSED: Merchant gateway secured with HMAC-signed tokens.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 13 — MERCHANT ANALYTICS CALCULATION
  // ---------------------------------------------------------------------------
  console.log('TEST 13: Merchant overview analytics & real revenue aggregation...');
  const overview = getMerchantOverview('all');

  console.log(`  [Total Revenue]: ₹${overview.totalRevenue.toLocaleString('en-IN')}`);
  console.log(`  [Total Orders]: ${overview.totalOrders} (AI: ${overview.aiOrders}, Web: ${overview.humanOrders})`);
  console.log(`  [Conversion Rate]: ${overview.aiConversionRate}%`);

  if (overview.totalOrders < 1) {
    throw new Error('Test 13 Failed: Expected at least 1 settled order in overview metrics');
  }
  console.log('✔ TEST 13 PASSED: Merchant analytics accurately aggregated from database.\n');
  passedTests++;

  // ---------------------------------------------------------------------------
  // TEST 14 — AUDIT LOG TRAIL & SANITIZATION
  // ---------------------------------------------------------------------------
  console.log('TEST 14: Audit log integrity & sensitive data sanitization...');
  const logs = getAuditLogs({ limit: 50 });

  if (logs.length === 0) {
    throw new Error('Test 14 Failed: Audit log table is empty');
  }

  for (const log of logs) {
    const rawDetails = JSON.stringify(log.details || {});
    if (
      rawDetails.includes('RAZORPAY_KEY_SECRET') ||
      rawDetails.includes('vastra_secret_key') ||
      rawDetails.includes('GEMINI_API_KEY') ||
      rawDetails.includes('VastraMerchant2026!')
    ) {
      throw new Error(`Test 14 Failed: Sensitive secret leaked in audit log ${log.id}`);
    }
  }
  console.log(`  [Verified ${logs.length} Audit Events]: Zero leaked secrets found.`);
  console.log('✔ TEST 14 PASSED: Audit trail intact and sanitized.\n');
  passedTests++;

  // ===========================================================================
  // SUMMARY
  // ===========================================================================
  console.log('================================================================');
  console.log(` ALL ${passedTests}/${totalTests} COMPREHENSIVE AUDIT TESTS PASSED 100%!       `);
  console.log('================================================================\n');
}

runComprehensiveAudit().catch((err) => {
  console.error('\n❌ Audit test encountered an error:', err);
  process.exit(1);
});
