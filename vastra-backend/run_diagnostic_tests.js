const http = require('http');

function sendMessage(message, sessionId) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ message, sessionId });
    const req = http.request(
      'http://localhost:4000/api/agent/message',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve({ raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function runTests() {
  const sessionId = `diag_session_${Date.now()}`;

  const tests = [
    { num: 1, text: 'Show me a black dress under ₹5000' },
    { num: 2, text: 'Something in blue instead' },
    { num: 3, text: 'Do you have this in size M' },
    { num: 4, text: 'Show me formal shirts for men under ₹2000' },
    { num: 5, text: 'I want something for a wedding, budget 8000' }
  ];

  for (const t of tests) {
    console.log(`\n================================================================`);
    console.log(`RUNNING TEST MESSAGE ${t.num}: "${t.text}"`);
    console.log(`================================================================`);
    const currentSessionId = t.num <= 3 ? sessionId : `diag_session_${t.num}_${Date.now()}`;
    const res = await sendMessage(t.text, currentSessionId);
    console.log(`Response summary:`, {
      messagePreview: res.message,
      productCount: (res.products || []).length,
      products: (res.products || []).map(p => ({ id: p.id, name: p.name, price: p.price, colors: p.colors, sizes: p.sizes }))
    });
  }
}

runTests().catch(console.error);
