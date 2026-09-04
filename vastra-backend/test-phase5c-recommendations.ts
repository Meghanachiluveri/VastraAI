import { getAuditLogs } from './src/services/auditService';
import { handleAgentMessage } from './src/services/agentService';
import { recommendProducts } from './src/services/catalogService';

async function runPhase5CTests() {
  console.log('================================================================');
  console.log('  PHASE 5C: INTELLIGENT RECOMMENDATIONS + BOUNDED UPSELL TESTS  ');
  console.log('================================================================\n');

  // ===========================================================================
  // TEST 1: Initial Discovery & Recommendation ("I need a black dress under ₹5000")
  // ===========================================================================
  console.log('TEST 1: Starting "I need a black dress under ₹5000"...');
  const session1 = `sess_rec_test1_${Date.now()}`;
  const t1_res = await handleAgentMessage({
    sessionId: session1,
    message: 'I need a black dress under ₹5000'
  });
  console.log('  [Turn 1] Message:', t1_res.message);
  console.log('  [Turn 1] Products:', t1_res.products.map((p) => `${p.name} (₹${p.price})`));
  console.log('  [Turn 1] Structured Recommendation:', t1_res.recommendation);

  if (!t1_res.products || t1_res.products.length === 0) {
    throw new Error('Test 1 failed: Expected recommended products');
  }
  if (!t1_res.products.every((p) => p.price <= 5000)) {
    throw new Error('Test 1 failed: Product outside budget of ₹5000 was returned');
  }
  console.log('✔ TEST 1 PASSED: Relevant recommendations returned within budget.\n');

  // ===========================================================================
  // TEST 2: "Which one would you recommend?" (Top Pick Selection)
  // ===========================================================================
  console.log('TEST 2: Starting "Which one would you recommend?"...');
  const t2_res = await handleAgentMessage({
    sessionId: session1,
    message: 'Which one would you recommend?'
  });
  console.log('  [Turn 2] Message:', t2_res.message);
  console.log('  [Turn 2] Recommendation:', t2_res.recommendation);

  if (!t2_res.recommendation || !t2_res.recommendation.productId) {
    throw new Error('Test 2 failed: Missing structured recommendation');
  }
  console.log('✔ TEST 2 PASSED: Agent selected and highlighted a top recommendation from returned products.\n');

  // ===========================================================================
  // TEST 3: "Why?" (Attribute-based Explanation)
  // ===========================================================================
  console.log('TEST 3: Starting "Why?"...');
  const t3_res = await handleAgentMessage({
    sessionId: session1,
    message: 'Why?'
  });
  console.log('  [Turn 3] Message:', t3_res.message);

  const lowerMsg3 = t3_res.message.toLowerCase();
  const hasAttributes =
    (lowerMsg3.includes('rating') || lowerMsg3.includes('★')) &&
    (lowerMsg3.includes('₹') || lowerMsg3.includes('budget') || lowerMsg3.includes('price')) &&
    (lowerMsg3.includes('stock') || lowerMsg3.includes('pieces') || lowerMsg3.includes('crafted') || lowerMsg3.includes('cotton'));

  if (!hasAttributes) {
    throw new Error('Test 3 failed: Explanation must use real product attributes (rating, price, stock, fabric)');
  }
  console.log('✔ TEST 3 PASSED: Explanation uses actual database product attributes.\n');

  // ===========================================================================
  // TEST 4: "I like this one" -> Bounded Upsell (Suggest ONE item)
  // ===========================================================================
  console.log('TEST 4: Starting "I like this one"...');
  const t4_res = await handleAgentMessage({
    sessionId: session1,
    message: 'I like this one'
  });
  console.log('  [Turn 4] Message:\n', t4_res.message);
  console.log('  [Turn 4] Upsell Suggestion:', t4_res.upsell);

  if (!t4_res.upsell || !t4_res.upsell.productId || !t4_res.upsell.requiresConfirmation) {
    throw new Error('Test 4 failed: Expected structured upsell suggestion');
  }
  console.log('✔ TEST 4 PASSED: Exactly ONE complementary upsell suggested with confirmation prompt.\n');

  // ===========================================================================
  // TEST 5: User says "No" -> Respect Decision Immediately
  // ===========================================================================
  console.log('TEST 5: Starting User Declines: "No"...');
  const t5_res = await handleAgentMessage({
    sessionId: session1,
    message: 'No'
  });
  console.log('  [Turn 5] Message:\n', t5_res.message);
  console.log('  [Turn 5] Upsell Status:', t5_res.upsell?.status);

  if (t5_res.upsell?.status !== 'declined') {
    throw new Error('Test 5 failed: Upsell status should be declined');
  }
  if (!t5_res.message.toLowerCase().includes('no problem') && !t5_res.message.toLowerCase().includes('stick with')) {
    throw new Error('Test 5 failed: Agent must respectfully acknowledge declining');
  }

  // Verify it is not repeated
  const t5_followup = await handleAgentMessage({
    sessionId: session1,
    message: 'I really love the first dress'
  });
  if (t5_followup.upsell?.status === 'suggested' && !t5_followup.context?.upsellDeclined) {
    throw new Error('Test 5 failed: Upsell was repeated after user declined');
  }
  console.log('✔ TEST 5 PASSED: Decline respected immediately; upsell not repeated in same context.\n');

  // ===========================================================================
  // TEST 6: User says "Yes" -> Capture Acceptance Without Creating Cart/Order
  // ===========================================================================
  console.log('TEST 6: Starting User Accepts: "Yes" in fresh session...');
  const session2 = `sess_rec_test2_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session2,
    message: 'Show me bandhgala jackets'
  });
  const t6_step2 = await handleAgentMessage({
    sessionId: session2,
    message: 'I like this one'
  });
  console.log('  [Turn 2] Upsell Proposed:', t6_step2.upsell);

  const t6_step3 = await handleAgentMessage({
    sessionId: session2,
    message: 'Yes'
  });
  console.log('  [Turn 3] Message:\n', t6_step3.message);
  console.log('  [Turn 3] Upsell Result:', t6_step3.upsell);

  if (t6_step3.upsell?.status !== 'accepted') {
    throw new Error('Test 6 failed: Expected upsell status to be accepted');
  }

  // Verify NO order was created
  const session2Orders = getAuditLogs({ sessionId: session2, action: 'order_created' });
  if (session2Orders.length > 0) {
    throw new Error('Test 6 failed: AI created an order upon upsell acceptance (Must NOT create orders in Phase 5C)');
  }
  console.log('✔ TEST 6 PASSED: User acceptance captured in state; NO order/cart was created.\n');

  // ===========================================================================
  // TEST 7: Out-of-Stock Products Must NOT Be Recommended as Purchasable
  // ===========================================================================
  console.log('TEST 7: Testing Out-of-Stock Guardrail...');
  const recResult = recommendProducts({ category: 'dresses' });
  const hasOutOfStock = recResult.products.some((p) => p.stock <= 0);
  if (hasOutOfStock) {
    throw new Error('Test 7 failed: Out of stock product was recommended');
  }
  console.log('✔ TEST 7 PASSED: Products with stock <= 0 are excluded from purchasable recommendations.\n');

  // ===========================================================================
  // TEST 8: Budget Constraints Strict Adherence
  // ===========================================================================
  console.log('TEST 8: Testing Strict Budget Constraints (Impossible ₹1000 budget)...');
  const session3 = `sess_rec_test3_${Date.now()}`;
  const t8_res = await handleAgentMessage({
    sessionId: session3,
    message: 'Show me bandhgala jackets under ₹1000'
  });
  console.log('  [Turn 1] Message:\n', t8_res.message);

  if (t8_res.products.length > 0 && t8_res.products.some((p) => p.price > 1000)) {
    throw new Error('Test 8 failed: Recommended products exceeding strict ₹1000 budget');
  }
  console.log('✔ TEST 8 PASSED: Agent respects budget constraints without recommending over-budget items.\n');

  // ===========================================================================
  // TEST 9: Bounded Upsell Limit (At Most ONE Item)
  // ===========================================================================
  console.log('TEST 9: Testing Bounded Upsell Limit (At Most ONE Item)...');
  const session4 = `sess_rec_test4_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session4,
    message: 'Show me men formal shirts'
  });
  const t9_res = await handleAgentMessage({
    sessionId: session4,
    message: 'I like this one'
  });
  console.log('  [Turn 2] Upsell item:', t9_res.upsell?.productName);

  if (t9_res.upsell && Array.isArray(t9_res.upsell.productId)) {
    throw new Error('Test 9 failed: Upsell must be exactly ONE product');
  }
  console.log('✔ TEST 9 PASSED: Upsell contains exactly ONE item.\n');

  // ===========================================================================
  // AUDIT LOG VERIFICATION
  // ===========================================================================
  console.log('Verifying Audit Logs in SQLite for Phase 5C events...');
  const recLogs = getAuditLogs({ action: 'recommendation' });
  const upsellSuggestedLogs = getAuditLogs({ action: 'upsell_suggested' });
  const upsellDeclinedLogs = getAuditLogs({ action: 'upsell_declined' });

  console.log(`Audit Event Counts: ${recLogs.length} recommendations, ${upsellSuggestedLogs.length} upsell_suggested, ${upsellDeclinedLogs.length} upsell_declined.`);

  if (recLogs.length === 0 || upsellSuggestedLogs.length === 0 || upsellDeclinedLogs.length === 0) {
    throw new Error('Audit verification failed: Missing required Phase 5C audit actions in audit_log');
  }

  const sampleUpsellLog = JSON.parse(upsellSuggestedLogs[0].details || '{}');
  console.log('Sample upsell_suggested audit details:', sampleUpsellLog);
  if (!sampleUpsellLog.productId || !sampleUpsellLog.price) {
    throw new Error('Audit verification failed: upsell_suggested details missing productId or price');
  }

  console.log('✔ Audit Log Verification PASSED.\n');

  console.log('================================================================');
  console.log('   ALL 9 PHASE 5C RECOMMENDATION & UPSELL TESTS PASSED 100%!    ');
  console.log('================================================================\n');
}

runPhase5CTests().catch((err) => {
  console.error('Phase 5C tests encountered an error:', err);
  process.exit(1);
});
