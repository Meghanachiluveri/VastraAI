import { db, initDatabase } from './db/db';
import { getAllProducts, searchProducts, recommendProducts, extractShoppingIntent } from './services/catalogService';
import { getCart, addToCart, removeFromCart, clearCart } from './services/cartService';
import { handleAgentMessage, confirmAgentCheckout } from './services/agentService';
import { createRazorpayOrder, verifyPaymentSignature, cancelPayment } from './services/paymentService';
import { authenticateMerchant, verifyMerchantToken } from './services/merchantAuthService';
import { getMerchantOverview } from './services/merchantService';
import { registerCustomer, addCustomerAddress } from './services/customerAuthService';

async function runComprehensiveTests() {
  console.log('====================================================');
  console.log('🧪 RUNNING VASTRA.AI COMPREHENSIVE TEST SUITE');
  console.log('====================================================\n');

  initDatabase();

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✅ PASS: ${testName}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${testName}${detail ? ` - ${detail}` : ''}`);
      failed++;
    }
  }

  // TEST 1: Price Calibration
  console.log('\n--- 1. Catalog & Price Calibration Check ---');
  const allProds = getAllProducts();
  const expensiveProds = allProds.filter(p => p.price > 10000);
  assert(expensiveProds.length === 0, 'All products are <= ₹10,000 limit', `Found ${expensiveProds.length} products > 10k`);
  assert(allProds.length >= 60, `Catalog has 60+ artisan products (Found: ${allProds.length})`);

  // TEST 2: Strict Category Filtering (Black dresses under ₹5000)
  console.log('\n--- 2. Strict Category Filtering: Black Dresses Under ₹5000 ---');
  const dressesRec = recommendProducts({ category: 'dresses', color: 'Black', maxPrice: 5000 });
  const foundProds = dressesRec.products;
  assert(foundProds.length > 0, `Found ${foundProds.length} black dresses under ₹5000`);
  const hasOnlyDresses = foundProds.every(p => p.category === 'dresses' || p.name.toLowerCase().includes('dress'));
  const hasNoAccessories = foundProds.every(p => p.category !== 'accessories' && !p.name.toLowerCase().includes('wallet') && !p.name.toLowerCase().includes('cardholder'));
  const allUnder5000 = foundProds.every(p => p.price <= 5000);
  assert(hasOnlyDresses, 'All returned items are actual dresses');
  assert(hasNoAccessories, 'Zero wallets, cardholders or accessories returned');
  assert(allUnder5000, 'All returned items are <= ₹5000');

  // TEST 3: Impossible Catalog Items
  console.log('\n--- 3. Impossible Items & Non-hallucination ---');
  const impossibleRes = await handleAgentMessage({
    message: 'Show me a purple leather astronaut suit',
    sessionId: 'test_sess_impossible_1',
  });
  assert(impossibleRes.products.length === 0, 'Zero products hallucinated for impossible item');
  assert(
    impossibleRes.message.includes("couldn't find that item") || impossibleRes.message.includes("collection"),
    'Polite and honest no-match message returned'
  );

  // TEST 4: Performance & Short-Circuiting Speed
  console.log('\n--- 4. Deterministic Short-Circuit Performance (<50ms) ---');
  const t0 = Date.now();
  const cartQueryRes = await handleAgentMessage({
    message: "What's in my bag?",
    sessionId: 'test_sess_speed_1',
  });
  const durationMs = Date.now() - t0;
  assert(durationMs < 50, `Deterministic query executed in ${durationMs}ms (< 50ms)`);
  assert(cartQueryRes.message.length > 0, 'Cart query returned prompt response');

  // TEST 5: Shared Cart Sync & Guardrail Enforcement
  console.log('\n--- 5. Cart Operations & ₹10,000 Guardrail ---');
  const testSessionId = `sess_test_${Date.now()}`;
  clearCart(testSessionId, 'agent');

  // Add 1 dress (e.g. ₹4,999)
  const targetDress = foundProds[0] || allProds.find(p => p.category === 'dresses')!;
  const addRes1 = addToCart({
    sessionId: testSessionId,
    productId: targetDress.id,
    quantity: 1,
    size: 'M',
    color: 'Black',
    channel: 'agent'
  });
  assert(addRes1.success, `Added ${targetDress.name} to cart`);
  let currentCart = getCart(testSessionId, 'agent');
  assert(currentCart.items.length === 1 && currentCart.total === targetDress.price, 'Cart total matches product price');

  // Attempt to add an expensive item that breaches ₹10,000 total
  const agentGuardrailRes = await handleAgentMessage({
    message: 'Add the Raw Mulberry Silk Bandhgala Jacket to my bag',
    sessionId: testSessionId,
  });
  assert(
    agentGuardrailRes.message.includes('exceeds') || agentGuardrailRes.message.includes('10,000'),
    'Agent prevented order from exceeding ₹10,000 spending limit'
  );
  currentCart = getCart(testSessionId, 'agent');
  assert(currentCart.total <= 10000, `Cart total (${currentCart.total}) remains <= ₹10,000`);

  // TEST 6: AI Checkout Preparation & Payment Verification
  console.log('\n--- 6. End-to-End Checkout Preparation, Payment & Cart Settlement ---');

  // 6A: Assert unauthenticated checkout requires login
  const unauthCheckoutPromptRes = await handleAgentMessage({
    message: 'Checkout',
    sessionId: testSessionId,
  });
  assert(
    Boolean(unauthCheckoutPromptRes.requireLogin || unauthCheckoutPromptRes.requiresAuth),
    'Unauthenticated checkout requires login'
  );

  // 6B: Register customer and add delivery address
  const testShopperEmail = `shopper_${Date.now()}@vastra.ai`;
  const shopper = registerCustomer({
    name: 'Priya Patel',
    email: testShopperEmail,
    password: 'Password123!',
    phone: '+91 98765 43210'
  });
  const shopperAddr = addCustomerAddress(shopper.customer!.id, {
    name: 'Priya Patel',
    phone: '+91 98765 43210',
    addressLine: '12 Khadi Lane',
    city: 'Ahmedabad',
    state: 'Gujarat',
    postalCode: '380015',
    isDefault: true
  });

  // 6C: Logged in customer with address prepares checkout
  const checkoutPromptRes = await handleAgentMessage({
    message: 'Checkout',
    sessionId: testSessionId,
    customerId: shopper.customer!.id,
    customerInfo: {
      customerId: shopper.customer!.id,
      name: 'Priya Patel',
      email: testShopperEmail,
      phone: '+91 98765 43210',
      address: shopperAddr.addressLine,
      city: shopperAddr.city,
      state: shopperAddr.state,
      postalCode: shopperAddr.postalCode
    },
    shippingAddress: shopperAddr
  });
  assert(checkoutPromptRes.checkout?.ready === true, 'Checkout prepared successfully with ready: true');
  assert(checkoutPromptRes.checkout?.items?.length === 1, 'Checkout contains exactly 1 item');

  // Initiate confirmation
  const confirmRes = await confirmAgentCheckout({
    sessionId: testSessionId,
    confirmed: true,
    customerId: shopper.customer!.id,
    customerInfo: {
      customerId: shopper.customer!.id,
      name: 'Priya Patel',
      email: testShopperEmail,
      phone: '+91 98765 43210',
      address: shopperAddr.addressLine,
      city: shopperAddr.city,
      state: shopperAddr.state,
      postalCode: shopperAddr.postalCode
    }
  });
  assert(confirmRes.success && Boolean(confirmRes.orderId), `Checkout confirmed with order ID: ${confirmRes.orderId}`);
  assert(confirmRes.totalAmount === targetDress.price, 'Order amount matches cart amount');

  // Verify cart is NOT cleared prior to verified payment
  const cartBeforePay = getCart(testSessionId, 'agent');
  assert(cartBeforePay.items.length === 1, 'Cart is safely preserved during checkout preparation');

  // Verify Payment Signature
  const initialStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get(targetDress.id) as any).stock;
  const payId = `pay_test_${Date.now()}`;
  const verifyRes = verifyPaymentSignature({
    orderId: confirmRes.orderId,
    razorpay_order_id: confirmRes.razorpayOrderId,
    razorpay_payment_id: payId,
    razorpay_signature: `mock_sig_${Date.now()}_test`,
    sessionId: testSessionId,
  });
  assert(verifyRes.success, 'Payment verified successfully');
  assert((verifyRes as any).order?.status === 'PAID', 'Order status updated to PAID in SQLite');

  // Check atomic stock decrement
  const newStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get(targetDress.id) as any).stock;
  assert(newStock === initialStock - 1, `Stock atomically decremented from ${initialStock} to ${newStock}`);

  // Check cart is cleared ONLY upon payment completion
  const cartAfterPay = getCart(testSessionId, 'agent');
  assert(cartAfterPay.items.length === 0, 'Cart successfully cleared upon verified payment');

  // Check Idempotency (calling verify again returns success without double decrementing stock)
  const verifyAgain = verifyPaymentSignature({
    orderId: confirmRes.orderId,
    razorpay_order_id: confirmRes.razorpayOrderId,
    razorpay_payment_id: payId,
    razorpay_signature: `mock_sig_${Date.now()}_test`,
    sessionId: testSessionId,
  });
  assert(verifyAgain.success, 'Idempotent verification succeeded');
  const finalStock = (db.prepare('SELECT stock FROM products WHERE id = ?').get(targetDress.id) as any).stock;
  assert(finalStock === newStock, 'Stock was not double-decremented on idempotent retry');

  // TEST 7: Payment Cancellation & Cart Preservation
  console.log('\n--- 7. Payment Cancellation Flow ---');
  const cancelSessionId = `sess_cancel_${Date.now()}`;
  addToCart({
    sessionId: cancelSessionId,
    productId: targetDress.id,
    quantity: 1,
    size: 'M',
    color: 'Black',
    channel: 'human'
  });
  await handleAgentMessage({
    message: 'Checkout',
    sessionId: cancelSessionId,
    customerId: shopper.customer!.id,
    customerInfo: {
      customerId: shopper.customer!.id,
      name: 'Priya Patel',
      email: testShopperEmail,
      phone: '+91 98765 43210',
      address: shopperAddr.addressLine,
      city: shopperAddr.city,
      state: shopperAddr.state,
      postalCode: shopperAddr.postalCode
    },
    shippingAddress: shopperAddr
  });
  const cancelOrderRes = await confirmAgentCheckout({
    sessionId: cancelSessionId,
    confirmed: true,
    customerId: shopper.customer!.id,
    customerInfo: {
      customerId: shopper.customer!.id,
      name: 'Priya Patel',
      email: testShopperEmail,
      phone: '+91 98765 43210',
      address: shopperAddr.addressLine,
      city: shopperAddr.city,
      state: shopperAddr.state,
      postalCode: shopperAddr.postalCode
    }
  });
  const cancelOutcome = cancelPayment({
    orderId: cancelOrderRes.orderId,
    sessionId: cancelSessionId,
    reason: 'User cancelled modal'
  });
  assert(cancelOutcome.success, 'Payment cancellation recorded');
  const cancelledOrderRow = db.prepare('SELECT status FROM orders WHERE id = ?').get(cancelOrderRes.orderId) as any;
  assert(cancelledOrderRow.status === 'PAYMENT_CANCELLED', 'Order status marked PAYMENT_CANCELLED');
  const cancelCart = getCart(cancelSessionId, 'human');
  assert(cancelCart.items.length === 1, 'Cart items safely preserved after payment cancellation');

  // TEST 8: Merchant Authentication & Isolated Analytics
  console.log('\n--- 8. Merchant Authentication & Real Database Analytics ---');
  const validMerchant = authenticateMerchant('merchant@vastra.ai', 'VastraMerchant2026!');
  assert(validMerchant.success && Boolean(validMerchant.token), 'Merchant credentials authenticated successfully');
  const invalidMerchant = authenticateMerchant('merchant@vastra.ai', 'WrongPassword123');
  assert(!invalidMerchant.success, 'Invalid merchant credentials rejected');

  const verifiedToken = verifyMerchantToken(validMerchant.token);
  assert(Boolean(verifiedToken && verifiedToken.email === 'merchant@vastra.ai'), 'Merchant JWT verified');

  const overview = getMerchantOverview();
  assert(typeof overview.totalRevenue === 'number' && overview.totalRevenue >= 0, 'Real database Total Revenue computed');
  assert(typeof overview.totalOrders === 'number' && overview.totalOrders >= 1, 'Real database Total Orders computed');
  assert(typeof overview.aiRevenue === 'number' && typeof overview.humanRevenue === 'number', 'AI and Human channel revenue computed');

  console.log('\n====================================================');
  console.log(`TEST SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log('====================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runComprehensiveTests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
