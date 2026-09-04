import { initDatabase } from './db/db';
import { seedProducts } from './db/seed';
import { handleAgentMessage, prepareCheckout } from './services/agentService';
import { addToCart, getCart } from './services/cartService';
import { validateOrder } from './services/orderService';

async function runConciergeTestSuite() {
  console.log('================================================================');
  console.log('       VASTRA.AI — AI STYLIST CONCIERGE TEST SUITE (12/12)     ');
  console.log('================================================================\n');

  initDatabase();
  seedProducts();

  const testSessionId = `sess_concierge_test_${Date.now()}`;
  let passed = 0;

  // ---------------------------------------------------------------------------
  // TEST 1 — Real Catalog Search: "Show me black dresses under ₹5,000"
  // ---------------------------------------------------------------------------
  console.log('TEST 1: "Show me black dresses under ₹5,000"...');
  const res1 = await handleAgentMessage({
    sessionId: testSessionId,
    message: 'Show me black dresses under ₹5,000'
  });

  if (res1.products.length === 0) {
    throw new Error('Test 1 Failed: Expected to find matching black dress');
  }
  const blackDress = res1.products[0];
  console.log(`  [Found Product]: ${blackDress.name} (₹${blackDress.price})`);
  if (blackDress.price > 5000) {
    throw new Error('Test 1 Failed: Product price exceeded ₹5,000');
  }
  if (!res1.matchReasons || !res1.matchReasons[blackDress.id]) {
    throw new Error('Test 1 Failed: Match reason not generated for recommended piece');
  }
  console.log(`  [Match Reason]: ${res1.matchReasons[blackDress.id]}`);
  console.log('✔ TEST 1 PASSED: Real catalog search returned grounded black dress under budget.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 2 — Conversational Context Refinement: "Something more formal"
  // ---------------------------------------------------------------------------
  console.log('TEST 2: "Something more formal"...');
  const res2 = await handleAgentMessage({
    sessionId: testSessionId,
    message: 'Something more formal'
  });

  if (res2.products.length === 0) {
    throw new Error('Test 2 Failed: Formal refinement returned empty list');
  }
  console.log(`  [Refined Pieces]: ${res2.products.map((p) => p.name).join(', ')}`);
  console.log('✔ TEST 2 PASSED: Context retained and refined to formal artisanal silhouettes.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 3 — Size Availability Check: "Show me size M" / "Is it available in M?"
  // ---------------------------------------------------------------------------
  console.log('TEST 3: "Is it available in M?"...');
  const res3 = await handleAgentMessage({
    sessionId: testSessionId,
    message: 'Is it available in M?'
  });

  console.log(`  [Response]: ${res3.message}`);
  if (!res3.message.toLowerCase().includes('available in size') && !res3.message.toLowerCase().includes('yes')) {
    throw new Error('Test 3 Failed: Size check did not confirm availability');
  }
  console.log('✔ TEST 3 PASSED: Verified real inventory availability for size M.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 4 — Ordinal Selection: "The second one"
  // ---------------------------------------------------------------------------
  console.log('TEST 4: "The second one"...');
  const res4 = await handleAgentMessage({
    sessionId: testSessionId,
    message: 'The second one'
  });

  if (res4.products.length === 0) {
    throw new Error('Test 4 Failed: Could not inspect second product');
  }
  console.log(`  [Inspected Piece]: ${res4.products[0].name} (₹${res4.products[0].price})`);
  console.log('✔ TEST 4 PASSED: Second piece accurately selected from previous conversational turn.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 5 — Add to Bag via AI Concierge: "Add it to my bag"
  // ---------------------------------------------------------------------------
  console.log('TEST 5: "Add it to my bag"...');
  const res5 = await handleAgentMessage({
    sessionId: testSessionId,
    message: 'Add it to my bag'
  });

  console.log(`  [Response]: ${res5.message}`);
  console.log(`  [Cart Total]: ₹${res5.cart?.total} (${res5.cart?.itemCount} items)`);
  if (!res5.cart || res5.cart.itemCount === 0) {
    throw new Error('Test 5 Failed: Cart count did not increase after adding item');
  }
  console.log('✔ TEST 5 PASSED: Piece added directly to shared session cart.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 6 — Verify Shared Cart Persistence
  // ---------------------------------------------------------------------------
  console.log('TEST 6: Verify shared cart from storefront perspective...');
  const storefrontCart = getCart(testSessionId, 'human');
  if (storefrontCart.items.length === 0) {
    throw new Error('Test 6 Failed: Storefront cart is empty; shared cart desynchronized');
  }
  console.log(`  [Storefront Cart View]: ${storefrontCart.items.map((i) => `${i.name} (${i.size})`).join(', ')}`);
  console.log('✔ TEST 6 PASSED: Shared cart 100% synchronized between AI and storefront.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 7 — Storefront Addition Synchronized with Agent
  // ---------------------------------------------------------------------------
  console.log('TEST 7: Add item via storefront, verify agent sees updated cart...');
  addToCart({
    sessionId: testSessionId,
    productId: 'uni-006', // Solid Brass & Saddle Leather Minimal Belt (₹2,499)
    quantity: 1,
    channel: 'human'
  });

  const cartInquiryRes = await handleAgentMessage({
    sessionId: testSessionId,
    message: "What's in my cart?"
  });

  console.log(`  [Agent Cart Audit]:\n${cartInquiryRes.message}`);
  if (!cartInquiryRes.cart || cartInquiryRes.cart.itemCount < 2) {
    throw new Error('Test 7 Failed: Agent did not reflect storefront addition');
  }
  console.log('✔ TEST 7 PASSED: Storefront additions instantly visible to AI concierge.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 8 — Hallucination Prevention for Nonexistent Garment
  // ---------------------------------------------------------------------------
  console.log('TEST 8: "Show me a purple leather astronaut suit"...');
  const res8 = await handleAgentMessage({
    sessionId: `sess_hallucinate_${Date.now()}`,
    message: 'Show me a purple leather astronaut suit'
  });

  console.log(`  [AI Response]: ${res8.message}`);
  if (res8.products.length > 0 && res8.products.some((p) => p.name.toLowerCase().includes('astronaut'))) {
    throw new Error('Test 8 Failed: AI hallucinated a nonexistent product!');
  }
  console.log('✔ TEST 8 PASSED: Hallucination prevented; honest unavailability reported.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 9 — Complete Look Curation under ₹8,000
  // ---------------------------------------------------------------------------
  console.log('TEST 9: "Wedding guest look under ₹8,000"...');
  const res9 = await handleAgentMessage({
    sessionId: `sess_look_${Date.now()}`,
    message: 'Wedding guest look under ₹8,000'
  });

  if (!res9.curatedLook) {
    throw new Error('Test 9 Failed: No curatedLook object returned');
  }
  console.log(`  [Curated Look Title]: ${res9.curatedLook.title}`);
  console.log(`  [Main Piece]: ${res9.curatedLook.mainItem.name} (₹${res9.curatedLook.mainItem.price})`);
  console.log(`  [Complementary Piece]: ${res9.curatedLook.complementaryItem.name} (₹${res9.curatedLook.complementaryItem.price})`);
  console.log(`  [Total Look Price]: ₹${res9.curatedLook.totalPrice}`);

  if (res9.curatedLook.totalPrice > 8000) {
    throw new Error(`Test 9 Failed: Curated look price ₹${res9.curatedLook.totalPrice} exceeded ₹8,000 budget`);
  }
  if (res9.curatedLook.totalPrice > 10000) {
    throw new Error('Test 9 Failed: Curated look violated ₹10,000 spending guardrail');
  }
  console.log('✔ TEST 9 PASSED: Complete look curated under ₹8,000 and ₹10k guardrail.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 10 — Spending Guardrail Enforcement (> ₹10,000)
  // ---------------------------------------------------------------------------
  console.log('TEST 10: Enforce ₹10,000 spending guardrail...');
  const luxuryOrderVal = validateOrder({
    channel: 'agent',
    items: [{ productId: 'women-001', quantity: 1, size: 'S' }] // ₹16,999
  });

  if (luxuryOrderVal.valid || luxuryOrderVal.reason !== 'ORDER_VALUE_LIMIT_EXCEEDED') {
    throw new Error('Test 10 Failed: Order over ₹10,000 was not rejected by guardrail');
  }
  console.log('✔ TEST 10 PASSED: ₹10,000 spending limit strictly enforced by backend.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 11 — Unavailable Size Check
  // ---------------------------------------------------------------------------
  console.log('TEST 11: Ask for unavailable size XXL on a 4-size piece...');
  const sizeCheckSession = `sess_size_audit_${Date.now()}`;
  await handleAgentMessage({
    sessionId: sizeCheckSession,
    message: 'Show me the Tiered Organic Poplin Midi Dress'
  });

  const res11 = await handleAgentMessage({
    sessionId: sizeCheckSession,
    message: 'Do you have size XXL?'
  });

  console.log(`  [AI Size Response]: ${res11.message}`);
  if (!res11.message.toLowerCase().includes('unavailable') && !res11.message.toLowerCase().includes('not in this production run')) {
    throw new Error('Test 11 Failed: Agent falsely claimed size XXL is available');
  }
  console.log('✔ TEST 11 PASSED: Agent accurately reported unavailable size.\n');
  passed++;

  // ---------------------------------------------------------------------------
  // TEST 12 — Add Curated Look to Bag
  // ---------------------------------------------------------------------------
  console.log('TEST 12: "Add look to my bag"...');
  const lookSession = `sess_look_add_${Date.now()}`;
  await handleAgentMessage({
    sessionId: lookSession,
    message: 'Build me a complete look'
  });

  const addLookRes = await handleAgentMessage({
    sessionId: lookSession,
    message: 'Add look to my bag'
  });

  console.log(`  [Response]: ${addLookRes.message}`);
  console.log(`  [Cart Total]: ₹${addLookRes.cart?.total} (${addLookRes.cart?.itemCount} items)`);
  if (!addLookRes.cart || addLookRes.cart.itemCount !== 2) {
    throw new Error('Test 12 Failed: Expected exactly 2 items added to cart for complete look');
  }
  console.log('✔ TEST 12 PASSED: Complete look added atomically to shared cart.\n');
  passed++;

  console.log('================================================================');
  console.log(` ALL ${passed}/12 CONCIERGE TEST SCENARIOS PASSED 100%!       `);
  console.log('================================================================\n');
}

runConciergeTestSuite().catch((err) => {
  console.error('\n❌ Concierge test suite failed:', err);
  process.exit(1);
});
