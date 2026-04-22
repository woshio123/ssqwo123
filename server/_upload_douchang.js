const path = require('path');
const fs = require('fs');
const db = require('better-sqlite3')(path.join(__dirname, 'data', 'mall.db'));

// 读取base64图片
const base64 = fs.readFileSync(path.join(__dirname, '..', '_fish_base64.txt'), 'utf8').trim();
const images = JSON.stringify([base64]);

// 先删除旧商品（清理）
db.prepare('DELETE FROM products WHERE name = ?').run('斗鲳鱼');
db.prepare('DELETE FROM products WHERE name = ?').run('斑节虾');

// 插入斗鲳鱼（4个规格）
const specs = JSON.stringify([
  {qty: 1, unit: '条', sku: '2斤-2.5斤', price: 110},
  {qty: 1, unit: '条', sku: '1.5-1.8斤', price: 100},
  {qty: 1, unit: '条', sku: '1.2-1.5斤', price: 95},
  {qty: 1, unit: '条', sku: '1-1.2斤', price: 85}
]);

db.prepare(`
  INSERT INTO products (name, category, specs, price, images, description, active)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`).run('斗鲳鱼', '鱼类', specs, 110, images, '新鲜斗鲳鱼，肉质鲜嫩，适合清蒸或红烧', 1);

const p = db.prepare('SELECT id, name, price, specs, images FROM products WHERE name = ?').get('斗鲳鱼');
console.log('上架成功！');
console.log('ID:', p.id);
console.log('名称:', p.name);
console.log('价格:', p.price);
console.log('规格数:', JSON.parse(p.specs).length);
console.log('图片长度:', p.images.length, '字节');
