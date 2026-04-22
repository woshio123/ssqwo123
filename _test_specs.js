const https = require('https');

const API_HOST = 'ssqwo123-production.up.railway.app';
const AUTH = { 'Authorization': 'Bearer authorized' };

function api(method, path) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: API_HOST, path, method,
      headers: AUTH
    }, res => { 
      let d = ''; 
      res.on('data', c => d += c); 
      res.on('end', () => { 
        try { resolve(JSON.parse(d)); } 
        catch { resolve(d); } 
      }); 
    });
    req.on('error', e => resolve({ error: e.message }));
    req.end();
  });
}

async function main() {
  const products = await api('GET', '/api/admin/products');
  
  // 找斗鲳鱼
  const douchang = products.find(p => p.name === '斗鲳鱼');
  if (douchang) {
    console.log('=== 斗鲳鱼 ===');
    console.log('ID:', douchang.id);
    console.log('Specs raw:', douchang.specs);
    console.log('Specs type:', typeof douchang.specs);
    
    if (typeof douchang.specs === 'string') {
      console.log('Specs is string, parsing...');
      try {
        const parsed = JSON.parse(douchang.specs);
        console.log('Parsed:', JSON.stringify(parsed, null, 2));
      } catch(e) {
        console.log('Parse error:', e.message);
      }
    } else if (Array.isArray(douchang.specs)) {
      console.log('Specs is array:');
      douchang.specs.forEach((s, i) => {
        console.log(`  [${i}]`, JSON.stringify(s));
        console.log(`      name=${s.name}, sku=${s.sku}, spec=${s.spec}`);
      });
    }
  }
}

main().catch(console.error);
