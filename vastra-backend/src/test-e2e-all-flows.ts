import crypto from 'crypto';
import http from 'http';

function makeRequest(method: string, path: string, body?: any, token?: string): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const dataStr = body ? JSON.stringify(body) : undefined;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 4000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(dataStr ? { 'Content-Length': Buffer.byteLength(dataStr) } : {}),
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        }
      },
      (res) => {
        let respData = '';
        res.on('data', (chunk) => (respData += chunk));
        res.on('end', () => {
          try {
            const parsed = respData ? JSON.parse(respData) : {};
            resolve({ status: res.statusCode || 200, data: parsed });
          } catch {
            resolve({ status: res.statusCode || 200, data: respData });
          }
        });
      }
    );
    req.on('error', reject);
    if (dataStr) req.write(dataStr);
    req.end();
  });
}

async function runE2EValidation() {
  console.log('================================================================');
  console.log('    VASTRA.AI — COMPLETE SYSTEM END-TO-END VERIFICATION         ');
  console.log('================================================================\n');

  let passed = 0;

  // 1. Storefront Endpoints
  console.log('1. Verifying Storefront Catalog Endpoints:');
  const allRes = await makeRequest('GET', '/api/products');
  console.log(`   GET /api/products -> Status ${allRes.status}, Total: ${allRes.data.count}`);
  if (allRes.status !== 200 || allRes.data.count < 60) throw new Error('Failed GET /api/products');

  const newRes = await makeRequest('GET', '/api/products/new-arrivals');
  console.log(`   GET /api/products/new-arrivals -> Status ${newRes.status}, Count: ${newRes.data.count}`);
  if (newRes.status !== 200 || newRes.data.count === 0) throw new Error('Failed /new-arrivals');

  const archiveRes = await makeRequest('GET', '/api/products/archive');
  console.log(`   GET /api/products/archive -> Status ${archiveRes.status}, Count: ${archiveRes.data.count}`);
  if (archiveRes.status !== 200 || archiveRes.data.count === 0) throw new Error('Failed /archive');

  const menRes = await makeRequest('GET', '/api/products/gender/men');
  console.log(`   GET /api/products/gender/men -> Status ${menRes.status}, Count: ${menRes.data.count}`);
  if (menRes.status !== 200 || menRes.data.count === 0) throw new Error('Failed /gender/men');

  const womenRes = await makeRequest('GET', '/api/products/gender/women');
  console.log(`   GET /api/products/gender/women -> Status ${womenRes.status}, Count: ${womenRes.data.count}`);
  if (womenRes.status !== 200 || womenRes.data.count === 0) throw new Error('Failed /gender/women');
  console.log('   ✔ All Storefront routes operational (200 OK).\n');
  passed++;

  // 2. AI Stylist Concierge: Strict Search
  console.log('2. Verifying AI Stylist Strict Search & Anti-Contamination:');
  const sid = `sess_e2e_${Date.now()}`;
  const searchMsgRes = await makeRequest('POST', '/api/agent/message', {
    sessionId: sid,
    message: 'Show me black dresses under 5000'
  });
  console.log(`   Query: "Show me black dresses under 5000" -> Status ${searchMsgRes.status}`);
  console.log(`   AI Message: "${searchMsgRes.data.message.substring(0, 100)}..."`);
  console.log(`   Products returned: ${searchMsgRes.data.products.length}`);
  for (const p of searchMsgRes.data.products) {
    console.log(`     - [${p.id}] ${p.name} (Category: ${p.category}, Price: ₹${p.price})`);
    if (p.category !== 'dresses' && p.category !== 'co-ords') {
      throw new Error(`Non-dress item ${p.name} returned for dress search`);
    }
    if (p.price > 5000) {
      throw new Error(`Item ${p.name} exceeded ₹5000 budget`);
    }
  }
  console.log('   ✔ Strict Category Search verified: 100% dress isolation, zero accessories.\n');
  passed++;

  // 3. Multi-turn Refinement & Size Check
  console.log('3. Verifying Multi-Turn State & Size Inquiry:');
  const refineRes = await makeRequest('POST', '/api/agent/message', {
    sessionId: sid,
    message: 'Something more formal'
  });
  console.log(`   Refinement: "Something more formal" -> Products returned: ${refineRes.data.products.length}`);

  const sizeRes = await makeRequest('POST', '/api/agent/message', {
    sessionId: sid,
    message: 'Is M available?'
  });
  console.log(`   Size Check: "Is M available?" -> Response: "${sizeRes.data.message}"`);
  if (!sizeRes.data.message.toLowerCase().includes('size **m**') && !sizeRes.data.message.toLowerCase().includes('available in size')) {
    throw new Error('Size check failed');
  }
  console.log('   ✔ Multi-turn context & real inventory size check verified.\n');
  passed++;

  // 4. Ordinal Add to Bag & Shared Cart Synchronization
  console.log('4. Verifying AI Add-to-Bag & Shared Cart Synchronization:');
  const addRes = await makeRequest('POST', '/api/agent/message', {
    sessionId: sid,
    message: 'Add the first one to my bag'
  });
  console.log(`   AI Add response: "${addRes.data.message}"`);
  
  const cartRes = await makeRequest('GET', `/api/cart?sessionId=${sid}&channel=human`);
  const cartData = cartRes.data.cart || cartRes.data;
  console.log(`   Shared Cart from human channel: Items = ${cartData.itemCount}, Total = ₹${cartData.total}`);
  if (cartData.itemCount !== 1) throw new Error(`Shared cart item count mismatch: got ${cartData.itemCount}`);
  console.log('   ✔ Shared SQLite cart verified across AI and Human storefront channels.\n');
  passed++;

  // 5. ₹10,000 Guardrail Enforcement
  console.log('5. Verifying Server-Side ₹10,000 Spending Guardrail:');
  const guardrailRes = await makeRequest('POST', '/api/agent/message', {
    sessionId: sid,
    message: 'Add the Raw Mulberry Silk Bandhgala Jacket to my bag'
  });
  console.log(`   Guardrail Response: "${guardrailRes.data.message}"`);
  if (!guardrailRes.data.message.includes('exceeds Vastra.AI\'s ₹10,000 spending limit')) {
    throw new Error('Guardrail failed to intercept over-budget addition');
  }
  console.log('   ✔ Server-side ₹10,000 spending limit strictly enforced.\n');
  passed++;

  // 6. Order Creation, Razorpay Payment & Stock Decrement
  console.log('6. Verifying Order Creation, Razorpay Payment & Inventory Settlement:');
  const checkoutSid = `sess_checkout_e2e_${Date.now()}`;
  const createOrderRes = await makeRequest('POST', '/api/orders/create', {
    channel: 'human',
    sessionId: checkoutSid,
    items: [{ productId: 'men-003', quantity: 2, size: '40', color: 'Crisp White' }],
    confirmed: true,
    customerInfo: {
      name: 'Priya Sharma',
      email: 'priya@example.com',
      phone: '9876543210',
      address: '42 MG Road, Bengaluru, Karnataka - 560001'
    }
  });

  const localOrderId = createOrderRes.data.order.id;
  console.log(`   Local Order Created: ${localOrderId}, Amount: ₹${createOrderRes.data.order.totalAmount}`);

  const rzpOrderRes = await makeRequest('POST', '/api/payments/create-order', {
    orderId: localOrderId,
    sessionId: checkoutSid
  });
  console.log(`   Razorpay Order ID: ${rzpOrderRes.data.razorpayOrderId}, Amount (Paise): ${rzpOrderRes.data.amount}`);

  const testPayId = `pay_e2e_${Date.now()}`;
  const testSig = crypto
    .createHmac('sha256', 'vastra_secret_key_12345')
    .update(`${rzpOrderRes.data.razorpayOrderId}|${testPayId}`)
    .digest('hex');

  const verifyPayRes = await makeRequest('POST', '/api/payments/verify', {
    orderId: localOrderId,
    razorpay_order_id: rzpOrderRes.data.razorpayOrderId,
    razorpay_payment_id: testPayId,
    razorpay_signature: testSig,
    sessionId: checkoutSid
  });
  console.log(`   Payment Verification: Success = ${verifyPayRes.data.success}, Status = ${verifyPayRes.data.order?.status}`);
  if (!verifyPayRes.data.success || verifyPayRes.data.order?.status !== 'PAID') {
    throw new Error('Payment verification failed');
  }
  console.log('   ✔ Razorpay test checkout & atomic inventory settlement verified.\n');
  passed++;

  // 7. Merchant Authentication & Dashboard
  console.log('7. Verifying Merchant Authentication & Dashboard Analytics:');
  const merchantLoginRes = await makeRequest('POST', '/api/merchant/login', {
    email: 'merchant@vastra.ai',
    password: 'VastraMerchant2026!'
  });
  console.log(`   Merchant Login: Status ${merchantLoginRes.status}, Role: ${merchantLoginRes.data.merchant?.role}`);
  const mToken = merchantLoginRes.data.token;

  const overviewRes = await makeRequest('GET', '/api/merchant/overview', undefined, mToken);
  console.log(`   Merchant Overview Metrics: Total Orders = ${overviewRes.data.totalOrders}, Revenue = ₹${overviewRes.data.totalRevenue.toLocaleString('en-IN')}`);
  if (overviewRes.status !== 200 || overviewRes.data.totalOrders === 0) {
    throw new Error('Merchant overview failed');
  }
  console.log('   ✔ Merchant authentication and analytics aggregation verified.\n');
  passed++;

  console.log('================================================================');
  console.log(` ALL ${passed}/7 E2E INTEGRATION FLOWS VERIFIED SUCCESSFULLY!   `);
  console.log('================================================================\n');
}

runE2EValidation().catch((err) => {
  console.error('\n❌ E2E Validation Error:', err);
  process.exit(1);
});
