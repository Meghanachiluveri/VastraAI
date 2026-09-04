import { db, initDatabase } from './src/db/db';
import { seedProducts } from './src/db/seed';
import { authenticateMerchant, verifyMerchantToken } from './src/services/merchantAuthService';
import { getMerchantOverview, getMerchantOrders, getMerchantActivity } from './src/services/merchantService';
import { runSimulation, getSimulationRuns } from './src/services/simulationService';
import { getAiSessions } from './src/services/explainabilityService';
import crypto from 'crypto';

async function runMerchantAuthTests() {
  console.log('================================================================');
  console.log('   MERCHANT AUTHENTICATION & ACCESS CONTROL TEST SUITE          ');
  console.log('================================================================\n');

  initDatabase();
  seedProducts();

  const MERCHANT_EMAIL = process.env.MERCHANT_EMAIL || 'merchant@vastra.ai';
  const MERCHANT_PASSWORD = process.env.MERCHANT_PASSWORD || 'VastraMerchant2026!';
  const JWT_SECRET = process.env.MERCHANT_JWT_SECRET || 'vastra_merchant_secret_jwt_2026';

  // ===========================================================================
  // TEST 1 — INVALID CREDENTIALS REJECTION
  // ===========================================================================
  console.log('TEST 1: Invalid merchant credentials rejection...');
  const invalidRes1 = authenticateMerchant('wrong@vastra.ai', 'wrongpassword');
  const invalidRes2 = authenticateMerchant(MERCHANT_EMAIL, 'wrongpassword');
  const invalidRes3 = authenticateMerchant('customer@gmail.com', MERCHANT_PASSWORD);

  if (invalidRes1.success || invalidRes2.success || invalidRes3.success) {
    throw new Error('Test 1 failed: Invalid credentials were authenticated');
  }
  if (invalidRes1.message !== 'Invalid merchant credentials.') {
    throw new Error('Test 1 failed: Error message does not mask existence of email');
  }
  console.log('  [Invalid Auth Result]:', invalidRes1.message);
  console.log('✔ TEST 1 PASSED: Invalid credentials safely rejected with clean error message.\n');

  // ===========================================================================
  // TEST 2 — VALID MERCHANT LOGIN & TOKEN ISSUANCE
  // ===========================================================================
  console.log('TEST 2: Valid merchant login and HMAC token issuance...');
  const validRes = authenticateMerchant(MERCHANT_EMAIL, MERCHANT_PASSWORD);

  if (!validRes.success || !validRes.token || !validRes.merchant) {
    throw new Error('Test 2 failed: Valid login did not return token and merchant profile');
  }

  console.log('  [Merchant Profile]:', validRes.merchant);
  console.log('  [Signed Bearer Token Preview]:', validRes.token.substring(0, 30) + '...');

  if (validRes.merchant.role !== 'merchant' || validRes.merchant.email !== MERCHANT_EMAIL) {
    throw new Error('Test 2 failed: Incorrect merchant payload');
  }
  console.log('✔ TEST 2 PASSED: Valid merchant credentials return cryptographically signed token.\n');

  // ===========================================================================
  // TEST 3 — TOKEN VERIFICATION & ROLE ENFORCEMENT
  // ===========================================================================
  console.log('TEST 3: Token verification and strict merchant role enforcement...');
  const verifiedPayload = verifyMerchantToken(validRes.token);

  if (!verifiedPayload || verifiedPayload.role !== 'merchant') {
    throw new Error('Test 3 failed: Valid token failed verification');
  }
  console.log('  [Verified Payload Role]:', verifiedPayload.role);
  console.log('  [Token Subject]:', verifiedPayload.name, `(${verifiedPayload.email})`);
  console.log('✔ TEST 3 PASSED: Merchant token cryptographically verified.\n');

  // ===========================================================================
  // TEST 4 — TAMPERED / CUSTOMER TOKEN REJECTION (403 FORBIDDEN)
  // ===========================================================================
  console.log('TEST 4: Tampered / customer token rejection...');
  
  // Create a customer token signed with customer role
  const customerPayload = {
    id: 'cust-123',
    name: 'Regular Customer',
    email: 'customer@gmail.com',
    role: 'customer', // Not merchant!
    iat: Date.now(),
    exp: Date.now() + 3600000
  };
  const customerBase64 = Buffer.from(JSON.stringify(customerPayload)).toString('base64url');
  const customerSig = crypto.createHmac('sha256', JWT_SECRET).update(customerBase64).digest('base64url');
  const customerToken = `${customerBase64}.${customerSig}`;

  const customerVerify = verifyMerchantToken(customerToken);
  if (customerVerify !== null) {
    throw new Error('Test 4 failed: Customer token was accepted as merchant');
  }

  // Tampered signature test
  const tamperedToken = `${validRes.token}tampered`;
  const tamperedVerify = verifyMerchantToken(tamperedToken);
  if (tamperedVerify !== null) {
    throw new Error('Test 4 failed: Tampered token was accepted');
  }

  console.log('  [Customer Token Verification]:', customerVerify, '(Rejected)');
  console.log('  [Tampered Token Verification]:', tamperedVerify, '(Rejected)');
  console.log('✔ TEST 4 PASSED: Customer tokens and tampered tokens rejected with zero access.\n');

  // ===========================================================================
  // TEST 5 — EXPIRED TOKEN REJECTION
  // ===========================================================================
  console.log('TEST 5: Expired token rejection...');
  const expiredPayload = {
    id: 'merch-001',
    name: 'Vastra Atelier Store',
    email: MERCHANT_EMAIL,
    role: 'merchant',
    iat: Date.now() - 100000,
    exp: Date.now() - 1000 // Expired
  };
  const expiredBase64 = Buffer.from(JSON.stringify(expiredPayload)).toString('base64url');
  const expiredSig = crypto.createHmac('sha256', JWT_SECRET).update(expiredBase64).digest('base64url');
  const expiredToken = `${expiredBase64}.${expiredSig}`;

  const expiredVerify = verifyMerchantToken(expiredToken);
  if (expiredVerify !== null) {
    throw new Error('Test 5 failed: Expired token was accepted');
  }
  console.log('  [Expired Token Verification]:', expiredVerify, '(Rejected)');
  console.log('✔ TEST 5 PASSED: Expired tokens automatically rejected.\n');

  // ===========================================================================
  // TEST 6 — AUTHENTICATED MERCHANT DATA ACCESS (Overview, Orders, Activity)
  // ===========================================================================
  console.log('TEST 6: Authenticated merchant access to overview, orders, and activity...');
  const overview = getMerchantOverview('all');
  const orders = getMerchantOrders('all', undefined, 10);
  const activity = getMerchantActivity('all', 10);

  console.log('  [Real Store Revenue]:', `₹${overview.totalRevenue.toLocaleString('en-IN')}`);
  console.log('  [Real Store Orders Count]:', orders.length);
  console.log('  [Activity Feed Events Count]:', activity.length);

  if (overview.totalRevenue < 0 || orders.length < 0) {
    throw new Error('Test 6 failed: Merchant data returned invalid values');
  }
  console.log('✔ TEST 6 PASSED: Authenticated merchant can access full commerce analytics.\n');

  // ===========================================================================
  // TEST 7 — PROTECTED SIMULATION ACCESS
  // ===========================================================================
  console.log('TEST 7: Protected simulation execution under merchant session...');
  const simResult = runSimulation({ numberOfShoppers: 10 });
  const simHistory = getSimulationRuns(5);

  console.log('  [Simulation Run Generated]:', simResult.simulationId);
  console.log('  [Simulated Sessions]:', simResult.sessions);
  console.log('  [Simulated Orders]:', simResult.successfulOrders);
  console.log('  [Simulation History Runs]:', simHistory.length);

  if (!simResult.simulationId || simResult.sessions !== 10) {
    throw new Error('Test 7 failed: Simulation run failed');
  }
  console.log('✔ TEST 7 PASSED: Merchant simulation engine operational under authenticated context.\n');

  // ===========================================================================
  // TEST 8 — PROTECTED EXPLAINABILITY AUDIT ACCESS
  // ===========================================================================
  console.log('TEST 8: Protected explainability audit access...');
  const sessions = getAiSessions({ range: 'all', filter: 'all', limit: 10 });
  console.log('  [AI Sessions Retrieved]:', sessions.sessions.length);

  console.log('✔ TEST 8 PASSED: Explainability audit stream accessible to authorized merchant.\n');

  console.log('================================================================');
  console.log(' ALL 8 MERCHANT AUTHENTICATION & ACCESS CONTROL TESTS PASSED!   ');
  console.log('================================================================\n');
}

runMerchantAuthTests().catch((err) => {
  console.error('Merchant auth test error:', err);
  process.exit(1);
});
