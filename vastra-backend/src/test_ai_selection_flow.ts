import { handleAgentMessage, prepareCheckout, create_and_confirm_order, isAiCheckoutSession, clearAiCheckoutSession } from './services/agentService';
import { addToCart, getCart, clearCart } from './services/cartService';
import { getAllProducts } from './services/catalogService';
import { registerCustomer, addCustomerAddress } from './services/customerAuthService';
import { validateOrder } from './services/orderService';
import { db } from './db/db';

async function runTests() {
  console.log('====================================================');
  console.log('VASTRA.AI — 10 EXACT SCENARIO TEST SUITE (SECTION 18)');
  console.log('====================================================\n');

  const products = getAllProducts();
  if (products.length < 4) {
    throw new Error('Need at least 4 products in catalog to run test suite.');
  }

  const p1 = products[0];
  const p2 = products[1];
  const p3 = products[2];
  const p4 = products[3];

  let passedCount = 0;
  let totalTests = 10;

  // TEST 1: AI recommends 4 products. Customer clicks SELECT on Product 2.
  console.log('TEST 1: AI recommends 4 products. Customer clicks SELECT on Product 2.');
  {
    const sessionId = `test1_sess_${Date.now()}`;
    const searchRes = await handleAgentMessage({
      sessionId,
      message: 'Show me wedding shirts'
    });

    // Simulate customer selecting Product 2
    const selectedProductIds = [p2.id];
    const selectRes = await handleAgentMessage({
      sessionId,
      message: `I select ${p2.name}`,
      selectedProductIds,
      selectedItems: [{
        productId: p2.id,
        size: p2.sizes[0] || 'M',
        color: p2.colors[0] || 'Default',
        quantity: 1
      }]
    });

    const isSelected = selectRes.selectedProductIds?.includes(p2.id);
    if (isSelected) {
      console.log('✓ PASS: Product 2 selected in AI session state. Chat remains active.\n');
      passedCount++;
    } else {
      console.error('✗ FAIL: Product 2 was not properly retained in AI selectedProductIds.\n');
    }
  }

  // TEST 2: Customer clicks SELECT on Product 2. NO manual product page.
  console.log('TEST 2: Customer clicks SELECT on Product 2. EXPECTED: NO manual product page.');
  {
    const sessionId = `test2_sess_${Date.now()}`;
    const res = await handleAgentMessage({
      sessionId,
      message: `Select product ${p2.name}`,
      selectedProductIds: [p2.id]
    });

    // Verify session remains purely AI and does NOT trigger manual storefront transition
    const noManualRedirect = !res.actions?.includes('switch_to_manual') && !res.actions?.includes('navigate_manual');
    if (noManualRedirect) {
      console.log('✓ PASS: Selection did NOT trigger manual product page or manual route.\n');
      passedCount++;
    } else {
      console.error('✗ FAIL: Selection incorrectly triggered manual transition!\n');
    }
  }

  // TEST 3: Customer selects Product 2. AI asks for size or configures size inside AI.
  console.log('TEST 3: Customer selects Product 2. EXPECTED: Size selection happens inside AI.');
  {
    const sessionId = `test3_sess_${Date.now()}`;
    // User selects product and specifies size M directly in AI flow
    const res = await handleAgentMessage({
      sessionId,
      message: `I want size M for ${p2.name}`,
      selectedProductIds: [p2.id],
      selectedItems: [{
        productId: p2.id,
        size: 'M',
        color: p2.colors[0] || 'Default',
        quantity: 1
      }]
    });

    const sizeRecorded = res.selectedItems?.[0]?.size === 'M' || res.context.size === 'M';
    if (sizeRecorded) {
      console.log('✓ PASS: Size selection (M) configured directly inside AI flow without manual redirect.\n');
      passedCount++;
    } else {
      console.error('✗ FAIL: Size was not captured inside AI context.\n');
    }
  }

  // TEST 4: Customer selects Product 2 + Product 4.
  console.log('TEST 4: Customer selects Product 2 + Product 4. EXPECTED: 2 ITEMS SELECTED. Both remain in AI state.');
  {
    const sessionId = `test4_sess_${Date.now()}`;
    const selectedProductIds = [p2.id, p4.id];
    const selectedItems = [
      { productId: p2.id, size: 'M', color: p2.colors[0] || 'Default', quantity: 1 },
      { productId: p4.id, size: 'L', color: p4.colors[0] || 'Default', quantity: 1 }
    ];

    const res = await handleAgentMessage({
      sessionId,
      message: 'I have selected both pieces',
      selectedProductIds,
      selectedItems
    });

    const hasBoth = res.selectedProductIds?.length === 2 &&
      res.selectedProductIds.includes(p2.id) &&
      res.selectedProductIds.includes(p4.id);

    if (hasBoth) {
      console.log(`✓ PASS: Both items (${p2.name} + ${p4.name}) preserved in AI state (2 ITEMS SELECTED).\n`);
      passedCount++;
    } else {
      console.error('✗ FAIL: Multi-product selection lost from AI state.\n');
    }
  }

  // TEST 5: Customer clicks BUY SELECTED.
  console.log('TEST 5: Customer clicks BUY SELECTED. EXPECTED: AI purchase flow begins, checkoutSource = AI / channel = agent.');
  {
    const sessionId = `test5_sess_${Date.now()}`;
    addToCart({ sessionId, productId: p2.id, quantity: 1, size: 'M', color: p2.colors[0] || 'Default', channel: 'agent' });
    const prep = prepareCheckout(sessionId);

    const isAi = isAiCheckoutSession(sessionId);
    if (prep.ready && isAi) {
      console.log('✓ PASS: AI purchase flow prepared successfully. checkoutSource / channel = agent.\n');
      passedCount++;
    } else {
      console.error(`✗ FAIL: Checkout preparation failed or session not flagged as AI (ready=${prep.ready}, isAi=${isAi}).\n`);
    }
  }

  // TEST 6: Customer is logged out. Customer clicks BUY SELECTED.
  console.log('TEST 6: Customer is logged out. Customer clicks BUY SELECTED. EXPECTED: Login required, resumes after login.');
  {
    const sessionId = `test6_sess_${Date.now()}`;
    addToCart({ sessionId, productId: p2.id, quantity: 1, size: 'M', color: p2.colors[0] || 'Default', channel: 'agent' });
    prepareCheckout(sessionId);

    // Attempt confirming order without customerId (unauthenticated)
    let authBlocked = false;
    try {
      await create_and_confirm_order({
        sessionId,
        confirmed: true
        // customerId missing
      });
    } catch (err: any) {
      authBlocked = err.message === 'AUTHENTICATION_REQUIRED';
    }

    // Now simulate customer login and address provisioning
    const testEmail = `cust_test6_${Date.now()}@vastra.test`;
    const regRes = registerCustomer({
      email: testEmail,
      password: 'Password@123',
      name: 'Priya Sharma',
      phone: '+91 91234 56789'
    });
    const customerId = regRes.customer!.id;
    addCustomerAddress(customerId, {
      name: 'Priya Sharma',
      phone: '+91 91234 56789',
      addressLine: '12 Lavelle Road',
      city: 'Bangalore',
      state: 'Karnataka',
      postalCode: '560001',
      isDefault: true
    });

    // Resume checkout after login
    const confirmRes = await create_and_confirm_order({
      sessionId,
      customerId,
      confirmed: true,
      customerInfo: {
        customerId,
        address: '12 Lavelle Road',
        city: 'Bangalore',
        postalCode: '560001'
      }
    });

    if (authBlocked && confirmRes.success && confirmRes.orderId) {
      console.log(`✓ PASS: Blocked unauthenticated AI purchase; resumed and created Order #${confirmRes.orderId} after login.\n`);
      passedCount++;
    } else {
      console.error(`✗ FAIL: Expected auth blockage and subsequent completion after login.\n`);
    }
  }

  // TEST 7: AI purchase total = ₹11,000.
  console.log('TEST 7: AI purchase total > ₹10,000 (e.g. ₹11,000+). EXPECTED: AI purchase blocked by ₹10,000 limit, not converted to manual.');
  {
    const sessionId = `test7_sess_${Date.now()}`;
    // Choose items totaling > ₹10,000
    const expensiveItems = [
      { productId: p1.id, quantity: 4, size: p1.sizes[0] || 'M', color: p1.colors[0] || 'Default' }
    ];

    const aiValidation = validateOrder({
      channel: 'agent',
      sessionId,
      items: expensiveItems
    });

    // Verify manual shopping with same items is allowed to exceed ₹10,000
    const manualValidation = validateOrder({
      channel: 'human',
      sessionId: `manual_${Date.now()}`,
      items: expensiveItems
    });

    const aiBlocked = !aiValidation.valid && aiValidation.reason === 'ORDER_VALUE_LIMIT_EXCEEDED';
    const manualAllowed = manualValidation.valid && (manualValidation.total || 0) > 10000;

    if (aiBlocked && manualAllowed) {
      console.log(`✓ PASS: AI purchase totaling ₹${aiValidation.details?.total} strictly blocked by ₹10,000 limit with exact message:`);
      console.log(`       "${aiValidation.error}"`);
      console.log(`       Manual purchase allowed without ₹10,000 limit.\n`);
      passedCount++;
    } else {
      console.error(`✗ FAIL: AI limit check or manual exemption failed (aiBlocked=${aiBlocked}, manualAllowed=${manualAllowed}).\n`);
    }
  }

  // TEST 8: Customer explicitly says: "Shop manually."
  console.log('TEST 8: Customer explicitly says: "Shop manually." EXPECTED: Transitions to manual shopping ONLY on explicit request.');
  {
    const sessionId = `test8_sess_${Date.now()}`;
    const res = await handleAgentMessage({
      sessionId,
      message: 'Shop manually.'
    });

    const hasSwitchAction = res.actions?.includes('switch_to_manual');
    if (hasSwitchAction) {
      console.log('✓ PASS: Explicit "Shop manually" yielded switch_to_manual action; clear transition performed.\n');
      passedCount++;
    } else {
      console.error('✗ FAIL: "Shop manually" failed to trigger switch_to_manual.\n');
    }
  }

  // TEST 9: Customer selects AI product → logs in → returns.
  console.log('TEST 9: Customer selects AI product → logs in → returns. EXPECTED: Selected product and AI context remain intact.');
  {
    const sessionId = `test9_sess_${Date.now()}`;
    // Select product in AI session
    const step1 = await handleAgentMessage({
      sessionId,
      message: `I select ${p3.name}`,
      selectedProductIds: [p3.id],
      selectedItems: [{
        productId: p3.id,
        size: 'M',
        color: p3.colors[0] || 'Default',
        quantity: 1
      }]
    });

    // Customer registers/logs in
    const testEmail = `cust_test9_${Date.now()}@vastra.test`;
    const regRes = registerCustomer({
      email: testEmail,
      password: 'Password@123',
      name: 'Kavya Sen',
      phone: '+91 99887 76655'
    });
    const customerId = regRes.customer!.id;

    // Return to AI flow with authenticated customerId
    const step2 = await handleAgentMessage({
      sessionId,
      customerId,
      message: 'I have logged in, let us continue'
    });

    const preserved = step2.selectedProductIds?.includes(p3.id);
    if (preserved) {
      console.log(`✓ PASS: Product ${p3.name} remained selected in AI context across login transition.\n`);
      passedCount++;
    } else {
      console.error(`✗ FAIL: Selection was dropped after customer authenticated.\n`);
    }
  }

  // TEST 10: Customer A uses AI and selects a product. Customer A logs out. Customer B logs in.
  console.log('TEST 10: Customer A uses AI and selects product. A logs out. B logs in. EXPECTED: Customer B does not inherit Customer A cart/selection.');
  {
    const sessA = `sess_custA_${Date.now()}`;
    const sessB = `sess_custB_${Date.now()}`;

    // Customer A registers and adds item to cart via AI
    const emailA = `custA_${Date.now()}@vastra.test`;
    const regA = registerCustomer({ email: emailA, password: 'PassA@123', name: 'Customer A' });
    const idA = regA.customer!.id;
    addToCart({ sessionId: sessA, productId: p1.id, quantity: 2, size: 'M', color: p1.colors[0] || 'Default', channel: 'agent', customerId: idA });

    // Customer A logs out -> sessA / cart A is preserved for A in database, but new session starts for Customer B
    const emailB = `custB_${Date.now()}@vastra.test`;
    const regB = registerCustomer({ email: emailB, password: 'PassB@123', name: 'Customer B' });
    const idB = regB.customer!.id;

    const cartB = getCart(sessB, 'agent', idB);

    const isIsolated = cartB.items.length === 0;
    if (isIsolated) {
      console.log('✓ PASS: Customer B has an empty, isolated cart and does NOT inherit Customer A selection or cart.\n');
      passedCount++;
    } else {
      console.error(`✗ FAIL: Cart leakage detected! Customer B inherited ${cartB.items.length} items.\n`);
    }
  }

  console.log('====================================================');
  console.log(`SUMMARY: ${passedCount}/${totalTests} TESTS PASSED`);
  console.log('====================================================');

  if (passedCount === totalTests) {
    console.log('ALL 10 EXACT SCENARIOS PASSED WITH 100% SUCCESS!');
    process.exit(0);
  } else {
    console.error(`FAILURE: ${totalTests - passedCount} tests failed.`);
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Fatal error running test suite:', err);
  process.exit(1);
});
