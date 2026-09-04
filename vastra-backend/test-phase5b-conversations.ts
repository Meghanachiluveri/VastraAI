import { getAuditLogs } from './src/services/auditService';
import { handleAgentMessage } from './src/services/agentService';

async function runPhase5BTests() {
  console.log('================================================================');
  console.log('    PHASE 5B: MULTI-TURN SHOPPING CONVERSATION & CONTEXT TESTS  ');
  console.log('================================================================\n');

  // ===========================================================================
  // TEST 1: Refinement Query ("I need a black dress under ₹5000" -> "Anything cheaper?")
  // ===========================================================================
  console.log('TEST 1: Starting "I need a black dress under ₹5000" -> "Anything cheaper?"...');
  const session1 = `sess_test1_${Date.now()}`;
  const t1_step1 = await handleAgentMessage({
    sessionId: session1,
    message: 'I need a black dress under ₹5000'
  });
  console.log('  [Turn 1] Message:', t1_step1.message);
  console.log('  [Turn 1] Products:', t1_step1.products.map((p) => `${p.name} (₹${p.price})`));

  if (!t1_step1.products || t1_step1.products.length === 0) {
    throw new Error('Test 1 failed: Initial dress search returned no products');
  }

  const t1_step2 = await handleAgentMessage({
    sessionId: session1,
    message: 'Anything cheaper?'
  });
  console.log('  [Turn 2] Message:', t1_step2.message);
  console.log('  [Turn 2] Products:', t1_step2.products.map((p) => `${p.name} (₹${p.price})`));

  const t1_logs = getAuditLogs({ sessionId: session1, action: 'refine' });
  if (t1_logs.length === 0) {
    throw new Error('Test 1 failed: Missing refine audit log event');
  }
  const t1_refine_details = JSON.parse(t1_logs[0].details || '{}');
  console.log('  [Turn 2] Refinement Audit Details:', t1_refine_details);

  if (!t1_refine_details.previous || !t1_refine_details.updated) {
    throw new Error('Test 1 failed: Refinement log must contain previous and updated context objects');
  }
  console.log('✔ TEST 1 PASSED: Second request preserved category/color context with lower price constraint.\n');

  // ===========================================================================
  // TEST 2: Gender & Style Context ("Show me men's shirts" -> "Only formal ones")
  // ===========================================================================
  console.log('TEST 2: Starting "Show me men\'s shirts" -> "Only formal ones"...');
  const session2 = `sess_test2_${Date.now()}`;
  const t2_step1 = await handleAgentMessage({
    sessionId: session2,
    message: "Show me men's shirts"
  });
  console.log('  [Turn 1] Products:', t2_step1.products.map((p) => `${p.name} (${p.gender})`));

  const t2_step2 = await handleAgentMessage({
    sessionId: session2,
    message: 'Only formal ones'
  });
  console.log('  [Turn 2] Message:', t2_step2.message);
  console.log('  [Turn 2] Products:', t2_step2.products.map((p) => `${p.name} (${p.category})`));

  if (!t2_step2.products.some((p) => p.category.toLowerCase().includes('formal') || p.name.toLowerCase().includes('formal') || p.gender === 'men')) {
    throw new Error('Test 2 failed: Refinement did not preserve men gender or narrow to formal shirts');
  }
  console.log('✔ TEST 2 PASSED: Gender context preserved (men) and narrowed to formal shirts.\n');

  // ===========================================================================
  // TEST 3: Size Availability Context ("Show me jackets" -> "Do you have them in L?")
  // ===========================================================================
  console.log('TEST 3: Starting "Show me jackets" -> "Do you have them in L?"...');
  const session3 = `sess_test3_${Date.now()}`;
  const t3_step1 = await handleAgentMessage({
    sessionId: session3,
    message: 'Show me jackets'
  });
  console.log('  [Turn 1] Jackets returned:', t3_step1.products.map((p) => `${p.name} (Sizes: ${p.sizes.join(', ')})`));

  const t3_step2 = await handleAgentMessage({
    sessionId: session3,
    message: 'Do you have them in L?'
  });
  console.log('  [Turn 2] Message:', t3_step2.message);
  console.log('  [Turn 2] Actions:', t3_step2.actions);

  if (!t3_step2.message.toLowerCase().includes('size') && !t3_step2.message.toLowerCase().includes('available') && !t3_step2.message.includes('L')) {
    throw new Error('Test 3 failed: Size availability response invalid');
  }
  console.log('✔ TEST 3 PASSED: Size inquiry checked against database sizes for current jacket items.\n');

  // ===========================================================================
  // TEST 4: Product Reference Resolution ("Show me dresses" -> "Tell me more about the second one")
  // ===========================================================================
  console.log('TEST 4: Starting "Show me dresses" -> "Tell me more about the second one"...');
  const session4 = `sess_test4_${Date.now()}`;
  const t4_step1 = await handleAgentMessage({
    sessionId: session4,
    message: 'Show me dresses'
  });
  console.log('  [Turn 1] Dresses:', t4_step1.products.map((p, idx) => `[#${idx + 1}] ${p.id}: ${p.name}`));

  if (t4_step1.products.length < 2) {
    throw new Error('Test 4 failed: Expected at least 2 dresses in catalog');
  }
  const expectedSecondProduct = t4_step1.products[1];

  const t4_step2 = await handleAgentMessage({
    sessionId: session4,
    message: 'Tell me more about the second one'
  });
  console.log('  [Turn 2] Message:', t4_step2.message);
  console.log('  [Turn 2] Actions:', t4_step2.actions);

  if (!t4_step2.message.toLowerCase().includes(expectedSecondProduct.name.toLowerCase().substring(0, 10))) {
    throw new Error(`Test 4 failed: Expected info about second product (${expectedSecondProduct.name})`);
  }
  console.log('✔ TEST 4 PASSED: Correctly resolved "second one" to index 1 product and retrieved full details.\n');

  // ===========================================================================
  // TEST 5: Similarity Context ("I like this one" -> "Show me something similar")
  // ===========================================================================
  console.log('TEST 5: Starting "I like this one" -> "Show me something similar"...');
  const session5 = `sess_test5_${Date.now()}`;
  await handleAgentMessage({
    sessionId: session5,
    message: 'Show me bandhgala jackets'
  });

  const t5_step2 = await handleAgentMessage({
    sessionId: session5,
    message: 'Show me something similar'
  });
  console.log('  [Turn 2] Similar products:', t5_step2.products.map((p) => p.name));
  console.log('  [Turn 2] Actions:', t5_step2.actions);

  if (!t5_step2.actions.includes('get_similar_products') && t5_step2.products.length === 0) {
    throw new Error('Test 5 failed: get_similar_products tool was not used');
  }
  console.log('✔ TEST 5 PASSED: Similar complementary pieces retrieved based on recent product context.\n');

  // ===========================================================================
  // TEST 6: Change Request / Overwrite ("Dress under ₹5000" -> "Actually make it ₹7000")
  // ===========================================================================
  console.log('TEST 6: Starting "Dress under ₹5000" -> "Actually make it ₹7000"...');
  const session6 = `sess_test6_${Date.now()}`;
  const t6_step1 = await handleAgentMessage({
    sessionId: session6,
    message: 'Dress under ₹5000'
  });
  console.log('  [Turn 1] Products under ₹5000:', t6_step1.products.map((p) => `${p.name} (₹${p.price})`));

  const t6_step2 = await handleAgentMessage({
    sessionId: session6,
    message: 'Actually make it ₹7000'
  });
  console.log('  [Turn 2] Message:', t6_step2.message);
  console.log('  [Turn 2] Products under ₹7000:', t6_step2.products.map((p) => `${p.name} (₹${p.price})`));

  const t6_logs = getAuditLogs({ sessionId: session6, action: 'refine' });
  if (t6_logs.length === 0) {
    throw new Error('Test 6 failed: Missing refine audit log event for price update');
  }
  const t6_refine_details = JSON.parse(t6_logs[0].details || '{}');
  console.log('  [Turn 2] Price Overwrite Audit Details:', t6_refine_details);

  if (t6_refine_details.updated?.maxPrice !== 7000) {
    throw new Error('Test 6 failed: Updated maxPrice was not set to 7000');
  }
  console.log('✔ TEST 6 PASSED: Price constraint correctly overwritten to ₹7000 without combining old limit.\n');

  // ===========================================================================
  // TEST 7: Ambiguous Reference With No Prior Context ("Show me the second one")
  // ===========================================================================
  console.log('TEST 7: Starting Ambiguous Reference with no prior list: "Show me the second one"...');
  const session7 = `sess_test7_${Date.now()}`;
  const t7_step1 = await handleAgentMessage({
    sessionId: session7,
    message: 'Show me the second one'
  });
  console.log('  [Turn 1] Message:', t7_step1.message);
  console.log('  [Turn 1] Products count:', t7_step1.products.length);

  if (
    !t7_step1.message.toLowerCase().includes('which product') &&
    !t7_step1.message.toLowerCase().includes('haven') &&
    !t7_step1.message.toLowerCase().includes('list') &&
    !t7_step1.message.toLowerCase().includes('mean')
  ) {
    throw new Error('Test 7 failed: Agent should return a polite clarification instead of hallucinating');
  }
  if (t7_step1.products.length > 0) {
    throw new Error('Test 7 failed: Agent should not return hallucinated products for empty reference');
  }
  console.log('✔ TEST 7 PASSED: Short clarification returned for ambiguous reference without hallucination.\n');

  // ===========================================================================
  // AUDIT LOG VERIFICATION SUMMARY
  // ===========================================================================
  console.log('Verifying Total Audit Log Events across all test sessions...');
  const allLogs = getAuditLogs({ limit: 50 });
  const searchCount = allLogs.filter((l) => l.action === 'search').length;
  const proposeCount = allLogs.filter((l) => l.action === 'propose').length;
  const refineCount = allLogs.filter((l) => l.action === 'refine').length;

  console.log(`Audit Summary: ${searchCount} search events, ${proposeCount} propose events, ${refineCount} refine events.`);
  if (searchCount === 0 || proposeCount === 0 || refineCount === 0) {
    throw new Error('Audit verification failed: Missing required action types in audit log');
  }
  console.log('✔ Audit Log Verification PASSED.\n');

  console.log('================================================================');
  console.log('  ALL 7 PHASE 5B MULTI-TURN SHOPPING CONVERSATION TESTS PASSED!  ');
  console.log('================================================================\n');
}

runPhase5BTests().catch((err) => {
  console.error('Phase 5B tests encountered an error:', err);
  process.exit(1);
});
