const https = require('https');

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: 'ssqwo123-production.up.railway.app',
      path, method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer authorized',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } });
    });
    req.on('error', e => resolve({ error: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

async function main() {
  // 删掉旧的
  const products = await api('GET', '/api/products');
  for (const p of products) {
    await api('DELETE', '/api/admin/products/' + p.id);
  }

  // 按表格原样填写
  const test = {
    name: '斗鲳鱼',
    price: 110,
    unit: '斤',
    category: '活鲜',
    specs: [
      { qty: 1, unit: '斤', sku: '2斤-2.5斤', price: 110 },
      { qty: 1, unit: '斤', sku: '1.5-1.8斤', price: 100 },
      { qty: 1, unit: '斤', sku: '1.2-1.5斤', price: 95 },
    ]
  };
  const r = await api('POST', '/api/admin/products', test);
  console.log(JSON.stringify(r));
}
main();
