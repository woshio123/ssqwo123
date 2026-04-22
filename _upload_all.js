const https = require('https');

const API_HOST = 'ssqwo123-production.up.railway.app';
const AUTH = { 'Content-Type': 'application/json', 'Authorization': 'Bearer authorized' };

function api(method, path, body) {
  return new Promise((resolve) => {
    const data = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: API_HOST, path, method,
      headers: { ...AUTH, ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve(d); } }); });
    req.on('error', e => resolve({ error: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

// 完整商品数据 - 从Excel解析
const rawProducts = [
  // 贝壳类
  { name: '半开扇贝', spec: '10个/400g', unit: '盒', price: 12 },
  { name: '扇贝肉', spec: '约200克/盒', unit: '盒', price: 10 },
  { name: '海蛎肉', spec: '500克', unit: '斤', price: 14 },
  { name: '10-12头鲍', spec: '12头500g', unit: '斤', price: 34 },
  { name: '7-8头鲍', spec: '8头500g', unit: '斤', price: 36 },
  { name: '5-6头鲍', spec: '6头', unit: '斤', price: 38 },
  { name: '鲍鱼肉', spec: '250克约12-15个', unit: '盒', price: 38 },
  { name: '螺片', spec: '约200克/盒', unit: '盒', price: 14 },
  { name: '黄金鲍鱼', spec: '2个一斤', unit: '斤', price: 85 },
  { name: '黄金鲍鱼', spec: '3个一斤', unit: '斤', price: 60 },
  { name: '黄金鲍鱼', spec: '4个一斤', unit: '斤', price: 50 },
  { name: '特大黑金鲍', spec: '1.2-1.5/只', unit: '斤', price: 115 },
  // 螃蟹类
  { name: '帝王蟹', spec: '3-7斤/只', unit: '斤', price: 85 },
  { name: '雪蟹', spec: '2-3.5一只', unit: '斤', price: 35 },
  { name: '松叶蟹', spec: '2-2.5斤/只', unit: '斤', price: 35 },
  { name: '肉蟹', spec: '3只/斤', unit: '斤', price: 27 },
  { name: '面包蟹脚', spec: '约10只/斤', unit: '斤', price: 14 },
  // 虾类
  { name: '斑节虾', spec: '3-4头 约350克/盒', unit: '盒', price: 65 },
  { name: '斑节虾', spec: '5-6头 约350克/盒', unit: '盒', price: 62 },
  { name: '斑节虾', spec: '4-5头 半斤装/盒', unit: '盒', price: 40 },
  { name: '单冻大斑节虾', spec: '3两左右/条', unit: '斤', price: 85 },
  { name: '黑虎虾', spec: '4-5头 250克', unit: '盒', price: 23 },
  { name: '黑虎虾', spec: '8-10头 250克', unit: '盒', price: 19 },
  { name: '黑虎虾', spec: '6-7头 250克', unit: '盒', price: 20 },
  { name: '樱花虾', spec: '250克', unit: '盒', price: 18 },
  { name: '沙卢虾', spec: '250克', unit: '盒', price: 18 },
  { name: '小海虾', spec: '250克', unit: '盒', price: 6 },
  { name: '去头斑节虾', spec: '250克5-8只', unit: '盒', price: 26 },
  { name: '虾仁', spec: '约200克/盒', unit: '盒', price: 16 },
  { name: '花龙', spec: '1.8-2.3斤/只', unit: '斤', price: 125 },
  { name: '特大红爪虾', spec: '0.8-1斤/只', unit: '斤', price: 120 },
  { name: '小青龙', spec: '400-500克/只', unit: '斤', price: 88 },
  // 鱼类
  { name: '小银鱼', spec: '约200克/盒', unit: '盒', price: 12 },
  { name: '午鱼', spec: '500克/只', unit: '斤', price: 40 },
  { name: '龙胆石斑鱼', spec: '500-700克/只', unit: '斤', price: 22 },
  { name: '大黄翅鱼', spec: '0.5-1斤', unit: '斤', price: 35 },
  { name: '马鲛鱼片', spec: '500克', unit: '斤', price: 25 },
  { name: '扁鳕鱼片', spec: '500克2-3片', unit: '斤', price: 35 },
  { name: '法国银鳕鱼', spec: '0.5-0.8斤/片', unit: '斤', price: 180 },
  { name: '小白鲳鱼', spec: '4条400克装', unit: '盒', price: 16 },
  { name: '野生巴浪鱼', spec: '约5条/斤', unit: '斤', price: 9 },
  { name: '东星斑', spec: '1.2-2斤/条', unit: '斤', price: 75 },
  { name: '大东星斑', spec: '2-3斤/条', unit: '斤', price: 70 },
  { name: '去肚海杂鱼', spec: '400/装5-6条', unit: '盒', price: 14 },
  { name: '金鲳鱼', spec: '500-600克/条', unit: '斤', price: 18 },
  { name: '养殖巴浪鱼', spec: '2-3只/斤', unit: '斤', price: 65 },
  { name: '龙利鱼', spec: '2-2.5斤/只', unit: '斤', price: 30 },
  { name: '扒皮鱼', spec: '2-2.3斤', unit: '斤', price: 28 },
  { name: '大带鱼', spec: '1-1.8斤', unit: '盒', price: 25 },
  { name: '大带鱼段', spec: '500克装', unit: '盒', price: 23 },
  { name: '斗鲳鱼', spec: '2斤-2.5斤', unit: '斤', price: 110 },
  { name: '斗鲳鱼', spec: '1.5-1.8斤', unit: '斤', price: 100 },
  { name: '斗鲳鱼', spec: '1.2-1.5斤', unit: '斤', price: 95 },
  { name: '中斗鲳', spec: '1-1.2斤/条', unit: '斤', price: 85 },
  { name: '海鲈鱼', spec: '2斤左右', unit: '斤', price: 28 },
  { name: '黄花鱼', spec: '0.8-1斤/条', unit: '斤', price: 32 },
  { name: '野化深海大黄花鱼', spec: '2.4-2.6/条', unit: '斤', price: 40 },
  { name: '小黄花鱼', spec: '3条装400克', unit: '盒', price: 28 },
  { name: '船冻大鱿鱼', spec: '1.2-2斤/只', unit: '斤', price: 45 },
  { name: '手钓中鱿鱼', spec: '0.6-0.8斤/只', unit: '斤', price: 42 },
  { name: '八爪鱼', spec: '400克装', unit: '盒', price: 20 },
  { name: '活冻小管', spec: '400克装10-12个', unit: '盒', price: 35 },
  // 其他
  { name: '海胆膏', spec: '约200克/盒', unit: '盒', price: 20 },
  { name: '海参', spec: '约8-10头/斤', unit: '斤', price: 140 },
  { name: '海带苗', spec: '400克装', unit: '包', price: 6 },
  { name: '虾丸', spec: '250克', unit: '包', price: 14 },
  { name: '墨鱼丸', spec: '250克', unit: '包', price: 12 },
  { name: '鲨鱼丸', spec: '250克', unit: '包', price: 12 },
  { name: '马鲛鱼丸', spec: '250克', unit: '包', price: 12 },
  { name: '海鲜混合丸', spec: '250克', unit: '包', price: 12 },
  { name: '墨鱼肠', spec: '500克装', unit: '包', price: 24 },
  { name: '虾肠', spec: '500克装', unit: '包', price: 26 },
  { name: '沙虫', spec: '约200克/盒', unit: '盒', price: 23 },
  { name: '蒲烧烤鳗鱼', spec: '约400克/只', unit: '只', price: 45 },
  { name: '头水紫菜', spec: '500克', unit: '斤', price: 80 },
  { name: '佛跳墙', spec: '6罐装', unit: '份', price: 155 },
];

// 合并同名商品为多规格
function mergeByname(products) {
  const map = new Map();
  for (const p of products) {
    if (!map.has(p.name)) {
      map.set(p.name, { name: p.name, specs: [], unit: p.unit });
    }
    map.get(p.name).specs.push({ sku: p.spec, price: p.price, qty: 1, unit: p.unit });
  }
  return Array.from(map.values());
}

async function main() {
  console.log('=== Step 1: 删除所有现有商品 ===');
  const existing = await api('GET', '/api/admin/products');
  if (Array.isArray(existing)) {
    let delCount = 0;
    for (const p of existing) {
      await api('DELETE', `/api/admin/products/${p.id}`);
      delCount++;
    }
    console.log(`删除了 ${delCount} 个旧商品`);
  }

  console.log('\n=== Step 2: 合并并上架新商品 ===');
  const merged = mergeByname(rawProducts);
  console.log(`合并后共 ${merged.length} 个商品\n`);

  let successCount = 0;
  for (const product of merged) {
    const firstSpecPrice = product.specs[0].price;
    const body = {
      name: product.name,
      price: firstSpecPrice,
      unit: product.unit,
      stock: 999,
      active: true,
      specs: product.specs,
      image: '',
      category: '海鲜'
    };
    const res = await api('POST', '/api/admin/products', body);
    if (res.success || res.id) {
      successCount++;
      console.log(`✅ ${product.name} (${product.specs.length}规格) → id=${res.id}`);
    } else {
      console.log(`❌ ${product.name}: ${JSON.stringify(res)}`);
    }
  }

  console.log(`\n=== 完成！成功上架 ${successCount}/${merged.length} 个商品 ===`);
}

main().catch(console.error);
