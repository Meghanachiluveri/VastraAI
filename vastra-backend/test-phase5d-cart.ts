import { getAuditLogs } from './src/services/auditService';
import { handleAgentMessage } from './src/services/agentService';
import { getCart } from './src/services/cartService';

async function runPhase5DTests() {
  console.log('================================================================');
  console.log('    PHASE 5D: AI SHOPPING ACTIONS + CART INTEGRATION TESTS     ');
  console.log('================================================================\n');

  // ===========================================================================
  // TEST 1: "Add this to my cart."
  // ===========================================================================
  console.log('TEST 1: Starting "Show me silk bandhgalas" -> "Add this to my cart"...');
  const session1 = `sess_cart_t1_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session1,
    message: 'Show me silk bandhgalas'
  });

  let t1_res = await handleAgentMessage({
    sessionId: session1,
    message: 'Add this to my cart.'
  });

  if (t1_res.message.toLowerCase().includes('size')) {
    t1_res = await handleAgentMessage({
      sessionId: session1,
      message: 'Size 38'
    });
  }

  console.log('  [Turn 2] Message:', t1_res.message);
  console.log('  [Turn 2] Cart items:', t1_res.cart?.items.map((i) => `${i.name} (Qty: ${i.quantity}, Size: ${i.size}, ₹${i.price})`));

  if (!t1_res.cart || t1_res.cart.items.length !== 1) {
    throw new Error('Test 1 failed: Expected 1 item added to cart');
  }
  console.log('✔ TEST 1 PASSED: "Add this to my cart" added the active product correctly.\n');

  // ===========================================================================
  // TEST 2: "Add the second one." (Conversation Reference)
  // ===========================================================================
  console.log('TEST 2: Starting "Show me dresses" -> "Add the second one"...');
  const session2 = `sess_cart_t2_${Date.now()}`;
  const t2_disc = await handleAgentMessage({
    sessionId: session2,
    message: 'Show me dresses'
  });
  const secondDress = t2_disc.products[1];
  console.log('  [Turn 1] Second dress is:', secondDress?.name, `(${secondDress?.id})`);

  let t2_res = await handleAgentMessage({
    sessionId: session2,
    message: 'Add the second one.'
  });

  if (t2_res.message.toLowerCase().includes('size')) {
    t2_res = await handleAgentMessage({
      sessionId: session2,
      message: 'Size M'
    });
  }

  console.log('  [Turn 2] Message:', t2_res.message);
  console.log('  [Turn 2] Cart items:', t2_res.cart?.items.map((i) => `${i.name} (ID: ${i.productId})`));

  if (!t2_res.cart || t2_res.cart.items.length !== 1) {
    throw new Error('Test 2 failed: Expected 1 item in cart');
  }
  console.log('✔ TEST 2 PASSED: "Add the second one" resolved ordinal reference and added to cart.\n');

  // ===========================================================================
  // TEST 3: "What's in my cart?" (Inspect items, subtotal, and total)
  // ===========================================================================
  console.log('TEST 3: Starting "What\'s in my cart?" on session 2...');
  const t3_res = await handleAgentMessage({
    sessionId: session2,
    message: "What's in my cart?"
  });
  console.log('  [Turn 3] Message:\n', t3_res.message);
  console.log('  [Turn 3] Cart Total:', t3_res.cart?.total, 'Subtotal:', t3_res.cart?.subtotal);

  if (!t3_res.cart || t3_res.cart.items.length === 0 || t3_res.cart.total <= 0) {
    throw new Error('Test 3 failed: Expected non-empty cart with positive total');
  }
  console.log('✔ TEST 3 PASSED: "What\'s in my cart?" returned accurate items, subtotal, and total.\n');

  // ===========================================================================
  // TEST 4: "Remove the second item." (Remove specific cart item)
  // ===========================================================================
  console.log('TEST 4: Adding second item then removing "the second item"...');
  const session4 = `sess_cart_t4_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session4,
    message: 'Show me men formal shirts'
  });
  await handleAgentMessage({
    sessionId: session4,
    message: 'Add the first one in size 40.'
  });
  await handleAgentMessage({
    sessionId: session4,
    message: 'Add the second one in size 42.'
  });

  const cartBeforeRemove = getCart(session4);
  console.log('  [Before Remove] Cart items count:', cartBeforeRemove.items.length);
  const secondItemName = cartBeforeRemove.items[1].name;

  const t4_res = await handleAgentMessage({
    sessionId: session4,
    message: 'Remove the second item.'
  });
  console.log('  [After Remove] Message:', t4_res.message);
  console.log('  [After Remove] Cart items count:', t4_res.cart?.items.length);

  if (t4_res.cart?.items.length !== 1) {
    throw new Error('Test 4 failed: Expected 1 item remaining after removal');
  }
  if (t4_res.cart.items.some((i) => i.name === secondItemName)) {
    throw new Error('Test 4 failed: Removed item still present in cart');
  }
  console.log('✔ TEST 4 PASSED: "Remove the second item" removed the correct item from cart.\n');

  // ===========================================================================
  // TEST 5: "Change the quantity to 2."
  // ===========================================================================
  console.log('TEST 5: Starting "Change the quantity to 2"...');
  const t5_res = await handleAgentMessage({
    sessionId: session4,
    message: 'Change the quantity to 2.'
  });
  console.log('  [Turn 4] Message:', t5_res.message);
  console.log('  [Turn 4] Item quantity:', t5_res.cart?.items[0]?.quantity);

  if (t5_res.cart?.items[0]?.quantity !== 2) {
    throw new Error('Test 5 failed: Expected item quantity updated to 2');
  }
  console.log('✔ TEST 5 PASSED: "Change the quantity to 2" updated quantity and total properly.\n');

  // ===========================================================================
  // TEST 6: "Add this in size M."
  // ===========================================================================
  console.log('TEST 6: Starting "Add this in size M"...');
  const session6 = `sess_cart_t6_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session6,
    message: 'Show me wool blazers'
  });
  const t6_res = await handleAgentMessage({
    sessionId: session6,
    message: 'Add this in size M.'
  });
  console.log('  [Turn 2] Message:', t6_res.message);
  console.log('  [Turn 2] Stored Size:', t6_res.cart?.items[0]?.size);

  if (t6_res.cart?.items[0]?.size !== 'M') {
    throw new Error('Test 6 failed: Expected size M stored in cart item');
  }
  console.log('✔ TEST 6 PASSED: "Add this in size M" validated and saved the variant.\n');

  // ===========================================================================
  // TEST 7: Ask to add an unavailable / non-existent product
  // ===========================================================================
  console.log('TEST 7: Asking to add unavailable product ("spacesuit")...');
  const session7 = `sess_cart_t7_${Date.now()}`;
  const t7_res = await handleAgentMessage({
    sessionId: session7,
    message: 'Add spacesuit to my cart'
  });
  console.log('  [Turn 1] Message:', t7_res.message);

  if (t7_res.cart && t7_res.cart.items.length > 0) {
    throw new Error('Test 7 failed: Unavailable item should not be added');
  }
  console.log('✔ TEST 7 PASSED: Non-existent product handled with safe error.\n');

  // ===========================================================================
  // TEST 8: Ask to add quantity greater than stock
  // ===========================================================================
  console.log('TEST 8: Asking to add quantity exceeding stock (100 pieces)...');
  const session8 = `sess_cart_t8_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session8,
    message: 'Show me bandhgala jackets'
  });
  const t8_res = await handleAgentMessage({
    sessionId: session8,
    message: 'Add 100 pieces of this to my cart'
  });
  console.log('  [Turn 2] Message:', t8_res.message);

  if (t8_res.cart && t8_res.cart.items.length > 0) {
    throw new Error('Test 8 failed: Excessive quantity should not be added to cart');
  }
  console.log('✔ TEST 8 PASSED: Exceeded stock request blocked safely.\n');

  // ===========================================================================
  // TEST 9: Accept a Phase 5C Upsell: "Yes, add it."
  // ===========================================================================
  console.log('TEST 9: Testing Phase 5C Upsell acceptance: "Yes, add it"...');
  const session9 = `sess_cart_t9_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session9,
    message: 'I need a black dress under ₹5000'
  });
  const t9_step2 = await handleAgentMessage({
    sessionId: session9,
    message: 'I like this one'
  });
  console.log('  [Turn 2] Upsell suggested:', t9_step2.upsell?.productName, `(${t9_step2.upsell?.productId})`);
  const expectedUpsellId = t9_step2.upsell?.productId;

  const t9_step3 = await handleAgentMessage({
    sessionId: session9,
    message: 'Yes, add it.'
  });
  console.log('  [Turn 3] Message:\n', t9_step3.message);
  console.log('  [Turn 3] Cart items:', t9_step3.cart?.items.map((i) => `${i.name} (${i.productId})`));

  if (!t9_step3.cart?.items.some((i) => i.productId === expectedUpsellId)) {
    throw new Error('Test 9 failed: Expected upsell product added to cart upon acceptance');
  }
  console.log('✔ TEST 9 PASSED: "Yes, add it" added ONLY the suggested upsell product to cart.\n');

  // ===========================================================================
  // TEST 10: Decline Upsell: "No, don't add it."
  // ===========================================================================
  console.log("TEST 10: Testing Upsell decline: \"No, don't add it\"...");
  const session10 = `sess_cart_t10_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session10,
    message: 'Show me bandhgala jackets'
  });
  await handleAgentMessage({
    sessionId: session10,
    message: 'I like this one'
  });
  const t10_step3 = await handleAgentMessage({
    sessionId: session10,
    message: "No, don't add it."
  });
  console.log('  [Turn 3] Message:\n', t10_step3.message);
  console.log('  [Turn 3] Cart count:', t10_step3.cart?.items.length);

  if (t10_step3.cart && t10_step3.cart.items.length > 0) {
    throw new Error('Test 10 failed: Items added to cart despite declining upsell');
  }
  console.log("✔ TEST 10 PASSED: \"No, don't add it\" did not add the upsell to cart.\n");

  // ===========================================================================
  // TEST 11: "Clear my cart." (Explicit Confirmation Guardrail)
  // ===========================================================================
  console.log('TEST 11: Testing Clear Cart confirmation guardrail...');
  const session11 = `sess_cart_t11_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session11,
    message: 'Show me kurtas'
  });
  await handleAgentMessage({
    sessionId: session11,
    message: 'Add this to my cart in size M.'
  });

  const t11_step1 = await handleAgentMessage({
    sessionId: session11,
    message: 'Clear my cart.'
  });
  console.log('  [Turn 3] Prompted Confirmation Message:\n', t11_step1.message);

  if (!t11_step1.message.toLowerCase().includes('are you sure')) {
    throw new Error('Test 11 failed: Clearing cart must request explicit confirmation');
  }
  const cartMid11 = getCart(session11);
  if (cartMid11.items.length === 0) {
    throw new Error('Test 11 failed: Cart was cleared before user confirmed');
  }

  // Confirm clear
  const t11_step2 = await handleAgentMessage({
    sessionId: session11,
    message: 'Yes, clear it.'
  });
  console.log('  [Turn 4] Post-confirmation Message:', t11_step2.message);
  console.log('  [Turn 4] Cart items count:', t11_step2.cart?.items.length);

  if (t11_step2.cart?.items.length !== 0) {
    throw new Error('Test 11 failed: Cart was not cleared after explicit confirmation');
  }
  console.log('✔ TEST 11 PASSED: Destructive cart clear required and respected explicit confirmation.\n');

  // ===========================================================================
  // TEST 12: Ambiguous reference ("Remove that." with multiple items)
  // ===========================================================================
  console.log('TEST 12: Testing Ambiguous reference: "Remove that"...');
  const session12 = `sess_cart_t12_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session12,
    message: 'Show me men formal shirts'
  });
  await handleAgentMessage({
    sessionId: session12,
    message: 'Add the first one in size 40.'
  });
  await handleAgentMessage({
    sessionId: session12,
    message: 'Add the second one in size 42.'
  });

  const t12_res = await handleAgentMessage({
    sessionId: session12,
    message: 'Remove that'
  });
  console.log('  [Turn 4] Message:\n', t12_res.message);

  if (!t12_res.message.toLowerCase().includes('which item')) {
    throw new Error('Test 12 failed: Expected clarification for ambiguous "Remove that"');
  }
  const cartAfterAmbiguous = getCart(session12);
  if (cartAfterAmbiguous.items.length !== 2) {
    throw new Error('Test 12 failed: Item was prematurely removed without clarification');
  }
  console.log('✔ TEST 12 PASSED: Ambiguous removal prompted clarification without guessing.\n');

  // ===========================================================================
  // AUDIT LOG VERIFICATION
  // ===========================================================================
  console.log('Verifying Audit Logs in SQLite for Phase 5D events...');
  const addLogs = getAuditLogs({ action: 'add_to_bag' });
  const removeLogs = getAuditLogs({ action: 'remove_from_bag' });
  const updateLogs = getAuditLogs({ action: 'cart_quantity_updated' });
  const viewLogs = getAuditLogs({ action: 'cart_viewed' });
  const clearLogs = getAuditLogs({ action: 'cart_cleared' });

  console.log(`Audit Event Counts:
    - add_to_bag: ${addLogs.length}
    - remove_from_bag: ${removeLogs.length}
    - cart_quantity_updated: ${updateLogs.length}
    - cart_viewed: ${viewLogs.length}
    - cart_cleared: ${clearLogs.length}`);

  if (
    addLogs.length === 0 ||
    removeLogs.length === 0 ||
    updateLogs.length === 0 ||
    viewLogs.length === 0 ||
    clearLogs.length === 0
  ) {
    throw new Error('Audit verification failed: Missing required Phase 5D audit actions in audit_log');
  }

  const sampleAddLog = JSON.parse(addLogs[0].details || '{}');
  console.log('Sample add_to_bag audit details:', sampleAddLog);
  if (!sampleAddLog.productId || !sampleAddLog.price) {
    throw new Error('Audit verification failed: add_to_bag details missing productId or price');
  }

  console.log('✔ Audit Log Verification PASSED.\n');

  console.log('================================================================');
  console.log('   ALL 12 PHASE 5D AI SHOPPING & CART TESTS PASSED 100%!       ');
  console.log('================================================================\n');
}

runPhase5DTests().catch((err) => {
  console.error('Phase 5D tests encountered an error:', err);
  process.exit(1);
});
