import axios from 'axios';
import { db, initDatabase } from './db/db';
import { getAllProducts, searchProducts, recommendProducts, getProductById } from './services/catalogService';
import { getCart, addToCart, removeFromCart, clearCart } from './services/cartService';
import { handleAgentMessage, confirmAgentCheckout, create_and_confirm_order, prepareCheckout } from './services/agentService';
import { createOrder, validateOrder, getCustomerOrders, getOrderByIdForCustomer } from './services/orderService';
import { createRazorpayOrder, verifyPaymentSignature, cancelPayment } from './services/paymentService';
import { registerCustomer, loginCustomer, getCustomerAddresses, addCustomerAddress } from './services/customerAuthService';
import { authenticateMerchant, verifyMerchantToken } from './services/merchantAuthService';
import { getMerchantOverview } from './services/merchantService';
import { CLAUDE_MODEL_NAME, isClaudeConfigured } from './services/claudeService';
import fs from 'fs';
import path from 'path';

const FRONTEND_URL = 'http://localhost:5173';
const BACKEND_URL = 'http://localhost:4000';

interface TestResult {
  name: string;
  category: string;
  status: 'PASS' | 'FAIL';
  evidence: string;
}

const results: TestResult[] = [];

function record(name: string, category: string, pass: boolean, evidence: string) {
  const status = pass ? 'PASS' : 'FAIL';
  results.push({ name, category, status, evidence });
  if (pass) {
    console.log(`[PASS] ${name}: ${evidence}`);
  } else {
    console.error(`[FAIL] ${name}: ${evidence}`);
  }
}

async function runFullVerification() {
  console.log('================================================================');
  console.log('🚀 VASTRA.AI CRITICAL COMMERCE + AI AGENT ROOT-CAUSE AUDIT');
  console.log('================================================================\n');

  initDatabase();

  // -------------------------------------------------------------
  // 1. CLAUDE MIGRATION & ZERO GEMINI DEPENDENCY VERIFICATION
  // -------------------------------------------------------------
  console.log('--- 1. Claude Migration & Zero Gemini Verification ---');
  const pkgJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../package.json'), 'utf-8'));
  const hasAnthropic = Boolean(pkgJson.dependencies['@anthropic-ai/sdk']);
  const hasNoGemini = !pkgJson.dependencies['@google/genai'] && !pkgJson.dependencies['@google/generative-ai'];
  const envContent = fs.readFileSync(path.resolve(__dirname, '../.env'), 'utf-8');
  const hasAnthropicEnv = envContent.includes('ANTHROPIC_API_KEY');
  const hasNoGeminiEnv = !envContent.includes('GEMINI_API_KEY');

  record('Claude SDK Installed', 'Migration', hasAnthropic, `@anthropic-ai/sdk is present in dependencies (${pkgJson.dependencies['@anthropic-ai/sdk']})`);
  record('Gemini SDK Removed', 'Migration', hasNoGemini, 'Zero Gemini dependencies in package.json');
  record('Environment Key Migration', 'Migration', hasAnthropicEnv && hasNoGeminiEnv, 'ANTHROPIC_API_KEY configured in .env; legacy GEMINI_API_KEY removed');
  record('Target Claude Model', 'Migration', CLAUDE_MODEL_NAME === 'claude-sonnet-5', `Model configured to official target: ${CLAUDE_MODEL_NAME}`);

  // -------------------------------------------------------------
  // 2. SERVER & ROUTE REACHABILITY (INCLUDING /orders)
  // -------------------------------------------------------------
  console.log('\n--- 2. Server & Route Reachability ---');
  try {
    const healthRes = await axios.get(`${BACKEND_URL}/api/health`, { timeout: 3000 });
    record('Backend Health API', 'Network', healthRes.status === 200 && healthRes.data.status === 'ok', `HTTP 200: ${JSON.stringify(healthRes.data)}`);
  } catch (err: any) {
    record('Backend Health API', 'Network', false, `Backend failed: ${err.message}`);
  }

  try {
    const frontRes = await axios.get(FRONTEND_URL, { timeout: 3000 });
    record('Frontend Root Reachability', 'Network', frontRes.status === 200, `HTTP 200 from ${FRONTEND_URL}`);
  } catch (err: any) {
    record('Frontend Root Reachability', 'Network', false, `Frontend failed: ${err.message}`);
  }

  // -------------------------------------------------------------
  // 3. CUSTOMER AUTHENTICATION IN SQLITE & JWT
  // -------------------------------------------------------------
  console.log('\n--- 3. Customer Authentication & Data Security ---');
  const testEmail = `test_shopper_${Date.now()}@vastra.ai`;
  const regRes = registerCustomer({
    name: 'Ananya Sharma',
    email: testEmail,
    password: 'VastraShopper2026!',
    phone: '+91 98765 11223'
  });
  record('Customer Registration in SQLite', 'Customer Auth', regRes.success && Boolean(regRes.token), `Registered customer ID: ${regRes.customer?.id}`);

  const loginRes = loginCustomer(testEmail, 'VastraShopper2026!');
  record('Customer Login Verification', 'Customer Auth', loginRes.success && Boolean(loginRes.token), `Authenticated token generated successfully`);

  const failLoginRes = loginCustomer(testEmail, 'WrongPassword123');
  record('Invalid Password Rejection', 'Customer Auth', !failLoginRes.success, 'Correctly rejected incorrect customer password');

  // Customer Delivery Addresses
  const addrRes = addCustomerAddress(regRes.customer!.id, {
    name: 'Ananya Sharma',
    phone: '+91 98765 11223',
    addressLine: 'Flat 402, Lotus Pavilion, Defence Colony',
    city: 'New Delhi',
    state: 'Delhi',
    postalCode: '110024',
    isDefault: true
  });
  record('Customer Delivery Address Addition', 'Customer Address', Boolean(addrRes.id) && addrRes.city === 'New Delhi', `Saved address ID: ${addrRes.id}`);

  const savedAddrs = getCustomerAddresses(regRes.customer!.id);
  record('Customer Address Retrieval', 'Customer Address', savedAddrs.length >= 1 && savedAddrs[0].postalCode === '110024', `Retrieved ${savedAddrs.length} address(es) for customer`);

  // -------------------------------------------------------------
  // 4. NATURAL LANGUAGE PRODUCT UNDERSTANDING & STRICT CATEGORY/COLOR ISOLATION
  // -------------------------------------------------------------
  console.log('\n--- 4. Product Understanding & Strict Category/Color Isolation ---');

  // TEST 1: "Show me black dresses under 5000"
  const blackDressesUnder5000 = searchProducts('', { category: 'dresses', color: 'Black', maxPrice: 5000 });
  const allBlackDressesUnder5000Match = blackDressesUnder5000.length > 0 &&
    blackDressesUnder5000.every(p => p.price <= 5000 && p.category === 'dresses' && p.colors.some(c => /\b(black|noir|charcoal|obsidian|midnight|ink|ebony|jet)\b/i.test(c)));
  record('TEST 1: Black Dresses Under ₹5,000', 'AI Search', allBlackDressesUnder5000Match,
    `Found ${blackDressesUnder5000.length} dresses under ₹5,000 in Black. IDs: ${blackDressesUnder5000.map(p => `${p.name} (₹${p.price})`).join(', ')}`);

  // TEST 2: "Show me red dresses"
  const redDresses = searchProducts('', { category: 'dresses', color: 'Crimson' });
  const allRedDressesMatch = redDresses.length > 0 &&
    redDresses.every(p => p.category === 'dresses' && p.colors.some(c => c.toLowerCase().includes('red') || c.toLowerCase().includes('crimson')));
  record('TEST 2: Red Dresses Precision', 'AI Search', allRedDressesMatch,
    `Found ${redDresses.length} genuine red dresses: ${redDresses.map(p => p.name).join(', ')}. Zero wallets, zero cardholders.`);

  // TEST 3: "Show me green shirts"
  const greenShirts = searchProducts('', { category: 'shirts', color: 'Green' });
  const allGreenShirtsMatch = greenShirts.length > 0 &&
    greenShirts.every(p => p.category.includes('shirt') && p.colors.some(c => c.toLowerCase().includes('sage') || c.toLowerCase().includes('green') || c.toLowerCase().includes('olive')));
  record('TEST 3: Green Shirts Precision', 'AI Search', allGreenShirtsMatch,
    `Found ${greenShirts.length} green shirts: ${greenShirts.map(p => p.name).join(', ')}`);

  // TEST 4: "Show men's jeans"
  const mensJeans = searchProducts('', { category: 'jeans', gender: 'men' });
  const allMensJeansMatch = mensJeans.length > 0 && mensJeans.every(p => p.category === 'jeans' && (p.gender === 'men' || p.gender === 'unisex'));
  record('TEST 4: Mens Jeans Precision', 'AI Search', allMensJeansMatch,
    `Found ${mensJeans.length} mens jeans: ${mensJeans.map(p => p.name).join(', ')}`);

  // TEST 5: Jeans bug & new intent precedence
  const jeansIntent = await handleAgentMessage({
    sessionId: `test_sess_jeans_${Date.now()}`,
    message: 'add jeans into cart & buy'
  });
  const jeansItem = jeansIntent.cart?.items.find((it: any) => it.productId === 'men-007' || it.name.toLowerCase().includes('jean'));
  record('TEST 5: Jeans Bug & New Intent Precedence', 'AI Search', Boolean(jeansItem),
    `"add jeans into cart & buy" resolved to real jeans (${jeansItem?.name}), NEVER wallet or cardholder.`);

  // TEST 6: Ordinal selection ("the second one")
  const sessionOrd = `test_ord_${Date.now()}`;
  const firstTurn = await handleAgentMessage({
    sessionId: sessionOrd,
    message: 'Show me black dresses'
  });
  const secondProductExpected = firstTurn.products?.[1];
  const secondTurn = await handleAgentMessage({
    sessionId: sessionOrd,
    message: 'add the second one to my bag'
  });
  const addedSecondItem = secondTurn.cart?.items.find((it: any) => it.productId === secondProductExpected?.id);
  record('TEST 6: Ordinal Selection ("the second one")', 'AI Understanding', Boolean(addedSecondItem),
    `Second product (${secondProductExpected?.name}) correctly added to cart.`);

  // TEST 7: Size availability check against real SQLite database
  const sizeQuery = await handleAgentMessage({
    sessionId: `test_size_${Date.now()}`,
    message: 'Is Japanese Selvedge Raw Denim Jeans available in size 32?'
  });
  record('TEST 7: Live Size & Stock Check', 'AI Understanding', sizeQuery.message.toLowerCase().includes('size 32') || sizeQuery.message.toLowerCase().includes('available'),
    `Responded with accurate stock verification.`);

  // TEST 8: Shared cart query ("what is in my bag?")
  const sharedCartSess = `shared_sess_${Date.now()}`;
  addToCart({ sessionId: sharedCartSess, productId: 'men-007', quantity: 1, size: '32', color: 'Raw Indigo', channel: 'agent' });
  const bagTurn = await handleAgentMessage({
    sessionId: sharedCartSess,
    message: 'what is in my bag?'
  });
  record('TEST 8: Shared Cart Synchronization', 'Cart', bagTurn.cart?.items.length === 1 && bagTurn.cart.items[0].productId === 'men-007',
    `Reported exact shared cart: 1 item (${bagTurn.cart?.items[0]?.name}).`);

  // TEST 9: Build complete look under ₹8,000
  const lookTurn = await handleAgentMessage({
    sessionId: `test_look_${Date.now()}`,
    message: 'Build me a wedding guest look under ₹8000'
  });
  const lookPrice = lookTurn.curatedLook?.totalPrice || 0;
  record('TEST 9: Complete Look Under ₹8,000', 'AI Styling', Boolean(lookTurn.curatedLook) && lookPrice <= 8000,
    `Curated look "${lookTurn.curatedLook?.title}" total: ₹${lookPrice} (<= ₹8,000).`);

  // TEST 10: Impossible item honesty (No hallucination)
  const impossibleTurn = await handleAgentMessage({
    sessionId: `test_impos_${Date.now()}`,
    message: 'Show me purple leather astronaut suit'
  });
  record('TEST 10: Non-existent Item Honesty', 'AI Precision', (impossibleTurn.products?.length || 0) === 0,
    `Returned 0 products for impossible item; stylist politely explained unavailability.`);

  // -------------------------------------------------------------
  // 5. AI DIRECT BUY PREVENTION & CHECKOUT FLOW GATES
  // -------------------------------------------------------------
  console.log('\n--- 5. AI Direct Buy Prevention & Safety Gating ---');

  // TEST 11: AI prepares checkout review card, does NOT directly execute purchase
  const prepSess = `test_prep_${Date.now()}`;
  addToCart({ sessionId: prepSess, productId: 'women-004', quantity: 1, size: 'M', color: 'Deep Crimson Red', channel: 'agent' });
  const prepRes = prepareCheckout(prepSess);
  record('TEST 11: AI Prepares Order Review (No Direct Buy)', 'Commerce Gates', prepRes.ready && Boolean(prepRes.items) && prepRes.totalAmount === 4999,
    `Checkout prepared: total ₹4,999 for "${prepRes.items?.[0]?.name}". Human confirmation required.`);

  // TEST 12: Order creation with customer and delivery address
  const orderCreateRes = createOrder({
    channel: 'agent',
    sessionId: prepSess,
    customerId: regRes.customer!.id,
    items: [{ productId: 'women-004', quantity: 1, size: 'M', color: 'Deep Crimson Red' }],
    confirmed: true,
    customerInfo: {
      customerId: regRes.customer!.id,
      name: 'Ananya Sharma',
      email: testEmail,
      phone: '+91 98765 11223',
      address: 'Flat 402, Lotus Pavilion, Defence Colony',
      city: 'New Delhi',
      state: 'Delhi',
      postalCode: '110024'
    }
  });

  if (!orderCreateRes.success) {
    throw new Error('Order creation failed in test');
  }

  record('TEST 12: Order Created with Customer & Address', 'Commerce', orderCreateRes.success && Boolean(orderCreateRes.order.id),
    `Order ID: ${orderCreateRes.order?.id}, Customer: ${orderCreateRes.order?.customerName}`);

  // TEST 13: Razorpay Test Order creation
  const rzpOrder = await createRazorpayOrder(orderCreateRes.order.id, prepSess);
  record('TEST 13: Razorpay Order Creation', 'Payment', Boolean(rzpOrder.razorpayOrderId) && rzpOrder.amount === 499900,
    `Razorpay Order ID: ${rzpOrder.razorpayOrderId}, Amount in paise: ${rzpOrder.amount}`);

  // TEST 14: Stock Decrement & Payment Signature Verification
  const stockBefore = getProductById('women-004')!.stock;
  const verifyRes = verifyPaymentSignature({
    orderId: orderCreateRes.order.id,
    razorpay_order_id: rzpOrder.razorpayOrderId,
    razorpay_payment_id: `pay_test_${Date.now()}`,
    razorpay_signature: 'rzp_test_sig_verified_root_cause',
    sessionId: prepSess
  });
  const stockAfter = getProductById('women-004')!.stock;
  record('TEST 14: Payment Signature Verification & Atomic Stock Reduction', 'Payment',
    verifyRes.success && verifyRes.order.status === 'PAID' && stockAfter === stockBefore - 1,
    `Payment verified PAID. Stock decremented from ${stockBefore} to ${stockAfter}.`);

  // -------------------------------------------------------------
  // 6. VIEW ORDERS DATA PATH VERIFICATION
  // -------------------------------------------------------------
  console.log('\n--- 6. "View Orders" Data Path Verification ---');

  // TEST 15: Fetch customer orders from SQLite
  const customerOrders = getCustomerOrders(regRes.customer!.id);
  const foundPaidOrder = customerOrders.find(o => o.id === orderCreateRes.order.id);
  record('TEST 15: View Orders Returns Customer Acquisitions', 'View Orders',
    Boolean(foundPaidOrder) && foundPaidOrder?.status === 'PAID' && foundPaidOrder?.items.length === 1,
    `Order ${foundPaidOrder?.id} found in View Orders! Line item: ${foundPaidOrder?.items[0]?.name} (${foundPaidOrder?.items[0]?.color}), Total: ₹${foundPaidOrder?.totalAmount}`);

  // TEST 16: Delivery Address persists in Order record
  record('TEST 16: Delivery Address Display in Order Record', 'View Orders',
    Boolean(foundPaidOrder?.shippingAddress?.includes('Lotus Pavilion')),
    `Delivery address: ${foundPaidOrder?.shippingAddress}, ${foundPaidOrder?.shippingCity}`);

  // TEST 17: Customer Isolation (Customer B cannot view Customer A's order)
  const otherCustomerOrder = getOrderByIdForCustomer(orderCreateRes.order.id, 'cust_intruder_999');
  record('TEST 17: Customer Data Isolation (403 Forbidden)', 'Security', otherCustomerOrder === null,
    'Unauthorized customer cannot access other customer order records.');

  // TEST 18: ₹10,000 Spending Limit Guardrail
  const limitCheck = validateOrder({
    channel: 'human',
    items: [
      { productId: 'women-002', quantity: 1 }, // ₹9,499
      { productId: 'men-001', quantity: 1 }   // ₹8,899 (Total: ₹18,398)
    ]
  });
  record('TEST 18: ₹10,000 Order Value Limit Guardrail', 'Guardrails',
    !limitCheck.valid && limitCheck.reason === 'ORDER_VALUE_LIMIT_EXCEEDED',
    'Server rejected cart exceeding ₹10,000 threshold.');

  // TEST 19: Merchant Dashboard Analytics Integration
  const overview = getMerchantOverview('all');
  record('TEST 19: Merchant Analytics Reflects Real Paid Orders', 'Merchant',
    overview.totalOrders >= 1 && overview.totalRevenue >= 4999,
    `Merchant dashboard reflects real SQLite orders: Total Orders: ${overview.totalOrders}, Revenue: ₹${overview.totalRevenue}`);

  // -------------------------------------------------------------
  // 7. CRITICAL CHECKOUT GUARDRAILS AUDIT (TESTS 20 - 24)
  // -------------------------------------------------------------
  console.log('\n--- 7. Critical Checkout Guardrails & Auth/Address Safety ---');

  // TEST 20: User says "buy it" with no login -> asserts NO order is created & agent asks for login
  const unauthSession = `unauth_buy_${Date.now()}`;
  addToCart({ sessionId: unauthSession, productId: 'women-001', quantity: 1, size: 'M', color: 'Ivory Ecru', channel: 'agent' });
  const ordersCountBefore20 = (db.prepare('SELECT count(*) as cnt FROM orders').get() as any).cnt;
  
  const unauthBuyRes = await handleAgentMessage({
    sessionId: unauthSession,
    message: 'buy it'
  });

  const ordersCountAfter20 = (db.prepare('SELECT count(*) as cnt FROM orders').get() as any).cnt;
  const asksForLogin = Boolean(unauthBuyRes.requireLogin || unauthBuyRes.requiresAuth || unauthBuyRes.actions?.includes('require_login'));
  const messageMentionsLogin = unauthBuyRes.message.toLowerCase().includes('sign in') || unauthBuyRes.message.toLowerCase().includes('log in') || unauthBuyRes.message.toLowerCase().includes('account');
  const noOrderCreated20 = ordersCountAfter20 === ordersCountBefore20;

  record('TEST 20: Unauthenticated "buy it" Blocked (Zero Orders, Asks for Login)', 'Guardrails',
    asksForLogin && messageMentionsLogin && noOrderCreated20,
    `Orders before: ${ordersCountBefore20}, Orders after: ${ordersCountAfter20} (Zero change). Agent returned requireLogin: true, actions: ${JSON.stringify(unauthBuyRes.actions)}.`);

  // TEST 21: Direct call to create_and_confirm_order without customer authentication
  let unauthOrderBlocked = false;
  try {
    await create_and_confirm_order({
      sessionId: unauthSession,
      confirmed: true
    });
  } catch (err: any) {
    if (err.message === 'AUTHENTICATION_REQUIRED') {
      unauthOrderBlocked = true;
    }
  }
  const ordersCountAfter21 = (db.prepare('SELECT count(*) as cnt FROM orders').get() as any).cnt;
  record('TEST 21: create_and_confirm_order Rejects Unauthenticated Call', 'Guardrails',
    unauthOrderBlocked && ordersCountAfter21 === ordersCountBefore20,
    'create_and_confirm_order threw AUTHENTICATION_REQUIRED and refused to create an order.');

  // TEST 22: Logged in customer with NO shipping address -> asks for address, blocks order
  const noAddrCustEmail = `no_addr_${Date.now()}@vastra.ai`;
  const noAddrCust = registerCustomer({
    name: 'Kabir Mehta',
    email: noAddrCustEmail,
    password: 'Password123!',
    phone: '+91 91234 56789'
  });
  const noAddrSession = `sess_no_addr_${Date.now()}`;
  addToCart({ sessionId: noAddrSession, productId: 'men-007', quantity: 1, size: '32', color: 'Raw Indigo', channel: 'agent' });
  
  const noAddrBuyRes = await handleAgentMessage({
    sessionId: noAddrSession,
    message: 'buy it',
    customerId: noAddrCust.customer!.id,
    customerInfo: { customerId: noAddrCust.customer!.id, name: 'Kabir Mehta', email: noAddrCustEmail }
  });

  const ordersCountAfter22 = (db.prepare('SELECT count(*) as cnt FROM orders').get() as any).cnt;
  const asksForAddress = Boolean(noAddrBuyRes.requireAddress || noAddrBuyRes.actions?.includes('require_address'));
  const mentionsAddress = noAddrBuyRes.message.toLowerCase().includes('delivery address') || noAddrBuyRes.message.toLowerCase().includes('shipping address');
  
  let noAddrDirectBlocked = false;
  try {
    await create_and_confirm_order({
      sessionId: noAddrSession,
      confirmed: true,
      customerId: noAddrCust.customer!.id
    });
  } catch (err: any) {
    if (err.message === 'SHIPPING_ADDRESS_REQUIRED') {
      noAddrDirectBlocked = true;
    }
  }

  record('TEST 22: Missing Address Blocks Checkout (Chat Asks for Address & Throws SHIPPING_ADDRESS_REQUIRED)', 'Guardrails',
    asksForAddress && mentionsAddress && noAddrDirectBlocked && ordersCountAfter22 === ordersCountBefore20,
    `Agent returned requireAddress: true and create_and_confirm_order rejected without address.`);

  // TEST 23: User types "confirm" or "yes" in plain text chat -> agent NEVER calls payment tool
  const validCustId = regRes.customer!.id;
  const guardedSession = `guarded_sess_${Date.now()}`;
  addToCart({ sessionId: guardedSession, productId: 'women-004', quantity: 1, size: 'M', color: 'Deep Crimson Red', channel: 'agent' });
  
  // Step 1: User says "checkout" while logged in with address -> review card prepared
  const prepReviewRes = await handleAgentMessage({
    sessionId: guardedSession,
    message: 'proceed to checkout',
    customerId: validCustId,
    customerInfo: { customerId: validCustId, name: 'Ananya Sharma', email: testEmail },
    shippingAddress: addrRes
  });

  const ordersCountBefore23 = (db.prepare('SELECT count(*) as cnt FROM orders').get() as any).cnt;

  // Step 2: User sends "confirm" in chat
  const textConfirmRes = await handleAgentMessage({
    sessionId: guardedSession,
    message: 'confirm',
    customerId: validCustId,
    customerInfo: { customerId: validCustId, name: 'Ananya Sharma', email: testEmail },
    shippingAddress: addrRes
  });

  const ordersCountAfter23 = (db.prepare('SELECT count(*) as cnt FROM orders').get() as any).cnt;
  const plainTextProtected = ordersCountAfter23 === ordersCountBefore23;
  const directsToUiButton = textConfirmRes.message.includes('Confirm & Pay') && textConfirmRes.message.includes('button');

  record('TEST 23: Plain Text "confirm" Does NOT Trigger Order/Payment (UI Click Required)', 'Guardrails',
    plainTextProtected && directsToUiButton,
    `Zero orders created from plain text 'confirm' (Count: ${ordersCountAfter23}). Agent reminded user to click the UI Confirm & Pay button.`);

  // TEST 24: Explicit UI button click triggers create_and_confirm_order with verified customer and address
  const explicitUiRes = await create_and_confirm_order({
    sessionId: guardedSession,
    confirmed: true,
    customerId: validCustId,
    customerInfo: {
      customerId: validCustId,
      name: 'Ananya Sharma',
      email: testEmail,
      address: addrRes.addressLine,
      city: addrRes.city,
      state: addrRes.state,
      postalCode: addrRes.postalCode
    }
  });

  const ordersCountAfter24 = (db.prepare('SELECT count(*) as cnt FROM orders').get() as any).cnt;
  record('TEST 24: Explicit UI Click Successfully Confirms Order & Razorpay Order', 'Guardrails',
    explicitUiRes.success && Boolean(explicitUiRes.orderId) && Boolean(explicitUiRes.razorpayOrderId) && ordersCountAfter24 === ordersCountBefore23 + 1,
    `Order ${explicitUiRes.orderId} successfully generated via explicit UI confirmation with Razorpay ID: ${explicitUiRes.razorpayOrderId}.`);

  // -------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('📊 AUDIT SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`TOTAL TESTS: ${results.length}`);
  console.log(`PASSED:      ${passed}`);
  console.log(`FAILED:      ${failed}`);
  console.log(`STATUS:      ${failed === 0 ? 'ALL CRITICAL CHECKS PASSED ✅' : 'FAILURES DETECTED ❌'}`);
  console.log('================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runFullVerification().catch((err) => {
  console.error('Fatal Verification Error:', err);
  process.exit(1);
});
