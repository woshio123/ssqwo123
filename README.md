# 小铁船海鲜甄选商城

一个完整的海鲜电商商城系统，包含买家前端和管理后台。

## 功能特性

### 🛒 买家前端 (http://localhost:3000/)
- 商品展示与搜索
- 分类筛选
- 购物车功能
- 在线下单
- 订单管理
- 支付功能（扫码支付）

### ⚙️ 管理后台 (http://localhost:3000/admin/)
- 仪表盘统计
- 订单管理（查看、确认、发货、取消）
- 商品管理（增删改查、上下架、精选）
- 分类管理
- 系统设置（店铺信息、收款码）
- 账号设置（修改密码）

## 快速开始

### 1. 安装依赖
```bash
cd xtc-mall
npm install
```

### 2. 启动服务
```bash
npm start
# 或
node server/server.js
```

### 3. 访问系统
- 买家页面: http://localhost:3000/
- 管理后台: http://localhost:3000/admin/

### 4. 管理后台登录
- 默认账号: `admin`
- 默认密码: `admin123`

## 目录结构

```
xtc-mall/
├── server/
│   ├── server.js      # 后端服务
│   └── data/          # 数据库目录
│       └── mall.db    # SQLite 数据库
├── public/            # 买家前端
│   ├── index.html     # 主页
│   ├── css/
│   │   └── style.css  # 样式
│   ├── js/
│   │   └── app.js     # 前端脚本
│   ├── img/           # 图片
│   └── uploads/       # 上传文件
└── admin/             # 管理后台
    ├── index.html     # 后台页面
    ├── css/
    │   └── admin.css  # 后台样式
    └── js/
        └── admin.js   # 后台脚本
```

## API 接口

### 公开接口
- `GET /api/shop/info` - 获取店铺信息
- `GET /api/categories` - 获取分类列表
- `GET /api/products` - 获取商品列表
- `GET /api/products/:id` - 获取商品详情
- `POST /api/orders` - 创建订单
- `GET /api/orders/:orderId` - 查询订单
- `GET /api/payment/qr` - 获取支付二维码

### 管理后台接口
- `POST /api/admin/login` - 登录
- `GET /api/admin/stats` - 获取统计数据
- `GET /api/admin/products` - 商品列表
- `POST /api/admin/products` - 添加商品
- `PUT /api/admin/products/:id` - 更新商品
- `DELETE /api/admin/products/:id` - 删除商品
- `GET /api/admin/orders` - 订单列表
- `POST /api/admin/orders/:orderId/confirm-pay` - 确认付款
- `POST /api/admin/orders/:orderId/ship` - 发货
- `GET /api/admin/settings` - 获取设置
- `PUT /api/admin/settings` - 保存设置
- `POST /api/admin/upload` - 上传文件

## 技术栈

- **前端**: HTML5, CSS3, JavaScript (原生)
- **后端**: Node.js, Express
- **数据库**: SQLite (better-sqlite3)
- **文件上传**: Multer

## License

ISC
