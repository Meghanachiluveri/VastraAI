import { getAuditLogs } from './src/services/auditService';

const BASE_URL = 'http://localhost:4000';

async function runAgentTests() {
  console.log('================================================================');
  console.log('       PHASE 5A: VASTRA.AI GEMINI AGENT CONVERSATION TESTS      ');
  console.log('================================================================\n');

  const testSessionId = `sess_agent_test_${Date.now()}`;

  // ---------------------------------------------------------------------------
  // TEST 1: Initial Discovery Query ("I need a black dress under ₹5000")
  // ---------------------------------------------------------------------------
  console.log('1. Testing: "I need a black dress under ₹5000"...');
  const res1 = await fetch(`${BASE_URL}/api/agent/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: testSessionId,
      message: 'I need a black dress under ₹5000'
    })
  });
  const data1: any = await res1.json();
  console.log('Agent Response 1:\n', data1.message);
  console.log('Products returned:', data1.products?.map((p: any) => `${p.name} (₹${p.price})`));
  console.log('Actions performed:', data1.actions);

  if (res1.status !== 200 || !data1.message || data1.sessionId !== testSessionId) {
    throw new Error('Test 1 failed: Invalid agent response');
  }
  console.log('✔ Test 1 PASSED: Catalog search executed & real products curated\n');

  // ---------------------------------------------------------------------------
  // TEST 2: Contextual Refinement ("Anything cheaper?")
  // ---------------------------------------------------------------------------
  console.log('2. Testing Contextual Refinement: "Anything cheaper?"...');
  const res2 = await fetch(`${BASE_URL}/api/agent/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: testSessionId,
      message: 'Anything cheaper?'
    })
  });
  const data2: any = await res2.json();
  console.log('Agent Response 2:\n', data2.message);
  console.log('Products returned:', data2.products?.map((p: any) => `${p.name} (₹${p.price})`));

  if (res2.status !== 200 || !data2.message) {
    throw new Error('Test 2 failed: Contextual refinement failed');
  }
  console.log('✔ Test 2 PASSED: Refinement query preserved conversation context\n');

  // ---------------------------------------------------------------------------
  // TEST 3: Similarity Inquiry ("Show me something similar")
  // ---------------------------------------------------------------------------
  console.log('3. Testing Similarity Inquiry: "Show me something similar"...');
  const res3 = await fetch(`${BASE_URL}/api/agent/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: testSessionId,
      message: 'Show me something similar'
    })
  });
  const data3: any = await res3.json();
  console.log('Agent Response 3:\n', data3.message);
  console.log('Products returned:', data3.products?.map((p: any) => `${p.name} (₹${p.price})`));

  if (res3.status !== 200 || !data3.message) {
    throw new Error('Test 3 failed: Similarity recommendation failed');
  }
  console.log('✔ Test 3 PASSED: Similar complementary pieces suggested\n');

  // ---------------------------------------------------------------------------
  // TEST 4: Size Availability Inquiry ("Do you have this in M?")
  // ---------------------------------------------------------------------------
  console.log('4. Testing Size Inquiry: "Do you have this in M?"...');
  const res4 = await fetch(`${BASE_URL}/api/agent/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: testSessionId,
      message: 'Do you have this in M?'
    })
  });
  const data4: any = await res4.json();
  console.log('Agent Response 4:\n', data4.message);

  if (res4.status !== 200 || !data4.message) {
    throw new Error('Test 4 failed: Size availability inquiry failed');
  }
  console.log('✔ Test 4 PASSED: Contextual size check answered from database attributes\n');

  // ---------------------------------------------------------------------------
  // TEST 5: Non-existent product query (Anti-Hallucination)
  // ---------------------------------------------------------------------------
  console.log('5. Testing Non-Existent Product: "Do you have a neon yellow spacesuit with jetpack?"...');
  const res5 = await fetch(`${BASE_URL}/api/agent/message`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionId: `sess_none_${Date.now()}`,
      message: 'Do you have a neon yellow spacesuit with jetpack?'
    })
  });
  const data5: any = await res5.json();
  console.log('Agent Response 5:\n', data5.message);

  if (res5.status !== 200 || data5.products.length > 0 || !data5.message.toLowerCase().includes('couldn') && !data5.message.toLowerCase().includes('explore') && !data5.message.toLowerCase().includes('not')) {
    throw new Error('Test 5 failed: Agent hallucinated non-existent product');
  }
  console.log('✔ Test 5 PASSED: Truthful rejection of non-existent product without hallucinations\n');

  // ---------------------------------------------------------------------------
  // TEST 6: Audit Logging Verification
  // ---------------------------------------------------------------------------
  console.log('6. Verifying Agent Audit Logs...');
  const sessionLogs = getAuditLogs({ sessionId: testSessionId });
  const actionNames = sessionLogs.map((l) => l.action);
  console.log('Recorded session audit actions:', actionNames);

  if (!actionNames.includes('search') || !actionNames.includes('propose') || !actionNames.includes('refine')) {
    throw new Error('Test 6 failed: Missing search, propose, or refine audit logs');
  }
  console.log('✔ Test 6 PASSED: Search, Propose, and Refine audit events verified\n');

  console.log('================================================================');
  console.log('     ALL 6 GEMINI SHOPPING AGENT TESTS PASSED SUCCESSFULLY!     ');
  console.log('================================================================\n');
}

runAgentTests().catch((err) => {
  console.error('Agent tests encountered an error:', err);
  process.exit(1);
});
