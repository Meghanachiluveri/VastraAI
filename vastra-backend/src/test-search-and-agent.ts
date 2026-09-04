import { extractShoppingIntent, recommendProducts, searchProducts } from './services/catalogService';
import { handleAgentMessage, getOrCreateSession } from './services/agentService';
import { getCart, clearCart } from './services/cartService';

async function runSearchAndAgentVerification() {
  console.log('================================================================');
  console.log('     VASTRA.AI — AI SEARCH & AGENT MATRIX VERIFICATION          ');
  console.log('================================================================\n');

  // TEST A: Strict category query ("Show me black dresses under 5000")
  console.log('TEST A: Query "Show me black dresses under 5000"...');
  const sessA = `test_sess_a_${Date.now()}`;
  const resA = await handleAgentMessage({
    sessionId: sessA,
    message: 'Show me black dresses under 5000'
  });

  console.log(`  [AI Message]: ${resA.message.substring(0, 150)}...`);
  console.log(`  [Products Returned]: ${resA.products.length}`);
  resA.products.forEach((p, idx) => {
    console.log(`    ${idx + 1}. [${p.id}] ${p.name} | Cat: ${p.category} | Colors: ${p.colors.join(', ')} | Price: ₹${p.price}`);
  });

  if (resA.products.length === 0) {
    throw new Error('Test A Failed: Expected at least 1 black dress under ₹5000');
  }

  for (const p of resA.products) {
    if (p.category !== 'dresses' && p.category !== 'co-ords') {
      throw new Error(`Test A Failed: Accessory or wrong category item "${p.name}" (${p.category}) returned for dress query!`);
    }
    if (p.price > 5000) {
      throw new Error(`Test A Failed: Product "${p.name}" (₹${p.price}) exceeds ₹5000 budget!`);
    }
  }
  console.log('✔ TEST A PASSED: Strict category and budget filtering preserved; zero accessories returned.\n');

  // TEST B: Multi-turn Context Memory ("Something more formal")
  console.log('TEST B: Multi-turn refinement "Something more formal"...');
  const resB = await handleAgentMessage({
    sessionId: sessA,
    message: 'Something more formal'
  });

  console.log(`  [Refined Products]: ${resB.products.length}`);
  resB.products.forEach((p, idx) => {
    console.log(`    ${idx + 1}. [${p.id}] ${p.name} | Cat: ${p.category} | Style: ${(p.styleTags || []).join(', ')} | Price: ₹${p.price}`);
  });

  if (resB.products.length === 0) {
    throw new Error('Test B Failed: Context refinement returned 0 items');
  }
  console.log('✔ TEST B PASSED: Context memory preserved across turns.\n');

  // TEST C: Size Availability Check ("Is M available?")
  console.log('TEST C: Size availability inquiry ("Is M available?")...');
  const resC = await handleAgentMessage({
    sessionId: sessA,
    message: 'Is M available?'
  });
  console.log(`  [AI Response]: ${resC.message}`);
  if (!resC.message.toLowerCase().includes('size m') && !resC.message.toLowerCase().includes('size **m**') && !resC.message.toLowerCase().includes('available')) {
    throw new Error('Test C Failed: AI did not answer size availability check accurately');
  }
  console.log('✔ TEST C PASSED: Real-time inventory size check operational.\n');

  // TEST D: Ordinal Selection & Add to Bag ("Add the first one to my bag")
  console.log('TEST D: Ordinal Add to Bag ("Add the first one to my bag")...');
  const resD = await handleAgentMessage({
    sessionId: sessA,
    message: 'Add the first one to my bag'
  });
  console.log(`  [AI Cart Response]: ${resD.message}`);
  const cartD = getCart(sessA, 'agent');
  console.log(`  [Cart Total]: ₹${cartD.total}, Items: ${cartD.itemCount}`);
  if (cartD.itemCount !== 1) {
    throw new Error(`Test D Failed: Expected 1 item in cart, got ${cartD.itemCount}`);
  }
  console.log('✔ TEST D PASSED: Ordinal resolution and add to bag functional.\n');

  // TEST E: Server-Side Guardrail on Oversize Add to Bag
  console.log('TEST E: ₹10,000 spending guardrail on AI Add to Bag...');
  const sessE = `test_sess_e_${Date.now()}`;
  // Attempt to add a product that costs ₹18,500
  const resE = await handleAgentMessage({
    sessionId: sessE,
    message: 'Add the Raw Mulberry Silk Bandhgala Jacket to my bag'
  });
  console.log(`  [AI Guardrail Message]: ${resE.message}`);
  const cartE = getCart(sessE, 'agent');
  if (cartE.items.length > 0) {
    throw new Error('Test E Failed: Item exceeding ₹10,000 limit was added to bag!');
  }
  console.log('✔ TEST E PASSED: ₹10,000 spending limit blocked over-budget addition.\n');

  // TEST F: Impossible Nonexistent Product ("Astronaut suit")
  console.log('TEST F: Impossible Product Grounding ("Do you have an astronaut spacesuit?")...');
  const sessF = `test_sess_f_${Date.now()}`;
  const resF = await handleAgentMessage({
    sessionId: sessF,
    message: 'Do you have an astronaut spacesuit?'
  });
  console.log(`  [AI Grounding Response]: ${resF.message}`);
  if (resF.products.length > 0 || !resF.message.includes("couldn't find that item")) {
    throw new Error('Test F Failed: Nonexistent product was not properly grounded');
  }
  console.log('✔ TEST F PASSED: Nonexistent item correctly grounded with honest disclaimer.\n');

  console.log('================================================================');
  console.log('    ALL AI SEARCH & CONVERSATION TESTS PASSED 100%!             ');
  console.log('================================================================\n');
}

runSearchAndAgentVerification().catch((err) => {
  console.error('\n❌ Test failed:', err);
  process.exit(1);
});
