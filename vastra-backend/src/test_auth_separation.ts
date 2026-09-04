const BASE_URL = 'http://localhost:4000/api';

async function runTests() {
  console.log('====================================================');
  console.log('VASTRA.AI — CUSTOMER & MERCHANT AUTH SEPARATION TESTS');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`[PASS] Scenario ${total}: ${msg}`);
      passed++;
    } else {
      console.error(`[FAIL] Scenario ${total}: ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  const parseJson = async (res: Response): Promise<any> => {
    return (await res.json()) as any;
  };

  // ----------------------------------------------------
  // TEST 1 — DIRECT MERCHANT LOGIN (Endpoint Reachable Without Customer Auth)
  // ----------------------------------------------------
  console.log('--- TEST 1: Direct Merchant Login Accessibility ---');
  const res1 = await fetch(`${BASE_URL}/merchant/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'invalid@vastra.ai', password: 'wrong' })
  });
  const data1 = await parseJson(res1);

  assert(
    res1.status === 401 && data1.error === 'INVALID_CREDENTIALS',
    'Merchant login endpoint is directly accessible without customer session (rejected on invalid credentials)'
  );

  // ----------------------------------------------------
  // TEST 2 — CUSTOMER LOGIN (Independent Customer Auth)
  // ----------------------------------------------------
  console.log('\n--- TEST 2: Customer Login Flow ---');
  const res2 = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'customer@vastra.ai', password: 'VastraCustomer2026!' })
  });
  const data2 = await parseJson(res2);
  const customerToken = data2.token;
  const customerProfile = data2.customer;

  assert(
    res2.status === 200 && Boolean(customerToken) && customerProfile?.role === 'customer',
    `Customer logs in normally with role 'customer' (${customerProfile?.email})`
  );

  // Customer accesses customer-only endpoint
  const res2b = await fetch(`${BASE_URL}/customer/addresses`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const data2b = await parseJson(res2b);

  assert(
    res2b.status === 200 && data2b.success === true,
    'Customer token successfully authorizes customer-only endpoints (/customer/addresses)'
  );

  // ----------------------------------------------------
  // TEST 3 & TEST 6 — CUSTOMER SESSION CANNOT ACCESS MERCHANT DASHBOARD / APIS
  // ----------------------------------------------------
  console.log('\n--- TEST 3 & 6: Customer Token Rejected on Merchant Endpoints ---');
  const res3a = await fetch(`${BASE_URL}/merchant/overview`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const data3a = await parseJson(res3a);

  assert(
    res3a.status === 403 && data3a.error === 'FORBIDDEN',
    `Customer token on /api/merchant/overview is rejected with 403 FORBIDDEN: "${data3a.message}"`
  );

  const res3b = await fetch(`${BASE_URL}/merchant/me`, {
    headers: { Authorization: `Bearer ${customerToken}` }
  });
  const data3b = await parseJson(res3b);

  assert(
    res3b.status === 403 && data3b.error === 'FORBIDDEN',
    'Customer token on /api/merchant/me is strictly rejected with 403 FORBIDDEN'
  );

  // ----------------------------------------------------
  // TEST 4 — MERCHANT LOGIN (Directly Without Customer Session)
  // ----------------------------------------------------
  console.log('\n--- TEST 4: Direct Merchant Authentication ---');
  const res4 = await fetch(`${BASE_URL}/merchant/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'merchant@vastra.ai', password: 'VastraMerchant2026!' })
  });
  const data4 = await parseJson(res4);
  const merchantToken = data4.token;
  const merchantProfile = data4.merchant;

  assert(
    res4.status === 200 && Boolean(merchantToken) && merchantProfile?.role === 'merchant',
    `Merchant authenticates directly with merchant credentials (role: '${merchantProfile?.role}')`
  );

  // ----------------------------------------------------
  // TEST 5 — MERCHANT SESSION PERSISTENCE & VERIFICATION
  // ----------------------------------------------------
  console.log('\n--- TEST 5: Merchant Session Persistence & Verification ---');
  const res5 = await fetch(`${BASE_URL}/merchant/me`, {
    headers: { Authorization: `Bearer ${merchantToken}` }
  });
  const data5 = await parseJson(res5);

  assert(
    res5.status === 200 && data5.success === true && data5.merchant?.role === 'merchant',
    `Merchant session verified via /api/merchant/me (id: ${data5.merchant?.id}, role: ${data5.merchant?.role})`
  );

  // ----------------------------------------------------
  // TEST 7 — MERCHANT APIS AUTHORIZATION
  // ----------------------------------------------------
  console.log('\n--- TEST 7: Merchant API Authorization Comparison ---');
  // 7A: Merchant token on merchant overview
  const res7a = await fetch(`${BASE_URL}/merchant/overview`, {
    headers: { Authorization: `Bearer ${merchantToken}` }
  });
  const data7a = await parseJson(res7a);

  assert(
    res7a.status === 200 && data7a.totalRevenue !== undefined,
    'Merchant token successfully authorizes /api/merchant/overview (200 OK with analytics data)'
  );

  // 7B: Merchant token on merchant orders
  const res7b = await fetch(`${BASE_URL}/merchant/orders`, {
    headers: { Authorization: `Bearer ${merchantToken}` }
  });
  const data7b = await parseJson(res7b);

  assert(
    res7b.status === 200 && Array.isArray(data7b.orders),
    `Merchant token successfully retrieves merchant orders (count: ${data7b.count})`
  );

  // 7C: Mutual separation - Merchant token CANNOT access customer-only endpoints
  const res7c = await fetch(`${BASE_URL}/customer/addresses`, {
    headers: { Authorization: `Bearer ${merchantToken}` }
  });
  const data7c = await parseJson(res7c);

  assert(
    res7c.status === 401 && data7c.error === 'UNAUTHORIZED',
    'Merchant token cannot impersonate customer or access customer addresses (rejected with 401 UNAUTHORIZED)'
  );

  console.log('\n====================================================');
  console.log(`ALL ${passed}/${total} AUTHENTICATION SEPARATION TESTS PASSED!`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('Test run error:', err);
  process.exit(1);
});
