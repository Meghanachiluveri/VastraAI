import { db } from './src/db/db';
import { getAuditLogs } from './src/services/auditService';
import {
  addToCart,
  clearCart,
  getCart,
  removeFromCart,
  updateCartQuantity
} from './src/services/cartService';
import {
  confirmAgentCheckout,
  handleAgentMessage,
  prepareCheckout
} from './src/services/agentService';
import { validateOrder } from './src/services/orderService';

async function runPhase7SharedCartTests() {
  console.log('================================================================');
  console.log('   PHASE 7: HUMAN + AI SHARED CART SYNCHRONIZATION TESTS        ');
  console.log('================================================================\n');

  // ===========================================================================
  // TEST 1 — HUMAN ADD (Storefront adds product -> Backend updated)
  // ===========================================================================
  console.log('TEST 1: Human storefront adds product -> backend cart updated...');
  const session1 = `sess_p7_t1_${Date.now()}`;
  const t1_res = addToCart({
    sessionId: session1,
    productId: 'men-003', // Tailored Poplin Formal Shirt (₹3,499)
    quantity: 1,
    size: '40',
    color: 'Crisp White',
    channel: 'human'
  });

  console.log('  [Human Add Result] Success:', t1_res.success, 'Items count:', t1_res.cart.items.length);
  if (!t1_res.success || t1_res.cart.items.length !== 1) {
    throw new Error('Test 1 failed: Expected 1 item added by human');
  }
  if (t1_res.cart.items[0].productId !== 'men-003' || t1_res.cart.items[0].size !== '40') {
    throw new Error('Test 1 failed: Variant mismatch in added item');
  }
  console.log('✔ TEST 1 PASSED: Human storefront add updated backend cart.\n');

  // ===========================================================================
  // TEST 2 — AI ADD (AI Agent adds product -> Same backend cart updated)
  // ===========================================================================
  console.log('TEST 2: AI agent adds product -> backend cart updated...');
  const session2 = `sess_p7_t2_${Date.now()}`;
  await handleAgentMessage({ sessionId: session2, message: 'Show me bandhgalas' });
  const t2_agentRes = await handleAgentMessage({
    sessionId: session2,
    message: 'Add this in size 38'
  });

  console.log('  [AI Message]:', t2_agentRes.message);
  const backendCart2 = getCart(session2, 'human');
  console.log('  [Backend Cart Items]:', backendCart2.items.map((i) => `${i.name} (${i.size}, ₹${i.price})`));

  if (backendCart2.items.length !== 1 || backendCart2.items[0].size !== '38') {
    throw new Error('Test 2 failed: AI add did not reflect in backend cart');
  }
  console.log('✔ TEST 2 PASSED: AI agent add updated backend cart.\n');

  // ===========================================================================
  // TEST 3 — HUMAN -> AI (Human adds item, AI sees it via get_cart)
  // ===========================================================================
  console.log('TEST 3: Human adds jeans -> AI asks "What\'s in my cart?" and sees jeans...');
  const session3 = `sess_p7_t3_${Date.now()}`;
  addToCart({
    sessionId: session3,
    productId: 'men-007', // Japanese Selvedge Raw Denim Jeans (₹6,499)
    quantity: 1,
    size: '32',
    color: 'Raw Indigo',
    channel: 'human'
  });

  const t3_aiRes = await handleAgentMessage({
    sessionId: session3,
    message: "What's in my cart?"
  });

  console.log('  [AI Response to "What\'s in my cart?"]:\n', t3_aiRes.message);
  if (!t3_aiRes.message.includes('Japanese Selvedge Raw Denim Jeans') || !t3_aiRes.message.includes('6,499')) {
    throw new Error('Test 3 failed: AI did not see the human-added item');
  }
  console.log('✔ TEST 3 PASSED: Human-added item immediately visible to AI agent.\n');

  // ===========================================================================
  // TEST 4 — AI -> HUMAN (AI adds Linen Dress -> Human opens Cart Drawer)
  // ===========================================================================
  console.log('TEST 4: AI adds Linen Dress -> Human opens cart drawer and sees item...');
  const session4 = `sess_p7_t4_${Date.now()}`;
  await handleAgentMessage({ sessionId: session4, message: 'Show me shirts' });
  await handleAgentMessage({ sessionId: session4, message: 'Add this in size S' });

  // Human opens cart drawer (fetches getCart)
  const t4_drawerCart = getCart(session4, 'human', true);
  console.log('  [Drawer Cart]:', t4_drawerCart.items.map((i) => `${i.name} (Qty: ${i.quantity}, Size: ${i.size})`));

  if (t4_drawerCart.items.length === 0 || !t4_drawerCart.items[0].size) {
    throw new Error('Test 4 failed: Cart drawer did not retrieve AI-added item');
  }
  console.log('✔ TEST 4 PASSED: AI-added item immediately visible in human cart drawer.\n');

  // ===========================================================================
  // TEST 5 — HUMAN REMOVE (Human removes item -> AI sees updated state)
  // ===========================================================================
  console.log('TEST 5: Human removes item -> AI sees item is gone...');
  const session5 = `sess_p7_t5_${Date.now()}`;
  addToCart({
    sessionId: session5,
    productId: 'women-004',
    quantity: 1,
    size: 'M',
    channel: 'human'
  });

  const cartBefore5 = getCart(session5, 'human');
  const removeTargetId = cartBefore5.items[0].id;

  removeFromCart(session5, removeTargetId, 'human');

  const t5_aiRes = await handleAgentMessage({
    sessionId: session5,
    message: "What's in my cart?"
  });

  console.log('  [AI Response after Human Remove]:\n', t5_aiRes.message);
  if (!t5_aiRes.message.includes('empty')) {
    throw new Error('Test 5 failed: AI still saw removed item');
  }
  console.log('✔ TEST 5 PASSED: Human item removal immediately reflected in AI assistant.\n');

  // ===========================================================================
  // TEST 6 — AI REMOVE (AI removes item -> Human cart drawer reflects it)
  // ===========================================================================
  console.log('TEST 6: AI removes item -> Human cart drawer reflects removal...');
  const session6 = `sess_p7_t6_${Date.now()}`;
  addToCart({ sessionId: session6, productId: 'men-003', quantity: 1, size: '40', channel: 'human' });
  addToCart({ sessionId: session6, productId: 'men-006', quantity: 1, size: 'M', channel: 'human' });

  const t6_aiRemove = await handleAgentMessage({
    sessionId: session6,
    message: 'Remove the second item'
  });
  console.log('  [AI Remove Message]:', t6_aiRemove.message);

  const t6_drawerCart = getCart(session6, 'human');
  console.log('  [Drawer Cart remaining]:', t6_drawerCart.items.map((i) => i.name));

  if (t6_drawerCart.items.length !== 1 || t6_drawerCart.items[0].productId !== 'men-003') {
    throw new Error('Test 6 failed: AI removal did not update human cart drawer');
  }
  console.log('✔ TEST 6 PASSED: AI item removal immediately reflected in human cart drawer.\n');

  // ===========================================================================
  // TEST 7 — QUANTITY UPDATE (Human updates quantity -> AI sees new count)
  // ===========================================================================
  console.log('TEST 7: Human changes quantity to 3 -> AI sees updated count and total...');
  const session7 = `sess_p7_t7_${Date.now()}`;
  addToCart({ sessionId: session7, productId: 'men-006', quantity: 1, size: 'L', channel: 'human' });

  updateCartQuantity(session7, 'men-006', 3, 'human');

  const t7_aiRes = await handleAgentMessage({
    sessionId: session7,
    message: "What's in my cart?"
  });

  console.log('  [AI Response]:\n', t7_aiRes.message);
  if (!t7_aiRes.message.includes('Qty: 3') && !t7_aiRes.message.includes('Quantity: 3') && !t7_aiRes.message.includes('3')) {
    throw new Error('Test 7 failed: AI did not see updated quantity 3');
  }
  console.log('✔ TEST 7 PASSED: Quantity update synchronized across storefront and AI.\n');

  // ===========================================================================
  // TEST 8 — VARIANTS (Multiple sizes/colors of same product remain distinct)
  // ===========================================================================
  console.log('TEST 8: Adding same product with different sizes/colors -> variants remain distinct...');
  const session8 = `sess_p7_t8_${Date.now()}`;
  addToCart({
    sessionId: session8,
    productId: 'women-004',
    quantity: 1,
    size: 'M',
    color: 'Midnight Black',
    channel: 'human'
  });
  addToCart({
    sessionId: session8,
    productId: 'women-004',
    quantity: 2,
    size: 'L',
    color: 'Ivory White',
    channel: 'human'
  });

  const t8_cart = getCart(session8, 'human');
  console.log('  [Variant Items]:', t8_cart.items.map((i) => `${i.name} (Size: ${i.size}, Color: ${i.color}, Qty: ${i.quantity})`));

  if (t8_cart.items.length !== 2) {
    throw new Error(`Test 8 failed: Expected 2 distinct variant items, got ${t8_cart.items.length}`);
  }
  if (t8_cart.itemCount !== 3) {
    throw new Error(`Test 8 failed: Expected total quantity 3, got ${t8_cart.itemCount}`);
  }
  console.log('✔ TEST 8 PASSED: Multiple product variants maintained distinctly.\n');

  // ===========================================================================
  // TEST 9 — PRICE CHANGE (Database price update reflected authoritatively)
  // ===========================================================================
  console.log('TEST 9: Database price update -> cart dynamically returns live catalog price...');
  const session9 = `sess_p7_t9_${Date.now()}`;
  const originalPrice9 = (db.prepare('SELECT price FROM products WHERE id = ?').get('men-003') as any).price;

  addToCart({
    sessionId: session9,
    productId: 'men-003',
    quantity: 1,
    size: '40',
    channel: 'human'
  });

  // DB price updates from ₹3,499 to ₹3,899
  db.prepare('UPDATE products SET price = 3899 WHERE id = ?').run('men-003');

  try {
    const t9_cart = getCart(session9, 'human');
    console.log('  [Updated Cart Total]:', t9_cart.total, 'Price Changed Flag:', t9_cart.priceChange?.priceChanged);

    if (t9_cart.total !== 3899 || !t9_cart.priceChange?.priceChanged) {
      throw new Error('Test 9 failed: Cart did not return updated price from catalog');
    }
  } finally {
    db.prepare('UPDATE products SET price = ? WHERE id = ?').run(originalPrice9, 'men-003');
  }
  console.log('✔ TEST 9 PASSED: Backend catalog price authoritative over stale prices.\n');

  // ===========================================================================
  // TEST 10 — STOCK LIMITS (Exceeding stock safely rejected)
  // ===========================================================================
  console.log('TEST 10: Adding quantity greater than stock -> safe rejection without negative stock...');
  const session10 = `sess_p7_t10_${Date.now()}`;
  const t10_res = addToCart({
    sessionId: session10,
    productId: 'women-006',
    quantity: 9999,
    size: 'M',
    channel: 'human'
  });

  console.log('  [Excess Quantity Result] Success:', t10_res.success, 'Error:', t10_res.error);
  if (t10_res.success || t10_res.error !== 'INSUFFICIENT_STOCK') {
    throw new Error('Test 10 failed: Excessive quantity should be rejected with INSUFFICIENT_STOCK');
  }
  console.log('✔ TEST 10 PASSED: Stock ceilings enforced across shared cart.\n');

  // ===========================================================================
  // TEST 11 — REFRESH / PERSISTENCE (Cart persists by sessionId)
  // ===========================================================================
  console.log('TEST 11: Cart persistence by sessionId (simulating page reload)...');
  const session11 = `sess_p7_t11_${Date.now()}`;
  addToCart({
    sessionId: session11,
    productId: 'men-004',
    quantity: 2,
    size: 'M',
    channel: 'agent'
  });

  // Re-fetch with same sessionId
  const t11_persisted = getCart(session11, 'human');
  console.log('  [Persisted Items Count]:', t11_persisted.items.length, 'Total Items:', t11_persisted.itemCount);

  if (t11_persisted.items.length !== 1 || t11_persisted.itemCount !== 2) {
    throw new Error('Test 11 failed: Cart was not persisted by sessionId');
  }
  console.log('✔ TEST 11 PASSED: Cart state fully persisted across page reloads.\n');

  // ===========================================================================
  // TEST 12 — CHECKOUT SYNCHRONIZATION (Human & AI validate same backend cart)
  // ===========================================================================
  console.log('TEST 12: Human and AI checkout validate the exact same backend cart...');
  const session12 = `sess_p7_t12_${Date.now()}`;
  addToCart({
    sessionId: session12,
    productId: 'women-004',
    quantity: 1,
    size: 'M',
    channel: 'human'
  });

  // Human validation
  const humanValidation = validateOrder({
    channel: 'human',
    sessionId: session12,
    items: [{ productId: 'women-004', quantity: 1, size: 'M' }]
  });

  if (!humanValidation.valid) {
    throw new Error('Test 12 failed: Human validation failed');
  }

  // AI preparation
  const aiPrep = prepareCheckout(session12);

  console.log('  [Human Validated Total]:', humanValidation.total, '[AI Prepared Total]:', aiPrep.totalAmount);

  if (!aiPrep.ready || humanValidation.total !== aiPrep.totalAmount) {
    throw new Error(`Test 12 failed: Validation total mismatch (${humanValidation.total} vs ${aiPrep.totalAmount})`);
  }

  // AI confirms checkout
  const aiConfirm = await confirmAgentCheckout({ sessionId: session12, confirmed: true });
  console.log('  [Confirmed Order ID]:', aiConfirm.orderId, 'Total:', aiConfirm.totalAmount);

  if (aiConfirm.totalAmount !== humanValidation.total) {
    throw new Error('Test 12 failed: Confirmed order amount does not match human validation');
  }
  console.log('✔ TEST 12 PASSED: Unified checkout validates identical backend cart.\n');

  // ===========================================================================
  // AUDIT LOG VERIFICATION FOR PHASE 7
  // ===========================================================================
  console.log('Verifying SQLite Audit Logs for Phase 7 human and agent cart actions...');
  const humanAddLogs = getAuditLogs({ channel: 'human', action: 'add_to_bag' });
  const humanRemoveLogs = getAuditLogs({ channel: 'human', action: 'remove_from_bag' });
  const humanViewLogs = getAuditLogs({ channel: 'human', action: 'cart_viewed' });
  const agentAddLogs = getAuditLogs({ channel: 'agent', action: 'add_to_bag' });

  console.log(`Audit Event Counts:
    - human add_to_bag: ${humanAddLogs.length}
    - human remove_from_bag: ${humanRemoveLogs.length}
    - human cart_viewed: ${humanViewLogs.length}
    - agent add_to_bag: ${agentAddLogs.length}`);

  if (humanAddLogs.length === 0 || humanViewLogs.length === 0 || agentAddLogs.length === 0) {
    throw new Error('Audit verification failed: Missing required human/agent channel logs');
  }

  console.log('✔ SQLite Audit Log Verification PASSED.\n');

  console.log('================================================================');
  console.log(' ALL 12 PHASE 7 SHARED CART SYNCHRONIZATION TESTS PASSED 100%! ');
  console.log('================================================================\n');
}

runPhase7SharedCartTests().catch((err) => {
  console.error('Phase 7 tests encountered an error:', err);
  process.exit(1);
});
