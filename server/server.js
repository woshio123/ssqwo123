/**
 * 小铁船海鲜甄选商城 - 后端服务
 * Node.js + Express + SQLite
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const Database = require('better-sqlite3');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));

// 数据库配置
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, 'mall.db');
const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

// 初始化数据库表
function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      price REAL NOT NULL DEFAULT 0,
      unit TEXT DEFAULT '份',
      specs TEXT DEFAULT '[]',
      image TEXT DEFAULT '',
      images TEXT DEFAULT '[]',
      category TEXT DEFAULT '海鲜',
      description TEXT DEFAULT '',
      stock INTEGER DEFAULT 999,
      sales INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      is_featured INTEGER DEFAULT 0,
      tag TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      orderId TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      receiverName TEXT DEFAULT '',
      receiverAddress TEXT DEFAULT '',
      logisticsNo TEXT DEFAULT '',
      logisticsCompany TEXT DEFAULT '',
      items TEXT DEFAULT '[]',
      totalAmount REAL DEFAULT 0,
      status TEXT DEFAULT 'pending',
      paidAt TEXT DEFAULT '',
      shippedAt TEXT DEFAULT '',
      remark TEXT DEFAULT '',
      createdAt TEXT DEFAULT (datetime('now')),
      updatedAt TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      sort INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT (datetime('now'))
    );
  `);

  // 初始化默认设置
  const defaultSettings = [
    ['shop_name', '小铁船海鲜甄选商城'],
    ['shop_logo', ''],
    ['contact_phone', ''],
    ['contact_wechat', ''],
    ['contact_qr', ''],
    ['announcement', ''],
    ['address', ''],
    ['business_hours', ''],
    ['admin_username', 'admin'],
    ['admin_password', 'admin123'],
    ['alipay_qr', ''],
    ['wechat_qr', '']
  ];

  const insertSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  defaultSettings.forEach(([key, value]) => insertSetting.run(key, value));

  // 初始化默认分类
  const insertCategory = db.prepare('INSERT OR IGNORE INTO categories (id, name, sort) VALUES (?, ?, ?)');
  const defaultCategories = [
    [1, '活鲜', 1],
    [2, '冰鲜', 2],
    [3, '冻品', 3],
    [4, '干货', 4]
  ];
  defaultCategories.forEach(([id, name, sort]) => insertCategory.run(id, name, sort));

  console.log('✅ 数据库初始化完成');
}

initDatabase();

// ==================== 辅助函数 ====================

function getSettings(key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : '';
}

function genOrderId() {
  const now = new Date();
  const date = now.getFullYear() + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0');
  const time = String(now.getTime()).slice(-10);
  const random = String(Math.floor(Math.random() * 900) + 100);
  return `ORD${date}${time}${random}`;
}

// ==================== 管理员认证 ====================

const requireAdmin = (req, res, next) => {
  // 检查 Cookie
  const cookieToken = (req.headers.cookie || '').match(/admin_token=([^;]+)/);
  if (cookieToken && cookieToken[1] === 'authorized') return next();

  // 检查 Authorization Header
  const authHdr = req.headers.authorization || '';
  if (authHdr.startsWith('Bearer ') && authHdr.substring(7) === 'authorized') return next();

  // 检查 Basic Auth
  if (authHdr.startsWith('Basic ')) {
    const credentials = Buffer.from(authHdr.replace('Basic ', ''), 'base64').toString();
    const [username, password] = credentials.split(':');
    const dbUser = getSettings('admin_username') || 'admin';
    const dbPass = getSettings('admin_password') || 'admin123';
    if (username === dbUser && password === dbPass) {
      res.setHeader('Set-Cookie', 'admin_token=authorized; Path=/');
      return next();
    }
  }

  res.status(401).json({ error: '未授权，请先登录' });
};

// ==================== 公开 API ====================

// 获取商店信息
app.get('/api/shop/info', (req, res) => {
  res.json({
    name: getSettings('shop_name') || '小铁船海鲜甄选商城',
    logo: getSettings('shop_logo'),
    phone: getSettings('contact_phone'),
    wechat: getSettings('contact_wechat'),
    qr: getSettings('contact_qr'),
    announcement: getSettings('announcement'),
    address: getSettings('address'),
    hours: getSettings('business_hours')
  });
});

// 获取分类列表
app.get('/api/categories', (req, res) => {
  const categories = db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort').all();
  res.json(categories);
});

// 获取商品列表
app.get('/api/products', (req, res) => {
  try {
    const { category, keyword, active } = req.query;
    let sql = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category) {
      sql += ' AND category = ?';
      params.push(category);
    }

    if (keyword) {
      sql += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    if (active !== undefined) {
      sql += ' AND active = ?';
      params.push(active);
    } else {
      sql += ' AND active = 1';
    }

    sql += ' ORDER BY is_featured DESC, sales DESC, id DESC';

    const products = db.prepare(sql).all(...params);
    products.forEach(p => {
      try { p.specs = JSON.parse(p.specs); } catch(e) { p.specs = []; }
      try { p.images = JSON.parse(p.images); } catch(e) { p.images = []; }
    });
    res.json(products);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 获取单个商品
app.get('/api/products/:id', (req, res) => {
  try {
    const product = db.prepare('SELECT * FROM products WHERE id = ?').get(req.params.id);
    if (!product) return res.status(404).json({ error: '商品不存在' });
    try { product.specs = JSON.parse(product.specs); } catch(e) { product.specs = []; }
    try { product.images = JSON.parse(product.images); } catch(e) { product.images = []; }
    res.json(product);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 创建订单
app.post('/api/orders', (req, res) => {
  try {
    const { phone, receiverName, receiverAddress, items, totalAmount, remark } = req.body;

    if (!phone || !items || items.length === 0) {
      return res.status(400).json({ error: '缺少必要参数' });
    }

    // 检查并扣减库存
    for (const item of items) {
      const product = db.prepare('SELECT id, name, stock FROM products WHERE id = ?').get(item.productId);
      if (!product) {
        return res.status(400).json({ error: `商品"${item.name}"不存在` });
      }
      if (product.stock < item.quantity) {
        return res.status(400).json({ error: `商品"${product.name}"库存不足，当前库存: ${product.stock}` });
      }
    }

    // 扣减库存
    for (const item of items) {
      db.prepare('UPDATE products SET stock = stock - ? WHERE id = ?').run(item.quantity, item.productId);
    }

    const orderId = genOrderId();
    const stmt = db.prepare(`
      INSERT INTO orders (orderId, phone, receiverName, receiverAddress, items, totalAmount, remark, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `);
    stmt.run(orderId, phone, receiverName || '', receiverAddress || '', JSON.stringify(items), totalAmount || 0, remark || '');

    res.json({ success: true, orderId, message: '订单创建成功' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 查询订单
app.get('/api/orders/:orderId', (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE orderId = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    try { order.items = JSON.parse(order.items); } catch(e) { order.items = []; }
    res.json(order);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 根据手机号查询订单列表
app.get('/api/orders', (req, res) => {
  try {
    const { phone } = req.query;
    if (!phone) {
      return res.status(400).json({ error: '请提供手机号' });
    }
    
    const orders = db.prepare('SELECT * FROM orders WHERE phone = ? ORDER BY createdAt DESC').all(phone);
    orders.forEach(order => {
      try { order.items = JSON.parse(order.items); } catch(e) { order.items = []; }
    });
    res.json({ orders });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 买家删除订单（仅允许删除未付款的订单）
app.delete('/api/orders/:orderId', (req, res) => {
  try {
    const { phone } = req.body;
    if (!phone) {
      return res.status(400).json({ error: '请提供手机号' });
    }

    // 先查询订单
    const order = db.prepare('SELECT * FROM orders WHERE orderId = ?').get(req.params.orderId);
    if (!order) {
      return res.status(404).json({ error: '订单不存在' });
    }

    // 验证手机号匹配
    if (order.phone !== phone) {
      return res.status(403).json({ error: '无权删除此订单' });
    }

    // 删除订单时恢复库存
    try {
      const orderItems = JSON.parse(order.items || '[]');
      for (const item of orderItems) {
        if (item.productId) {
          db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.productId);
        }
      }
    } catch(e) {
      console.error('恢复库存失败:', e);
    }

    db.prepare('DELETE FROM orders WHERE orderId = ?').run(req.params.orderId);
    res.json({ success: true, message: '订单已删除' });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 支付二维码
app.get('/api/payment/qr', (req, res) => {
  res.json({
    alipay: getSettings('alipay_qr'),
    wechat: getSettings('wechat_qr')
  });
});

// ==================== 管理后台 API ====================

// 后台登录
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const dbUser = getSettings('admin_username') || 'admin';
  const dbPass = getSettings('admin_password') || 'admin123';

  if (username === dbUser && password === dbPass) {
    res.json({ success: true, token: 'authorized' });
  } else {
    res.status(401).json({ success: false, error: '用户名或密码错误' });
  }
});

// 修改密码
app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { oldPass, newPass } = req.body;
  const dbPass = getSettings('admin_password') || 'admin123';

  if (oldPass !== dbPass) {
    return res.status(400).json({ error: '原密码错误' });
  }

  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('admin_password', newPass);
  res.json({ success: true });
});

// 仪表盘统计
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
    const pendingOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'pending'").get().count;
    const paidOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'paid'").get().count;
    const shippedOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'shipped'").get().count;
    const completedOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'completed'").get().count;
    const cancelledOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'cancelled'").get().count;
    const toShipOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE status = 'paid'").get().count;
    
    const revenue = db.prepare("SELECT COALESCE(SUM(totalAmount), 0) as sum FROM orders WHERE status IN ('paid', 'shipped', 'completed')").get().sum;
    const todayOrders = db.prepare("SELECT COUNT(*) as count FROM orders WHERE date(createdAt) = date('now')").get().count;
    const todayRevenue = db.prepare("SELECT COALESCE(SUM(totalAmount), 0) as sum FROM orders WHERE status IN ('paid', 'shipped', 'completed') AND date(createdAt) = date('now')").get().sum;

    const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
    const activeProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE active = 1').get().count;

    res.json({
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        paid: paidOrders,
        toShip: toShipOrders,
        shipped: shippedOrders,
        completed: completedOrders,
        cancelled: cancelledOrders
      },
      revenue: {
        total: revenue,
        today: todayRevenue
      },
      products: {
        total: totalProducts,
        active: activeProducts
      }
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 商品管理 ====================

// 商品列表
app.get('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const products = db.prepare('SELECT * FROM products ORDER BY id DESC').all();
    products.forEach(p => {
      try { p.specs = JSON.parse(p.specs); } catch(e) { p.specs = []; }
      try { p.images = JSON.parse(p.images); } catch(e) { p.images = []; }
    });
    res.json(products);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 添加商品
app.post('/api/admin/products', requireAdmin, (req, res) => {
  try {
    const { name, price, unit, specs, image, images, category, description, stock, is_featured, tag, active } = req.body;

    if (!name) return res.status(400).json({ error: '商品名称不能为空' });

    const stmt = db.prepare(`
      INSERT INTO products (name, price, unit, specs, image, images, category, description, stock, is_featured, tag, active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const result = stmt.run(
      name,
      price || 0,
      unit || '份',
      JSON.stringify(specs || []),
      image || '',
      JSON.stringify(images || []),
      category || '海鲜',
      description || '',
      stock || 999,
      is_featured ? 1 : 0,
      tag || '',
      active !== false ? 1 : 0
    );

    res.json({ success: true, id: result.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 更新商品
app.put('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    const { name, price, unit, specs, image, images, category, description, stock, is_featured, tag, active } = req.body;

    const stmt = db.prepare(`
      UPDATE products SET 
        name = COALESCE(?, name),
        price = COALESCE(?, price),
        unit = COALESCE(?, unit),
        specs = COALESCE(?, specs),
        image = COALESCE(?, image),
        images = COALESCE(?, images),
        category = COALESCE(?, category),
        description = COALESCE(?, description),
        stock = COALESCE(?, stock),
        is_featured = COALESCE(?, is_featured),
        tag = COALESCE(?, tag),
        active = COALESCE(?, active),
        updatedAt = datetime('now')
      WHERE id = ?
    `);
    stmt.run(
      name,
      price,
      unit,
      specs ? JSON.stringify(specs) : null,
      image,
      images ? JSON.stringify(images) : null,
      category,
      description,
      stock,
      is_featured !== undefined ? (is_featured ? 1 : 0) : null,
      tag,
      active !== undefined ? (active ? 1 : 0) : null,
      req.params.id
    );

    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 删除商品
app.delete('/api/admin/products/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM products WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 设置精选
app.put('/api/admin/products/:id/featured', requireAdmin, (req, res) => {
  try {
    const { is_featured } = req.body;
    const newTag = is_featured ? '精选' : '';
    db.prepare('UPDATE products SET is_featured = ?, tag = ?, updatedAt = datetime(\'now\') WHERE id = ?')
      .run(is_featured ? 1 : 0, newTag, req.params.id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 订单管理 ====================

// 订单列表
app.get('/api/admin/orders', requireAdmin, (req, res) => {
  try {
    const { status, keyword, page, limit } = req.query;
    let sql = 'SELECT * FROM orders WHERE 1=1';
    const params = [];

    if (status && status !== 'all') {
      sql += ' AND status = ?';
      params.push(status);
    }

    if (keyword) {
      sql += ' AND (orderId LIKE ? OR phone LIKE ? OR receiverName LIKE ?)';
      params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`);
    }

    sql += ' ORDER BY createdAt DESC';

    const pageNum = parseInt(page) || 1;
    const pageSize = parseInt(limit) || 50;
    const offset = (pageNum - 1) * pageSize;

    const countSql = sql.replace('SELECT *', 'SELECT COUNT(*) as count');
    const total = db.prepare(countSql).get(...params).count;

    sql += ` LIMIT ${pageSize} OFFSET ${offset}`;
    const orders = db.prepare(sql).all(...params);

    orders.forEach(o => {
      try { o.items = JSON.parse(o.items); } catch(e) { o.items = []; }
    });

    res.json({
      orders,
      total,
      page: pageNum,
      limit: pageSize,
      pages: Math.ceil(total / pageSize)
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 订单详情
app.get('/api/admin/orders/:orderId', requireAdmin, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE orderId = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: '订单不存在' });
    try { order.items = JSON.parse(order.items); } catch(e) { order.items = []; }
    res.json(order);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 确认付款
app.post('/api/admin/orders/:orderId/confirm-pay', requireAdmin, (req, res) => {
  try {
    const order = db.prepare('SELECT * FROM orders WHERE orderId = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: '订单不存在' });

    db.prepare("UPDATE orders SET status = 'paid', paidAt = datetime('now'), updatedAt = datetime('now') WHERE orderId = ?")
      .run(req.params.orderId);

    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 发货
app.post('/api/admin/orders/:orderId/ship', requireAdmin, (req, res) => {
  try {
    const { logisticsNo, logisticsCompany, trackingPhone } = req.body;
    const order = db.prepare('SELECT * FROM orders WHERE orderId = ?').get(req.params.orderId);
    if (!order) return res.status(404).json({ error: '订单不存在' });

    db.prepare("UPDATE orders SET status = 'shipped', logisticsNo = ?, logisticsCompany = ?, trackingPhone = ?, shippedAt = datetime('now'), updatedAt = datetime('now') WHERE orderId = ?")
      .run(logisticsNo || '', logisticsCompany || '', trackingPhone || '', req.params.orderId);

    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 完成订单
app.post('/api/admin/orders/:orderId/complete', requireAdmin, (req, res) => {
  try {
    db.prepare("UPDATE orders SET status = 'completed', updatedAt = datetime('now') WHERE orderId = ?")
      .run(req.params.orderId);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 取消订单
app.post('/api/admin/orders/:orderId/cancel', requireAdmin, (req, res) => {
  try {
    // 取消订单时恢复库存
    const order = db.prepare('SELECT * FROM orders WHERE orderId = ?').get(req.params.orderId);
    if (order && order.status !== 'cancelled') {
      try {
        const orderItems = JSON.parse(order.items || '[]');
        for (const item of orderItems) {
          if (item.productId) {
            db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.productId);
          }
        }
      } catch(e) {
        console.error('恢复库存失败:', e);
      }
    }
    db.prepare("UPDATE orders SET status = 'cancelled', updatedAt = datetime('now') WHERE orderId = ?")
      .run(req.params.orderId);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 删除订单
app.delete('/api/admin/orders/:orderId', requireAdmin, (req, res) => {
  try {
    // 先查询订单以恢复库存
    const order = db.prepare('SELECT * FROM orders WHERE orderId = ?').get(req.params.orderId);
    if (order) {
      try {
        const orderItems = JSON.parse(order.items || '[]');
        for (const item of orderItems) {
          if (item.productId) {
            db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').run(item.quantity, item.productId);
          }
        }
      } catch(e) {
        console.error('恢复库存失败:', e);
      }
    }
    db.prepare('DELETE FROM orders WHERE orderId = ?').run(req.params.orderId);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 设置管理 ====================

// 获取所有设置
app.get('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings').all();
    const result = {};
    settings.forEach(s => result[s.key] = s.value);
    res.json(result);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 更新设置
app.put('/api/admin/settings', requireAdmin, (req, res) => {
  try {
    const updates = req.body;
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
    
    Object.entries(updates).forEach(([key, value]) => {
      stmt.run(key, value || '');
    });

    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 物流查询API（模拟数据，实际可对接快递100等接口）
// ==================== 快递100配置 ====================
const KUAIDI100_CUSTOMER = process.env.KUAIDI100_CUSTOMER || 'C91AE7DEC6A7A2BD379F5039D6B6E0ED';  // 授权码
const KUAIDI100_KEY = process.env.KUAIDI100_KEY || 'oLKhzaJX8859';            // API Key

// 快递公司名称 → 快递100编码映射
const COURIER_CODE_MAP = {
  '顺丰': 'shunfeng', '顺丰速运': 'shunfeng', '顺丰快递': 'shunfeng',
  '圆通': 'yuantong', '圆通速递': 'yuantong', '圆通快递': 'yuantong',
  '中通': 'zhongtong', '中通快递': 'zhongtong',
  '申通': 'shentong', '申通快递': 'shentong',
  '韵达': 'yunda', '韵达快递': 'yunda',
  '极兔': 'jtexpress', '极兔速递': 'jtexpress',
  'ems': 'ems', 'EMS': 'ems', '邮政EMS': 'ems',
  '邮政': 'youzhengguonei', '中国邮政': 'youzhengguonei',
  '京东': 'jd', '京东快递': 'jd', '京东物流': 'jd',
  '德邦': 'debangwuliu', '德邦快递': 'debangwuliu', '德邦物流': 'debangwuliu',
  '百世': 'huitongkuaidi', '百世快递': 'huitongkuaidi',
  '天天': 'tiantian', '天天快递': 'tiantian',
  '宅急送': 'zhaijisong',
  '跨越': 'kuayue', '跨越速运': 'kuayue',
  '丰巢': 'fengchao',
};

// 获取快递100编码
function getKuaidi100Code(companyName) {
  if (!companyName) return '';
  // 先精确匹配
  if (COURIER_CODE_MAP[companyName]) return COURIER_CODE_MAP[companyName];
  // 模糊匹配
  const lower = companyName.toLowerCase();
  for (const [name, code] of Object.entries(COURIER_CODE_MAP)) {
    if (lower.includes(name.toLowerCase()) || name.toLowerCase().includes(lower)) {
      return code;
    }
  }
  // 如果本身就是编码格式（全小写英文），直接返回
  if (/^[a-z]+$/.test(companyName)) return companyName;
  return '';
}

// 物流查询API - 优先使用快递100真实接口，失败降级为模拟数据
app.get('/api/tracking', async (req, res) => {
  try {
    const { company, no, orderId } = req.query;
    if (!company || !no) {
      return res.status(400).json({ error: '缺少快递公司或运单号' });
    }
    
    // 默认使用寄件人（商家）手机号后4位
    // 手机号优先级：寄件人后4位1103 → 收件人手机后4位 → 默认1103
    const senderPhoneLast4 = '1103';
    
    // 尝试从订单获取收货地址和收件人手机
    let receiverAddress = '';
    let receiverPhone = '';
    if (orderId) {
      const order = db.prepare('SELECT receiverAddress, phone FROM orders WHERE orderId = ?').get(orderId);
      if (order) {
        receiverAddress = order.receiverAddress || '';
        receiverPhone = order.phone || '';
      }
    }
    
    // 优先用寄件人手机后4位，读取不到则用收件人手机后4位
    let finalPhone = senderPhoneLast4;
    if (!finalPhone || finalPhone.length < 4) {
      if (receiverPhone && receiverPhone.length >= 4) {
        finalPhone = receiverPhone.slice(-4);
      } else {
        finalPhone = '1103';
      }
    }
    
    // 如果配置了快递100，优先使用真实接口
    if (KUAIDI100_CUSTOMER && KUAIDI100_KEY) {
      try {
        const realData = await queryKuaidi100(company, no, receiverAddress, finalPhone);
        if (realData) {
          return res.json({
            success: true,
            company,
            no,
            tracks: realData.tracks,
            courierInfo: realData.courierInfo || null,
            state: realData.state,
            source: 'kuaidi100'
          });
        }
      } catch (e) {
        console.log('快递100查询失败，降级为模拟数据:', e.message);
      }
    }
    
    // 降级：使用模拟物流轨迹数据
    const mockTracks = generateMockTracking(company, no, receiverAddress);
    res.json({
      success: true,
      company,
      no,
      tracks: mockTracks,
      source: (KUAIDI100_CUSTOMER && KUAIDI100_KEY) ? 'mock_configured' : 'mock'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 调用快递100实时查询接口
async function queryKuaidi100(companyName, trackingNo, toAddress, phone) {
  const com = getKuaidi100Code(companyName);
  if (!com) {
    console.log('未找到快递公司编码:', companyName);
    return null;
  }
  
  const crypto = require('crypto');
  
  // 构建param参数
  const param = {
    com: com,
    num: trackingNo,
    resultv2: '4',  // 开通行政区域解析 + 高级状态
    show: '0',
    order: 'desc',
    needCourierInfo: true  // 返回快递员信息
  };
  
  // 顺丰、中通必填手机号
  if (phone && (com === 'shunfeng' || com === 'zhongtong')) {
    param.phone = phone;
  }
  
  // 目的地信息
  if (toAddress) {
    param.to = toAddress;
  }
  
  const paramStr = JSON.stringify(param);
  
  // 生成签名: MD5(param + key + customer)，转32位大写
  const signStr = paramStr + KUAIDI100_KEY + KUAIDI100_CUSTOMER;
  const sign = crypto.createHash('md5').update(signStr, 'utf8').digest('hex').toUpperCase();
  
  // 发起请求
  const https = require('https');
  const url = require('url');
  
  const postData = urlSearchParams({
    customer: KUAIDI100_CUSTOMER,
    sign: sign,
    param: paramStr
  });
  
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'poll.kuaidi100.com',
      path: '/poll/query.do',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    };
    
    const req = https.request(options, (response) => {
      let data = '';
      response.on('data', chunk => data += chunk);
      response.on('end', () => {
        try {
          const result = JSON.parse(data);
          if (result.status === '200' && result.data && result.data.length > 0) {
            // 转换快递100格式为统一格式
            const tracks = result.data.map(item => ({
              time: item.ftime || item.time,
              context: item.context,
              status: item.status || '',
              location: item.location || '',
              areaName: item.areaName || ''
            }));
            
            resolve({
              tracks,
              state: result.state,
              courierInfo: result.courierInfo || null
            });
          } else if (result.status === '200' && (!result.data || result.data.length === 0)) {
            // 快递100返回成功但暂无轨迹
            resolve(null);
          } else {
            reject(new Error(result.message || '快递100查询失败'));
          }
        } catch (e) {
          reject(e);
        }
      });
    });
    
    req.on('error', (e) => reject(e));
    req.setTimeout(10000, () => {
      req.destroy();
      reject(new Error('快递100请求超时'));
    });
    
    req.write(postData);
    req.end();
  });
}

// URL编码辅助函数
function urlSearchParams(params) {
  return Object.entries(params)
    .map(([key, val]) => `${encodeURIComponent(key)}=${encodeURIComponent(val)}`)
    .join('&');
}

// 生成模拟物流数据
function generateMockTracking(company, no, address) {
  const now = new Date();
  
  // 从收货地址中提取省市信息
  let destProvince = '广东';
  let destCity = '深圳';
  let destDistrict = '南山';
  
  if (address) {
    // 匹配省份
    const provinceMatch = address.match(/([\u4e00-\u9fa5]+省|[\u4e00-\u9fa5]+自治区|北京|上海|天津|重庆)/);
    if (provinceMatch) {
      const prov = provinceMatch[1];
      if (prov === '北京' || prov === '上海' || prov === '天津' || prov === '重庆') {
        destProvince = prov + '市';
        destCity = prov + '市';
      } else {
        destProvince = prov;
        // 匹配城市
        const cityMatch = address.match(/([\u4e00-\u9fa5]+市|[\u4e00-\u9fa5]+州|[\u4e00-\u9fa5]+地区)/);
        if (cityMatch) destCity = cityMatch[1].replace(/市$|州$|地区$/, '');
      }
    }
    // 匹配区县
    const districtMatch = address.match(/([\u4e00-\u9fa5]+区|[\u4e00-\u9fa5]+县|[\u4e00-\u9fa5]+旗)/);
    if (districtMatch) destDistrict = districtMatch[1].replace(/区$|县$|旗$/, '');
  }
  
  // 发货地（海鲜一般从沿海城市发出）
  const srcCity = '福州';
  const srcProvince = '福建';
  
  // 模拟快递员信息
  const courierNames = ['张师傅', '李师傅', '王师傅', '刘师傅', '陈师傅', '黄师傅', '赵师傅'];
  const courierName = courierNames[Math.floor(Math.random() * courierNames.length)];
  const courierPhone = '1' + (3 + Math.floor(Math.random() * 7)) + '0' + Math.floor(Math.random() * 100000000).toString().padStart(8, '0');

  const tracks = [
    {
      time: formatDateTime(now),
      context: `【签收】您的快件已由本人签收，感谢您使用${company}，期待再次为您服务`
    },
    {
      time: formatDateTime(new Date(now - 1.5 * 60 * 60 * 1000)),
      context: `【派送中】${company}快递员${courierName}（电话：${courierPhone.substring(0,3)}****${courierPhone.substring(7)}）正在为您派送，请保持电话畅通`
    },
    {
      time: formatDateTime(new Date(now - 4 * 60 * 60 * 1000)),
      context: `【到达】快件已到达【${destCity}市${destDistrict}区营业部】`
    },
    {
      time: formatDateTime(new Date(now - 7 * 60 * 60 * 1000)),
      context: `【运输中】快件已从【${destCity}市转运中心】发出，下一站【${destCity}市${destDistrict}区营业部】`
    },
    {
      time: formatDateTime(new Date(now - 11 * 60 * 60 * 1000)),
      context: `【到达】快件已到达【${destCity}市转运中心】`
    },
    {
      time: formatDateTime(new Date(now - 17 * 60 * 60 * 1000)),
      context: `【运输中】快件已从【${destProvince}省转运中心】发出，下一站【${destCity}市转运中心】`
    },
    {
      time: formatDateTime(new Date(now - 23 * 60 * 60 * 1000)),
      context: `【到达】快件已到达【${destProvince}省转运中心】`
    },
    {
      time: formatDateTime(new Date(now - 29 * 60 * 60 * 1000)),
      context: `【运输中】快件已从【${srcCity}市转运中心】发出，下一站【${destProvince}省转运中心】`
    },
    {
      time: formatDateTime(new Date(now - 35 * 60 * 60 * 1000)),
      context: `【到达】快件已到达【${srcCity}市转运中心】`
    },
    {
      time: formatDateTime(new Date(now - 39 * 60 * 60 * 1000)),
      context: `【揽收】${company}快递员已揽收，正发往【${srcCity}市转运中心】`
    }
  ];
  return tracks;
}

function formatDateTime(date) {
  const pad = n => n.toString().padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

// ==================== 分类管理 ====================

// 分类列表
app.get('/api/admin/categories', requireAdmin, (req, res) => {
  try {
    const categories = db.prepare('SELECT * FROM categories ORDER BY sort').all();
    res.json(categories);
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 添加分类
app.post('/api/admin/categories', requireAdmin, (req, res) => {
  try {
    const { name, sort } = req.body;
    const result = db.prepare('INSERT INTO categories (name, sort) VALUES (?, ?)').run(name, sort || 0);
    res.json({ success: true, id: result.lastInsertRowid });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 更新分类
app.put('/api/admin/categories/:id', requireAdmin, (req, res) => {
  try {
    const { name, sort, active } = req.body;
    db.prepare('UPDATE categories SET name = COALESCE(?, name), sort = COALESCE(?, sort), active = COALESCE(?, active) WHERE id = ?')
      .run(name, sort, active, req.params.id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// 删除分类
app.delete('/api/admin/categories/:id', requireAdmin, (req, res) => {
  try {
    db.prepare('DELETE FROM categories WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
});

// ==================== 文件上传 ====================

const multer = require('multer');
const uploadDir = path.join(__dirname, '..', 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.random().toString(36).substr(2, 9) + path.extname(file.originalname);
    cb(null, uniqueName);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('只支持 jpg/png/gif/webp 格式'));
    }
  }
});

app.post('/api/admin/upload', requireAdmin, upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }
  res.json({ 
    success: true, 
    url: '/uploads/' + req.file.filename,
    filename: req.file.filename
  });
});

// 删除上传的文件
app.delete('/api/admin/upload/:filename', requireAdmin, (req, res) => {
  const filePath = path.join(uploadDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '文件不存在' });
  }
});

// ==================== 页面路由 ====================

// 管理后台
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'admin', 'index.html'));
});

// 404 处理
app.use((req, res) => {
  res.status(404).send('404 - 页面不存在');
});

// 错误处理
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: err.message || '服务器错误' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║     🦐 小铁船海鲜甄选商城 - 服务已启动               ║');
  console.log('╠═══════════════════════════════════════════════════════╣');
  console.log(`║  🌐 买家页面:  http://localhost:${PORT}/               ║`);
  console.log(`║  🔧 管理后台:  http://localhost:${PORT}/admin/         ║`);
  console.log(`║  👤 管理账号:  admin / admin123                       ║`);
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
});

module.exports = app;
