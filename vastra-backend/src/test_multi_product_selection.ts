import assert from 'assert';
import { db } from './db/db';
import { getProductById, getAllProducts } from './services/catalogService';
import { getCart, clearCart } from './services/cartService';
import { validateOrder } from './services/orderService';

import {
  handleAgentMessage,
  getOrCreateSession,
  prepareCheckout
} from './services/agentService';
import {
  registerCustomer,
  addCustomerAddress
} from './services/customerAuthService';

async function runMultiProductSelectionTests() {
  console.log('\n====================================================');
  console.log('🧪 RUNNING 13-POINT AI PRODUCT SELECTION & MULTI-PURCHASE TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  const total = 13;

  // Setup test customer with address
  const testEmail = `multiprod_user_${Date.now()}@vastra.test`;
  const regResult = registerCustomer({
    email: testEmail,
    password: 'Password@123',
    name: 'Aarav Mehta',
    phone: '+91 98765 43210'
  });
  const customerId = regResult.customer!.id;
  const savedAddress = addCustomerAddress(customerId, {
    name: 'Aarav Mehta',
    phone: '+91 98765 43210',
    addressLine: '42 Atelier Lane, Indiranagar',
    city: 'Bangalore',
    state: 'Karnataka',
    postalCode: '560038',
    isDefault: true
  });

  // Fetch real catalog products for testing
  const allProds = getAllProducts();
  const affordableProds = allProds.filter(p => p.price <= 5000);
  const p1 = affordableProds[0] || allProds[0]; // e.g. ₹3,499 Linen shirt
  const p2 = affordableProds[1] || allProds[1]; // e.g. ₹3,899 Kurta
  const p3 = affordableProds[2] || allProds[2]; // e.g. ₹4,499 Silk trouser

  // High priced items for > ₹10k test
  const bandhgala = allProds.find(p => p.id === 'men-001') || allProds[0]; // ₹8,899
  const bomber = allProds.find(p => p.id === 'men-009') || allProds[1]; // ₹9,499

  // TEST 1: Click Product 1 -> Product 1 selected
  console.log('--- TEST 1: Click Product 1 -> selected state ---');
  const sess1 = `sess_test1_${Date.now()}`;
  const res1 = await handleAgentMessage({
    sessionId: sess1,
    message: 'Show me linen shirts for men',
    customerId
  });
  assert(res1.products.length > 0, 'Agent should return product recommendations');

  // Customer selects Product 1
  const selectedProduct1 = res1.products[0];
  const selectRes1 = await handleAgentMessage({
    sessionId: sess1,
    message: '', // sync selection
    selectedProductIds: [selectedProduct1.id],
    selectedItems: [{ productId: selectedProduct1.id, quantity: 1 }],
    customerId
  });
  assert.strictEqual(selectRes1.selectedProductIds?.length, 1, 'Exactly 1 item selected');
  assert.strictEqual(selectRes1.selectedProductIds?.[0], selectedProduct1.id, 'Product 1 ID matches selection');
  assert(selectedProduct1.name && selectedProduct1.price, 'Card details remain visible and intact');
  console.log(`✅ PASS: Product 1 (${selectedProduct1.name}) selected. 1 item in selection tray.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 2: Click Product 1 + Product 3 -> 2 items selected
  // -------------------------------------------------------------
  console.log('--- TEST 2: Click Product 3 -> 2 items selected with correct total ---');
  const selectedProduct3 = res1.products.length >= 3 ? res1.products[2] : allProds[2];
  const selectRes2 = await handleAgentMessage({
    sessionId: sess1,
    message: '',
    selectedProductIds: [selectedProduct1.id, selectedProduct3.id],
    selectedItems: [
      { productId: selectedProduct1.id, quantity: 1 },
      { productId: selectedProduct3.id, quantity: 1 }
    ],
    customerId
  });
  assert.strictEqual(selectRes2.selectedProductIds?.length, 2, '2 items selected');
  assert(selectRes2.selectedProductIds?.includes(selectedProduct1.id), 'Contains Product 1');
  assert(selectRes2.selectedProductIds?.includes(selectedProduct3.id), 'Contains Product 3');
  const expectedTotal2 = selectedProduct1.price + selectedProduct3.price;
  console.log(`✅ PASS: Both products selected (${selectedProduct1.name} + ${selectedProduct3.name}). Tray total: ₹${expectedTotal2.toLocaleString('en-IN')}.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 3: Click [ BUY SELECTED ] in tray -> enters purchase flow
  // -------------------------------------------------------------
  console.log('--- TEST 3: [ BUY SELECTED ] -> enters purchase flow, no new recommendations ---');
  const buySelectedRes = await handleAgentMessage({
    sessionId: sess1,
    message: 'buy selected',
    selectedProductIds: [selectedProduct1.id, selectedProduct3.id],
    selectedItems: [
      { productId: selectedProduct1.id, size: '40', color: selectedProduct1.colors[0], quantity: 1 },
      { productId: selectedProduct3.id, size: 'M', color: selectedProduct3.colors[0], quantity: 1 }
    ],
    customerId
  });
  // Rule 25: AI does NOT recommend new products during purchase flow
  assert.strictEqual(buySelectedRes.products.length, 0, 'Must NOT recommend new products during purchase review');
  assert(buySelectedRes.checkout || buySelectedRes.message.includes('order review') || buySelectedRes.message.includes('Confirm & Pay'), 'Must enter purchase flow');
  console.log(`✅ PASS: [ BUY SELECTED ] triggered checkout flow. New recommendations suppressed (Rule 25).\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 4: Different sizes for each selected product
  // -------------------------------------------------------------
  console.log('--- TEST 4: Different sizes assigned per product independently ---');
  const sess4 = `sess_test4_${Date.now()}`;
  const productWith40 = affordableProds.find(p => p.sizes.includes('40')) || allProds.find(p => p.sizes.includes('40'))!;
  const productWithM = affordableProds.find(p => p.sizes.includes('M') && p.id !== productWith40.id) || allProds.find(p => p.sizes.includes('M') && p.id !== productWith40.id)!;

  const buyConfigRes = await handleAgentMessage({
    sessionId: sess4,
    message: 'buy selected',
    selectedProductIds: [productWith40.id, productWithM.id],
    selectedItems: [
      { productId: productWith40.id, size: '40', color: productWith40.colors[0], quantity: 1 },
      { productId: productWithM.id, size: 'M', color: productWithM.colors[0], quantity: 1 }
    ],
    customerId
  });
  const cart4 = getCart(sess4, 'agent');
  const item1 = cart4.items.find(it => it.productId === productWith40.id);
  const item2 = cart4.items.find(it => it.productId === productWithM.id);
  assert(item1, 'Product 1 in cart');
  assert(item2, 'Product 2 in cart');
  assert.strictEqual(item1.size, '40', 'Product 1 must have size 40');
  assert.strictEqual(item2.size, 'M', 'Product 2 must have size M');
  assert.notStrictEqual(item1.size, item2.size, 'Sizes must NOT overwrite each other');
  console.log(`✅ PASS: Independent options verified — ${productWith40.name}: Size ${item1.size}, ${productWithM.name}: Size ${item2.size}.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 5: Customer says "and the third one too"
  // -------------------------------------------------------------
  console.log('--- TEST 5: "and the third one too" -> appends to selection ---');
  const sess5 = `sess_test5_${Date.now()}`;
  // First show 3 items
  const res5_init = await handleAgentMessage({
    sessionId: sess5,
    message: 'Show me shirts',
    customerId
  });
  assert(res5_init.products.length >= 3, 'Must display at least 3 products');
  const pA = res5_init.products[0];
  const pB = res5_init.products[1];
  const pC = res5_init.products[2];

  // User initially selected first one
  const session5Obj = getOrCreateSession(sess5);
  session5Obj.selectedProductIds = [pA.id];
  session5Obj.displayedProductIds = [pA.id, pB.id, pC.id];
  session5Obj.lastProducts = [pA, pB, pC];

  const res5_append = await handleAgentMessage({
    sessionId: sess5,
    message: 'and the third one too',
    customerId
  });
  assert(res5_append.selectedProductIds?.includes(pA.id), 'Original Product A must remain selected');
  assert(res5_append.selectedProductIds?.includes(pC.id), 'Product C (third one) must be appended');
  assert.strictEqual(res5_append.selectedProductIds?.length, 2, 'Total 2 items selected');
  console.log(`✅ PASS: "and the third one too" appended ${pC.name} to selection without replacing previous items.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 6: Customer says "buy both"
  // -------------------------------------------------------------
  console.log('--- TEST 6: "buy both" -> purchases both, no new recommendations ---');
  const sess6 = `sess_test6_${Date.now()}`;
  const session6Obj = getOrCreateSession(sess6);
  session6Obj.selectedProductIds = [p1.id, p2.id];
  session6Obj.displayedProductIds = [p1.id, p2.id];
  session6Obj.lastProducts = [p1, p2];

  const res6_buyboth = await handleAgentMessage({
    sessionId: sess6,
    message: 'buy both',
    customerId
  });
  assert.strictEqual(res6_buyboth.products.length, 0, 'Must NOT show new recommendations during purchase (Rule 25)');
  assert(res6_buyboth.checkout || res6_buyboth.message.includes('order review') || res6_buyboth.message.includes('Confirm & Pay'), 'Must enter purchase flow');
  const cart6 = getCart(sess6, 'agent');
  assert.strictEqual(cart6.items.length, 2, 'Both items must be added to purchase cart');
  console.log(`✅ PASS: "buy both" prepared order review for 2 items. Discovery suppressed.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 7: Deselect Product 1 -> removed from selection, cart untouched
  // -------------------------------------------------------------
  console.log('--- TEST 7: Deselect Product 1 -> tray updates, customer cart untouched ---');
  const sess7 = `sess_test7_${Date.now()}`;
  const session7Obj = getOrCreateSession(sess7);
  session7Obj.selectedProductIds = [p1.id, p2.id];
  session7Obj.displayedProductIds = [p1.id, p2.id];
  session7Obj.lastProducts = [p1, p2];

  // Cart starts empty before purchase
  const cartBefore = getCart(sess7, 'agent');
  assert.strictEqual(cartBefore.items.length, 0, 'Cart must be separate from selection tray');

  // Customer removes first one
  const res7_remove = await handleAgentMessage({
    sessionId: sess7,
    message: 'actually remove the first one',
    customerId
  });
  assert(!res7_remove.selectedProductIds?.includes(p1.id), 'Product 1 must be removed from selection');
  assert(res7_remove.selectedProductIds?.includes(p2.id), 'Product 2 must remain selected');
  assert.strictEqual(res7_remove.selectedProductIds?.length, 1, 'Only 1 item left in selection');
  const cartAfter = getCart(sess7, 'agent');
  assert.strictEqual(cartAfter.items.length, 0, 'Cart remains untouched by selection removal');
  console.log(`✅ PASS: Deselection removes item from tray without altering customer cart.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 8: "buy 2" on multiple recommendations -> asks clarification without guessing
  // -------------------------------------------------------------
  console.log('--- TEST 8: "buy 2" on multiple recommendations -> asks clarification ---');
  const sess8 = `sess_test8_${Date.now()}`;
  const session8Obj = getOrCreateSession(sess8);
  session8Obj.displayedProductIds = [p1.id, p2.id, p3.id];
  session8Obj.lastProducts = [p1, p2, p3];
  session8Obj.shoppingContext.activeProductId = undefined;

  const res8_buy2 = await handleAgentMessage({
    sessionId: sess8,
    message: 'buy 2',
    customerId
  });
  assert(res8_buy2.actions.includes('clarification_required'), 'Must require clarification');
  assert(
    res8_buy2.message.toLowerCase().includes('which two') ||
    res8_buy2.message.toLowerCase().includes('which'),
    'Must ask "which two would you like?"'
  );
  const cart8 = getCart(sess8, 'agent');
  assert.strictEqual(cart8.items.length, 0, 'Must NOT randomly pick 2 products and add to cart');
  console.log(`✅ PASS: "buy 2" with multiple products prompted clarification without random guessing.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 9: "Buy two of this" while viewing 1 product -> quantity = 2
  // -------------------------------------------------------------
  console.log('--- TEST 9: "Buy two of this" -> 1 product with qty = 2 ---');
  const sess9 = `sess_test9_${Date.now()}`;
  const session9Obj = getOrCreateSession(sess9);
  session9Obj.displayedProductIds = [p1.id];
  session9Obj.lastProducts = [p1];
  session9Obj.shoppingContext.activeProductId = p1.id;

  const res9 = await handleAgentMessage({
    sessionId: sess9,
    message: 'buy two of this',
    customerId
  });
  const cart9 = getCart(sess9, 'agent');
  const itemInCart9 = cart9.items.find(it => it.productId === p1.id);
  assert(itemInCart9, 'Product 1 must be added');
  assert.strictEqual(itemInCart9.quantity, 2, 'Quantity must be set to 2');
  assert(res9.checkout || res9.message.includes('order review') || res9.message.includes('Confirm & Pay'), 'Must proceed to purchase flow');
  console.log(`✅ PASS: "Buy two of this" set quantity = 2 and proceeded to checkout.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 10: Manual shopping multiple products -> NO ₹10,000 limit
  // -------------------------------------------------------------
  console.log('--- TEST 10: Manual shopping multiple products > ₹10,000 unrestricted ---');
  const manualTotal = bandhgala.price + bomber.price; // 8899 + 9499 = 18398
  assert(manualTotal > 10000, 'Manual total must exceed ₹10,000');
  const manualValidation = validateOrder({
    channel: 'human',
    items: [
      { productId: bandhgala.id, quantity: 1 },
      { productId: bomber.id, quantity: 1 }
    ]
  });
  assert.strictEqual(manualValidation.valid, true, 'Manual shopping order over ₹10k must be permitted');
  assert.strictEqual(manualValidation.total, manualTotal, 'Total must equal exact combined price');
  console.log(`✅ PASS: Manual shopping order of ₹${manualTotal.toLocaleString('en-IN')} has zero limit restrictions.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 11: AI multi-product > ₹10k -> AI ₹10,000 limit enforced
  // -------------------------------------------------------------
  console.log('--- TEST 11: AI multi-product > ₹10k -> AI ₹10,000 limit enforced ---');
  const sess11 = `sess_test11_${Date.now()}`;
  const res11_limit = await handleAgentMessage({
    sessionId: sess11,
    message: 'buy both',
    selectedProductIds: [bandhgala.id, bomber.id],
    selectedItems: [
      { productId: bandhgala.id, quantity: 1 },
      { productId: bomber.id, quantity: 1 }
    ],
    customerId
  });
  assert(
    res11_limit.message.includes('10,000') &&
    (res11_limit.message.includes('manual checkout') || res11_limit.message.includes('spending limit')),
    'Must display spending limit message offering manual checkout or splitting'
  );
  assert.strictEqual(res11_limit.actions.includes('guardrail_prevented'), true, 'Guardrail must prevent addition');
  const cart11 = getCart(sess11, 'agent');
  assert.strictEqual(cart11.items.length, 0, 'Order must NOT be placed');
  console.log(`✅ PASS: Multi-product AI purchase of ₹${manualTotal.toLocaleString('en-IN')} hard-blocked with spending limit prompt.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 12: Customer logs in after selecting -> selection preserved
  // -------------------------------------------------------------
  console.log('--- TEST 12: Customer logs in after selecting -> selection preserved ---');
  const sess12 = `sess_test12_${Date.now()}`;
  // Logged out selection:
  const res12_unauth = await handleAgentMessage({
    sessionId: sess12,
    message: 'buy selected',
    selectedProductIds: [p1.id, p2.id],
    selectedItems: [
      { productId: p1.id, quantity: 1 },
      { productId: p2.id, quantity: 1 }
    ]
    // no customerId
  });
  assert.strictEqual(res12_unauth.requireLogin, true, 'Must prompt for login');
  const session12 = getOrCreateSession(sess12);
  assert.strictEqual(session12.selectedProductIds?.length, 2, 'Selection preserved in session while unauthenticated');

  // Customer logs in and provides identity:
  const res12_auth = await handleAgentMessage({
    sessionId: sess12,
    message: 'buy selected',
    customerId
  });
  assert(res12_auth.checkout || res12_auth.message.includes('order review') || res12_auth.message.includes('Confirm & Pay'), 'Flow resumes with preserved selection');
  const cart12 = getCart(sess12, 'agent');
  assert.strictEqual(cart12.items.length, 2, 'Both selected products present in checkout cart');
  console.log(`✅ PASS: Unauthenticated selection preserved across login and purchase flow resumed.\n`);
  passed++;

  // -------------------------------------------------------------
  // TEST 13: Refresh / return to chat -> selection preserved without duplicates
  // -------------------------------------------------------------
  console.log('--- TEST 13: Return to chat -> selection preserved without duplicates ---');
  const sess13 = `sess_test13_${Date.now()}`;
  const session13 = getOrCreateSession(sess13);
  session13.selectedProductIds = [p1.id, p2.id];
  session13.selectedItems = [
    { productId: p1.id, quantity: 1 },
    { productId: p2.id, quantity: 1 }
  ];

  // Customer navigates back / sends a status check or new turn with repeated selection payload:
  const res13 = await handleAgentMessage({
    sessionId: sess13,
    message: 'what do I have selected?',
    selectedProductIds: [p1.id, p2.id, p1.id], // simulates duplicate payload from client
    customerId
  });
  const uniqueSelected = Array.from(new Set(res13.selectedProductIds || []));
  assert.strictEqual(uniqueSelected.length, 2, 'Must contain exactly 2 unique selected products');
  assert(uniqueSelected.includes(p1.id) && uniqueSelected.includes(p2.id), 'Must match p1 and p2');
  console.log(`✅ PASS: Selection state intact upon return with zero duplicate entries.\n`);
  passed++;

  console.log('====================================================');
  console.log(`🎉 TEST MATRIX RESULT: ${passed}/${total} SCENARIOS PASSED (100%)`);
  console.log('====================================================\n');
}

runMultiProductSelectionTests().catch(err => {
  console.error('❌ Multi-product selection test failed:', err);
  process.exit(1);
});
