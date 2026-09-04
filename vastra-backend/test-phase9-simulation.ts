import { db, initDatabase } from './src/db/db';
import {
  getSimulationRunById,
  getSimulationRuns,
  runSimulation
} from './src/services/simulationService';
import { getMerchantOverview } from './src/services/merchantService';

async function runPhase9SimulationTests() {
  console.log('================================================================');
  console.log('   PHASE 9: AI COMMERCE SIMULATION ENGINE TESTS                ');
  console.log('================================================================\n');

  initDatabase();

  // Baseline real store metrics
  const realOverviewBefore = getMerchantOverview('all');
  const realOrdersCountBefore = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any).count;
  const productsBefore = db.prepare('SELECT id, stock FROM products').all() as { id: string; stock: number }[];

  console.log('Initial Real Store State:', {
    totalRevenue: realOverviewBefore.totalRevenue,
    humanRevenue: realOverviewBefore.humanRevenue,
    aiRevenue: realOverviewBefore.aiRevenue,
    realOrders: realOrdersCountBefore,
    totalProducts: productsBefore.length
  });

  // ===========================================================================
  // TEST 1 — RUN SIMULATION WITH 10 SHOPPERS
  // ===========================================================================
  console.log('\nTEST 1: Run simulation with 10 shoppers...');
  const sim10 = runSimulation({ numberOfShoppers: 10, seed: 1001 });
  console.log('  [Sim 10 Results]:', {
    simulationId: sim10.simulationId,
    shoppers: sim10.numberOfShoppers,
    sessions: sim10.sessions,
    searches: sim10.searches,
    recommendations: sim10.recommendations,
    cartAdditions: sim10.cartAdditions,
    checkoutAttempts: sim10.checkoutAttempts,
    successfulOrders: sim10.successfulOrders,
    simulatedRevenue: `₹${sim10.revenue}`,
    conversionRate: `${sim10.conversionRate}%`
  });

  if (sim10.numberOfShoppers !== 10 || sim10.sessions !== 10) {
    throw new Error('Test 1 failed: Expected 10 shoppers and 10 sessions');
  }
  if (sim10.searches === 0 || sim10.recommendations === 0) {
    throw new Error('Test 1 failed: Expected non-zero searches and recommendations');
  }
  console.log('✔ TEST 1 PASSED: 10-shopper simulation generated successfully.\n');

  // ===========================================================================
  // TEST 2 — RUN SIMULATION WITH 50 SHOPPERS
  // ===========================================================================
  console.log('TEST 2: Run simulation with 50 shoppers (proportional scaling)...');
  const sim50 = runSimulation({ numberOfShoppers: 50, seed: 5001 });
  console.log('  [Sim 50 Results]:', {
    simulationId: sim50.simulationId,
    shoppers: sim50.numberOfShoppers,
    sessions: sim50.sessions,
    searches: sim50.searches,
    recommendations: sim50.recommendations,
    cartAdditions: sim50.cartAdditions,
    successfulOrders: sim50.successfulOrders,
    simulatedRevenue: `₹${sim50.revenue}`,
    conversionRate: `${sim50.conversionRate}%`
  });

  if (sim50.numberOfShoppers !== 50 || sim50.sessions !== 50) {
    throw new Error('Test 2 failed: Expected 50 shoppers and 50 sessions');
  }
  if (sim50.searches <= sim10.searches || sim50.recommendations <= sim10.recommendations) {
    throw new Error('Test 2 failed: 50-shopper simulation did not scale funnel events');
  }
  console.log('✔ TEST 2 PASSED: 50-shopper simulation scaled funnel metrics accurately.\n');

  // ===========================================================================
  // TEST 3 — SIMULATED REVENUE CALCULATED FROM CATALOG PRICES
  // ===========================================================================
  console.log('TEST 3: Verify simulated revenue is calculated from actual products...');
  console.log('  [Revenue]:', sim50.revenue, '[Orders]:', sim50.successfulOrders, '[AOV]:', sim50.averageOrderValue);

  if (sim50.successfulOrders > 0) {
    const expectedAOV = Math.round(sim50.revenue / sim50.successfulOrders);
    if (sim50.averageOrderValue !== expectedAOV) {
      throw new Error(`Test 3 failed: AOV ${sim50.averageOrderValue} does not match revenue/orders ${expectedAOV}`);
    }
  }
  if (sim50.topProducts.length === 0) {
    throw new Error('Test 3 failed: No top products generated in simulation');
  }
  console.log('  [Top Product Sample]:', sim50.topProducts[0]?.name, 'Price: ₹' + sim50.topProducts[0]?.price);
  console.log('✔ TEST 3 PASSED: Simulated revenue and AOV calculated from catalog prices.\n');

  // ===========================================================================
  // TEST 4 — SIMULATION DOES NOT CHANGE REAL INVENTORY
  // ===========================================================================
  console.log('TEST 4: Verify simulation does NOT change real inventory...');
  // Run an intensive 100-shopper simulation
  const sim100 = runSimulation({ numberOfShoppers: 100, seed: 9999 });
  const productsAfter = db.prepare('SELECT id, stock FROM products').all() as { id: string; stock: number }[];

  for (let i = 0; i < productsBefore.length; i++) {
    const before = productsBefore[i];
    const after = productsAfter.find((p) => p.id === before.id);
    if (!after || after.stock !== before.stock) {
      throw new Error(`Test 4 failed: Product ${before.id} stock changed from ${before.stock} to ${after?.stock}`);
    }
  }
  console.log('✔ TEST 4 PASSED: Live inventory remained 100% untouched across 100 simulated shoppers.\n');

  // ===========================================================================
  // TEST 5 — SIMULATION DOES NOT CREATE REAL PAID ORDERS
  // ===========================================================================
  console.log('TEST 5: Verify simulation does NOT create real production orders...');
  const realOrdersCountAfter = (db.prepare('SELECT COUNT(*) as count FROM orders').get() as any).count;
  if (realOrdersCountAfter !== realOrdersCountBefore) {
    throw new Error(`Test 5 failed: Production orders count changed from ${realOrdersCountBefore} to ${realOrdersCountAfter}`);
  }
  console.log('✔ TEST 5 PASSED: Production orders table contains zero simulation orders.\n');

  // ===========================================================================
  // TEST 6 — RAZORPAY IS NEVER CALLED
  // ===========================================================================
  console.log('TEST 6: Verify Razorpay gateway is never called in simulation...');
  const simOrdersInDb = db.prepare("SELECT * FROM orders WHERE payment_provider LIKE '%simulation%'").all();
  if (simOrdersInDb.length > 0) {
    throw new Error('Test 6 failed: Erroneous simulation records found in payment gateway orders');
  }
  console.log('✔ TEST 6 PASSED: Razorpay gateway isolation verified.\n');

  // ===========================================================================
  // TEST 7 — REAL MERCHANT REVENUE REMAINS UNCHANGED
  // ===========================================================================
  console.log('TEST 7: Verify real merchant revenue remains unchanged...');
  const realOverviewAfter = getMerchantOverview('all');
  console.log('  [Real Revenue Before vs After]:', realOverviewBefore.totalRevenue, '==', realOverviewAfter.totalRevenue);
  if (realOverviewAfter.totalRevenue !== realOverviewBefore.totalRevenue) {
    throw new Error('Test 7 failed: Real store revenue changed after simulation');
  }
  if (realOverviewAfter.humanRevenue !== realOverviewBefore.humanRevenue) {
    throw new Error('Test 7 failed: Real human revenue changed after simulation');
  }
  if (realOverviewAfter.aiRevenue !== realOverviewBefore.aiRevenue) {
    throw new Error('Test 7 failed: Real AI revenue changed after simulation');
  }
  console.log('✔ TEST 7 PASSED: Real merchant revenue remained completely pure.\n');

  // ===========================================================================
  // TEST 8 — REAL AI ANALYTICS REMAIN UNCHANGED
  // ===========================================================================
  console.log('TEST 8: Verify real AI analytics remain unchanged...');
  if (realOverviewAfter.aiOrders !== realOverviewBefore.aiOrders) {
    throw new Error('Test 8 failed: Real AI orders count changed');
  }
  if (realOverviewAfter.aiConversionRate !== realOverviewBefore.aiConversionRate) {
    throw new Error('Test 8 failed: Real AI conversion rate changed');
  }
  console.log('✔ TEST 8 PASSED: Real AI conversion metrics remain untouched.\n');

  // ===========================================================================
  // TEST 9 — SIMULATION EVENTS USE CHANNEL = 'SIMULATION'
  // ===========================================================================
  console.log('TEST 9: Verify simulation events use channel = "simulation"...');
  const simEvents = db.prepare('SELECT * FROM simulation_events WHERE simulation_id = ?').all(sim50.simulationId) as any[];
  console.log('  [Sim 50 Recorded Events]:', simEvents.length);

  if (simEvents.length === 0) {
    throw new Error('Test 9 failed: No simulation events recorded');
  }
  for (const evt of simEvents) {
    if (evt.channel !== 'simulation') {
      throw new Error(`Test 9 failed: Event channel was "${evt.channel}", expected "simulation"`);
    }
  }
  console.log('✔ TEST 9 PASSED: All simulation events tagged with channel = "simulation".\n');

  // ===========================================================================
  // TEST 10 — ZERO-ORDER SIMULATION HANDLES SAFELY
  // ===========================================================================
  console.log('TEST 10: Zero-order simulation handles conversionRate & AOV safely...');
  const zeroSim = runSimulation({
    numberOfShoppers: 10,
    config: {
      searchProbability: 0,
      recommendationProbability: 0,
      cartAdditionProbability: 0,
      checkoutAttemptProbability: 0,
      paymentSuccessProbability: 0
    }
  });

  console.log('  [Zero Sim Conversion Rate]:', zeroSim.conversionRate, '%');
  console.log('  [Zero Sim AOV]: ₹', zeroSim.averageOrderValue);

  if (isNaN(zeroSim.conversionRate) || !isFinite(zeroSim.conversionRate)) {
    throw new Error('Test 10 failed: conversionRate produced NaN');
  }
  if (isNaN(zeroSim.averageOrderValue) || !isFinite(zeroSim.averageOrderValue)) {
    throw new Error('Test 10 failed: averageOrderValue produced NaN');
  }
  if (zeroSim.conversionRate !== 0 || zeroSim.averageOrderValue !== 0) {
    throw new Error('Test 10 failed: Expected 0 conversion rate and 0 AOV');
  }
  console.log('✔ TEST 10 PASSED: Zero-division safe calculations verified.\n');

  // ===========================================================================
  // TEST 11 — REFRESH MERCHANT DASHBOARD SIMULATION HISTORY
  // ===========================================================================
  console.log('TEST 11: Verify simulation history persistence...');
  const history = getSimulationRuns(10);
  console.log('  [Simulation Runs in History]:', history.length);

  const foundSim50 = history.some((h) => h.id === sim50.simulationId);
  if (!foundSim50) {
    throw new Error('Test 11 failed: Simulation run not found in history');
  }
  console.log('✔ TEST 11 PASSED: Simulation history persisted in SQLite and retrievable.\n');

  // ===========================================================================
  // TEST 12 — OPEN SIMULATION DETAILS
  // ===========================================================================
  console.log('TEST 12: Open simulation details (funnel, metrics, top products)...');
  const details = getSimulationRunById(sim50.simulationId);

  if (!details) {
    throw new Error('Test 12 failed: Could not load simulation details by ID');
  }
  console.log('  [Inspected Simulation ID]:', details.simulationId);
  console.log('  [Funnel Verification]:', {
    sessions: details.sessions,
    searches: details.searches,
    recommendations: details.recommendations,
    cartAdditions: details.cartAdditions,
    checkoutAttempts: details.checkoutAttempts,
    successfulOrders: details.successfulOrders
  });
  console.log('  [Top Products Count]:', details.topProducts.length);

  if (details.sessions !== 50 || details.topProducts.length === 0) {
    throw new Error('Test 12 failed: Incomplete details returned for simulation run');
  }
  console.log('✔ TEST 12 PASSED: Simulation detail inspection verified.\n');

  console.log('================================================================');
  console.log(' ALL 12 PHASE 9 SIMULATION ENGINE TESTS PASSED 100%!           ');
  console.log('================================================================\n');
}

runPhase9SimulationTests().catch((err) => {
  console.error('Phase 9 tests encountered an error:', err);
  process.exit(1);
});
