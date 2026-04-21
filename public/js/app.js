/**
 * 小铁船海鲜甄选商城 - 前端 JS
 */

// API 配置
const API = '';

// 全局状态
let products = [];
let cart = [];
let currentProduct = null;
let currentSpecIndex = 0;
let pendingOrderId = null;
let selectedPayMethod = 'alipay';

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  loadShopInfo();
  loadProducts();
  loadCart();
  bindNav();
  bindSearch();
});

// ==================== 导航功能 ====================

function bindNav() {
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const page = item.dataset.page;
      showPage(page);
    });
  });
}

function showPage(page) {
  // 更新导航状态
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // 显示对应页面
  document.getElementById('pageHome').style.display = page === 'home' ? 'block' : 'none';
  document.getElementById('pageCart').style.display = page === 'cart' ? 'block' : 'none';
  document.getElementById('pageOrders').style.display = page === 'orders' ? 'block' : 'none';

  // 加载页面数据
  if (page === 'cart') loadCart();
  if (page === 'orders') loadOrders();

  // 回到顶部
  window.scrollTo(0, 0);
}

// ==================== 搜索功能 ====================

function bindSearch() {
  const searchInput = document.getElementById('searchInput');
  const searchBtn = document.getElementById('searchBtn');

  searchInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') doSearch();
  });
  searchBtn.addEventListener('click', doSearch);
}

async function doSearch() {
  const keyword = document.getElementById('searchInput').value.trim();
  await loadProducts(keyword);
}

// ==================== 商店信息 ====================

async function loadShopInfo() {
  try {
    const res = await fetch(`${API}/api/shop/info`);
    const info = await res.json();

    document.title = info.name || '小铁船海鲜甄选商城';
    document.getElementById('headerPhone').textContent = info.phone || '';
    document.getElementById('footerPhone').textContent = info.phone || '';
    document.getElementById('footerWechat').textContent = info.wechat || '';
    document.getElementById('footerAddress').textContent = info.address || '';
    document.getElementById('footerHours').textContent = info.hours || '';

    if (info.announcement) {
      document.getElementById('announcement').style.display = 'flex';
      document.getElementById('announcementText').textContent = info.announcement;
    }
  } catch (e) {
    console.error('加载商店信息失败:', e);
  }
}

// ==================== 商品列表 ====================

async function loadProducts(keyword = '') {
  const grid = document.getElementById('productsGrid');
  const loading = document.getElementById('loadingProducts');
  const empty = document.getElementById('emptyProducts');

  grid.innerHTML = '';
  loading.style.display = 'block';
  empty.style.display = 'none';

  try {
    let url = `${API}/api/products`;
    const params = [];
    if (keyword) params.push(`keyword=${encodeURIComponent(keyword)}`);
    if (params.length > 0) url += '?' + params.join('&');

    const res = await fetch(url);
    products = await res.json();

    loading.style.display = 'none';

    if (!products || products.length === 0) {
      empty.style.display = 'flex';
      return;
    }

    products.forEach(product => renderProductCard(product));
    updateCartBadge();
  } catch (e) {
    loading.style.display = 'none';
    console.error('加载商品失败:', e);
    showToast('加载商品失败', 'error');
  }
}

function renderProductCard(product) {
  const grid = document.getElementById('productsGrid');
  const specs = parseSpecs(product);
  
  // 获取价格：如果有规格取规格价，否则取商品价格
  let displayPrice = product.price;
  if (specs.length > 0) {
    displayPrice = specs[0].price;
  }
  
  const image = product.image || '/img/default-product.png';

  const card = document.createElement('div');
  card.className = 'product-card';
  if (product.is_featured) card.classList.add('featured');

  card.innerHTML = `
    <div class="product-image" onclick="openProductModal(${product.id})">
      <img src="${image}" alt="${product.name}" onerror="this.src='/img/default-product.png'">
      ${product.is_featured ? '<span class="featured-tag">精选</span>' : ''}
      ${product.tag ? `<span class="tag">${product.tag}</span>` : ''}
    </div>
    <div class="product-info">
      <h3 class="product-name" onclick="openProductModal(${product.id})">${product.name}</h3>
      <p class="product-desc">${product.description || ''}</p>
      <div class="product-bottom">
        <span class="product-price">¥${displayPrice}</span>
        <button class="btn-add-cart" onclick="event.stopPropagation(); openBuyModal(${product.id})">
          <i class="bi bi-cart-plus"></i>
        </button>
      </div>
    </div>
  `;

  grid.appendChild(card);
}

function parseSpecs(product) {
  if (!product) return [];
  if (!product.specs) return [];
  if (typeof product.specs === 'string') {
    try {
      return JSON.parse(product.specs);
    } catch (e) {
      return [];
    }
  }
  if (Array.isArray(product.specs)) {
    return product.specs;
  }
  return [];
}

// ==================== 商品详情弹窗 ====================

async function openProductModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  currentProduct = product;
  const specs = parseSpecs(product);

  const modalBody = document.getElementById('productModalBody');
  const images = product.images && typeof product.images === 'string' 
    ? JSON.parse(product.images) 
    : (product.images || []);

  // 获取显示价格
  const displayPrice = specs.length > 0 ? specs[0].price : product.price;

  modalBody.innerHTML = `
    <div class="product-detail">
      <div class="detail-images">
        ${images.length > 0 
          ? images.map((img, i) => `<img src="${img}" class="${i === 0 ? 'active' : ''}" onclick="switchDetailImage(this)">`).join('')
          : `<img src="${product.image || '/img/default-product.png'}" alt="${product.name}">`
        }
      </div>
      <div class="detail-info">
        <h2 class="detail-name">${product.name}</h2>
        <div class="detail-price">
          <span class="current-price">¥${displayPrice}</span>
        </div>
        <p class="detail-desc">${product.description || '优质海鲜，新鲜送达'}</p>
        ${specs.length > 0 ? `
          <div class="detail-specs">
            <label>选择规格:</label>
            <div class="spec-list">
              ${specs.map((spec, i) => `
                <span class="spec-item ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="selectDetailSpec(${i}, this)">
                  ${spec.name || spec.spec || `${spec.qty || 1}${spec.unit || '份'}`} ¥${spec.price}
                </span>
              `).join('')}
            </div>
          </div>
        ` : ''}
        <div class="detail-actions">
          <button class="btn btn-outline-secondary" onclick="addToCartFromDetail()">
            <i class="bi bi-cart-plus"></i> 加入购物车
          </button>
          <button class="btn btn-primary" onclick="closeProductModal(); openBuyModal(${product.id})">
            <i class="bi bi-bag"></i> 立即购买
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('productModal').classList.add('show');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('show');
}

function addToCartFromDetail() {
  if (!currentProduct) return;
  openBuyModal(currentProduct.id);
}

function selectDetailSpec(index, el) {
  // 更新详情弹窗中的规格选中状态
  document.querySelectorAll('.detail-specs .spec-item').forEach((item, i) => {
    item.classList.toggle('active', i === index);
  });
  // 更新详情弹窗中的红色价格
  const specs = parseSpecs(currentProduct);
  if (specs.length > 0) {
    const priceEl = document.querySelector('.detail-price .current-price');
    if (priceEl) priceEl.textContent = `¥${specs[index].price}`;
  }
}

function switchDetailImage(img) {
  const container = img.parentElement;
  container.querySelectorAll('img').forEach(i => i.classList.remove('active'));
  img.classList.add('active');
}

// ==================== 购买弹窗 ====================

async function openBuyModal(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;

  currentProduct = product;
  const specs = parseSpecs(product);
  
  // 默认选中第一个规格
  currentSpecIndex = specs.length > 0 ? 0 : -1;
  
  // 获取显示价格
  const displayPrice = specs.length > 0 ? specs[0].price : product.price;

  // 商品信息
  document.getElementById('buyProductInfo').innerHTML = `
    <img src="${product.image || '/img/default-product.png'}" alt="${product.name}" onerror="this.src='/img/default-product.png'">
    <div class="product-text">
      <h4>${product.name}</h4>
      <p class="price">¥<span id="specPrice">${displayPrice}</span></p>
    </div>
  `;

  // 规格选项
  const specSection = document.getElementById('specSection');
  const specOptions = document.getElementById('specOptions');

  if (specs.length > 0) {
    specSection.style.display = 'block';
    specOptions.innerHTML = specs.map((spec, i) => `
      <div class="spec-option ${i === 0 ? 'active' : ''}" data-index="${i}" onclick="selectSpec(${i})">
        <span class="spec-name">${spec.name || spec.spec || `${spec.qty || 1}${spec.unit || '份'}`}</span>
        <span class="spec-price">¥${spec.price}</span>
      </div>
    `).join('');
  } else {
    specSection.style.display = 'none';
  }

  // 重置数量
  document.getElementById('buyQty').value = 1;
  updateBuyTotal();

  document.getElementById('buyModal').classList.add('show');
}

function selectSpec(index) {
  currentSpecIndex = index;
  document.querySelectorAll('.spec-option').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  const specs = parseSpecs(currentProduct);
  const price = specs.length > 0 ? specs[index].price : currentProduct.price;
  document.getElementById('specPrice').textContent = price;
  updateBuyTotal();
}

function changeQty(delta) {
  const input = document.getElementById('buyQty');
  let value = parseInt(input.value) + delta;
  if (value < 1) value = 1;
  input.value = value;
  updateBuyTotal();
}

function updateBuyTotal() {
  const specs = parseSpecs(currentProduct);
  const price = currentSpecIndex >= 0 && specs.length > 0 
    ? specs[currentSpecIndex].price 
    : currentProduct.price;
  const qty = parseInt(document.getElementById('buyQty').value) || 1;
  document.getElementById('buyTotalPrice').textContent = (price * qty).toFixed(2);
}

function getSelectedSpec() {
  const specs = parseSpecs(currentProduct);
  if (currentSpecIndex >= 0 && specs.length > 0) {
    const spec = specs[currentSpecIndex];
    return {
      name: spec.name || spec.spec || `${spec.qty || 1}${spec.unit || '份'}`,
      price: spec.price,
      qty: spec.qty || 1,
      unit: spec.unit || '份'
    };
  }
  return {
    name: currentProduct.unit || '份',
    price: currentProduct.price,
    qty: 1,
    unit: currentProduct.unit || '份'
  };
}

function closeBuyModal() {
  document.getElementById('buyModal').classList.remove('show');
}

// ==================== 购物车 ====================

function addToCart() {
  if (!currentProduct) return;

  const spec = getSelectedSpec();
  const qty = parseInt(document.getElementById('buyQty').value) || 1;

  const item = {
    productId: currentProduct.id,
    name: currentProduct.name,
    image: currentProduct.image,
    spec: spec.name,
    price: spec.price,
    quantity: qty
  };

  // 检查是否已存在
  const existIndex = cart.findIndex(c => 
    c.productId === item.productId && c.spec === item.spec
  );

  if (existIndex >= 0) {
    cart[existIndex].quantity += qty;
  } else {
    cart.push(item);
  }

  saveCart();
  updateCartBadge();
  showToast('已加入购物车', 'success');
  closeBuyModal();
}

async function directBuy() {
  if (!currentProduct) return;

  const spec = getSelectedSpec();
  const qty = parseInt(document.getElementById('buyQty').value) || 1;

  const item = {
    productId: currentProduct.id,
    name: currentProduct.name,
    image: currentProduct.image,
    spec: spec.name,
    price: spec.price,
    quantity: qty
  };

  cart = [item];
  saveCart();
  closeBuyModal();
  goCheckout();
}

function loadCart() {
  const saved = localStorage.getItem('xtc_cart');
  if (saved) {
    try {
      cart = JSON.parse(saved);
    } catch (e) {
      cart = [];
    }
  }
  renderCart();
  updateCartBadge();
}

function saveCart() {
  localStorage.setItem('xtc_cart', JSON.stringify(cart));
}

function updateCartBadge() {
  const badge = document.getElementById('cartBadge');
  const count = cart.reduce((sum, item) => sum + item.quantity, 0);
  if (count > 0) {
    badge.style.display = 'inline';
    badge.textContent = count;
  } else {
    badge.style.display = 'none';
  }
}

function renderCart() {
  const listEl = document.getElementById('cartList');
  const emptyEl = document.getElementById('emptyCart');
  const footerEl = document.getElementById('cartFooter');

  if (cart.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    footerEl.style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  footerEl.style.display = 'flex';

  listEl.innerHTML = cart.map((item, index) => `
    <div class="cart-item">
      <img src="${item.image || '/img/default-product.png'}" alt="${item.name}" onerror="this.src='/img/default-product.png'">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <p class="cart-item-spec">${item.spec}</p>
        <p class="cart-item-price">¥${item.price}</p>
      </div>
      <div class="cart-item-actions">
        <div class="quantity-control small">
          <button onclick="cartChangeQty(${index}, -1)">-</button>
          <span>${item.quantity}</span>
          <button onclick="cartChangeQty(${index}, 1)">+</button>
        </div>
        <button class="btn-remove" onclick="removeCartItem(${index})">
          <i class="bi bi-trash"></i>
        </button>
      </div>
    </div>
  `).join('');

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  document.getElementById('cartTotalCount').textContent = totalCount;
  document.getElementById('cartTotalAmount').textContent = totalAmount.toFixed(2);
}

function cartChangeQty(index, delta) {
  cart[index].quantity += delta;
  if (cart[index].quantity < 1) {
    cart.splice(index, 1);
  }
  saveCart();
  renderCart();
  updateCartBadge();
}

function removeCartItem(index) {
  cart.splice(index, 1);
  saveCart();
  renderCart();
  updateCartBadge();
}

// ==================== 结算 ====================

function goCheckout() {
  if (cart.length === 0) {
    showToast('购物车是空的', 'warning');
    return;
  }

  const itemsEl = document.getElementById('checkoutItems');
  itemsEl.innerHTML = cart.map(item => `
    <div class="checkout-item">
      <img src="${item.image || '/img/default-product.png'}" alt="${item.name}">
      <div class="checkout-item-info">
        <h4>${item.name}</h4>
        <p>${item.spec} × ${item.quantity}</p>
      </div>
      <span class="checkout-item-price">¥${(item.price * item.quantity).toFixed(2)}</span>
    </div>
  `).join('');

  const totalCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);

  document.getElementById('checkoutCount').textContent = `${totalCount} 件`;
  document.getElementById('checkoutTotal').textContent = totalAmount.toFixed(2);

  document.getElementById('checkoutModal').classList.add('show');
}

function closeCheckout() {
  document.getElementById('checkoutModal').classList.remove('show');
}

async function submitCheckout() {
  const phone = document.getElementById('checkoutPhone').value.trim();
  const receiverName = document.getElementById('checkoutName').value.trim();
  const receiverAddress = document.getElementById('checkoutAddress').value.trim();
  const remark = document.getElementById('checkoutRemark').value.trim();

  if (!phone) {
    showToast('请输入手机号码', 'warning');
    return;
  }

  if (!/^1[3-9]\d{9}$/.test(phone)) {
    showToast('请输入正确的手机号码', 'warning');
    return;
  }

  const totalAmount = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const items = cart.map(item => ({
    productId: item.productId,
    name: item.name,
    spec: item.spec,
    price: item.price,
    quantity: item.quantity,
    image: item.image
  }));

  try {
    const res = await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, receiverName, receiverAddress, items, totalAmount, remark })
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.error || '下单失败', 'error');
      return;
    }

    pendingOrderId = data.orderId;
    saveOrderToLocal(data.orderId, items, totalAmount, phone);

    closeCheckout();
    cart = [];
    saveCart();
    updateCartBadge();

    showToast('订单创建成功', 'success');

    // 打开支付弹窗
    openPayModal(data.orderId, totalAmount);
  } catch (e) {
    console.error('提交订单失败:', e);
    showToast('提交订单失败，请重试', 'error');
  }
}

// ==================== 支付 ====================

async function openPayModal(orderId, totalAmount) {
  pendingOrderId = orderId;
  document.getElementById('payOrderId').textContent = orderId;
  document.getElementById('payAmount').textContent = totalAmount.toFixed(2);

  await loadPaymentQRCodes();
  selectPayMethod('alipay');

  document.getElementById('payModal').classList.add('show');
}

async function loadPaymentQRCodes() {
  try {
    const res = await fetch(`${API}/api/payment/qr`);
    const data = await res.json();
    window.paymentQRs = data;
  } catch (e) {
    console.error('加载支付二维码失败:', e);
  }
}

function selectPayMethod(method) {
  selectedPayMethod = method;
  document.querySelectorAll('.pay-method').forEach(el => {
    el.classList.toggle('active', el.dataset.method === method);
  });

  const qrContainer = document.getElementById('payQrCode');
  const qrs = window.paymentQRs || {};
  const qrUrl = method === 'alipay' ? qrs.alipay : qrs.wechat;

  document.getElementById('payMethodName').textContent = method === 'alipay' ? '支付宝' : '微信';

  if (qrUrl) {
    qrContainer.innerHTML = `<img src="${qrUrl}" alt="支付二维码">`;
  } else {
    qrContainer.innerHTML = `
      <div class="qr-placeholder">
        <i class="bi bi-qr-code"></i>
        <p>暂未配置${method === 'alipay' ? '支付宝' : '微信'}收款码</p>
        <p class="hint">请联系管理员配置</p>
      </div>
    `;
  }
}

function closePayModal() {
  document.getElementById('payModal').classList.remove('show');
  showPage('orders');
}

async function confirmPay() {
  if (!pendingOrderId) return;

  try {
    const res = await fetch(`${API}/api/orders/${pendingOrderId}`);
    const order = await res.json();

    if (order.status === 'paid' || order.status === 'shipped' || order.status === 'completed') {
      showToast('支付已确认', 'success');
      closePayModal();
      loadOrders();
    } else {
      showToast('请确认已转账支付后再点击', 'warning');
    }
  } catch (e) {
    showToast('确认失败，请稍后重试', 'error');
  }
}

// ==================== 订单列表 ====================

let currentOrderFilter = 'all';

async function loadOrders() {
  const listEl = document.getElementById('orderList');
  const emptyEl = document.getElementById('emptyOrders');

  // 先显示本地缓存的订单
  const savedOrders = localStorage.getItem('xtc_orders');
  let localOrders = savedOrders ? JSON.parse(savedOrders) : [];

  // 根据筛选条件过滤
  if (currentOrderFilter !== 'all') {
    localOrders = localOrders.filter(order => order.status === currentOrderFilter);
  }

  if (localOrders.length === 0) {
    listEl.innerHTML = '';
    emptyEl.style.display = 'flex';
    return;
  }

  emptyEl.style.display = 'none';
  listEl.innerHTML = localOrders.map(order => renderOrderCard(order)).join('');

  // 从服务器同步最新订单状态
  const allOrders = savedOrders ? JSON.parse(savedOrders) : [];
  await syncOrdersFromServer(allOrders);
}

// 筛选订单
function filterOrders(status) {
  currentOrderFilter = status;
  
  // 更新按钮样式
  document.querySelectorAll('.filter-tab').forEach(btn => {
    if (btn.dataset.filter === status) {
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-primary', 'active');
    } else {
      btn.classList.remove('btn-primary', 'active');
      btn.classList.add('btn-outline-primary');
    }
  });
  
  loadOrders();
}

// 从服务器同步订单状态
async function syncOrdersFromServer(localOrders) {
  // 获取所有不同的手机号
  const phones = [...new Set(localOrders.map(o => o.phone).filter(Boolean))];
  
  if (phones.length === 0) {
    // 尝试从localStorage获取当前用户手机号
    const lastPhone = localStorage.getItem('xtc_last_phone');
    if (lastPhone) phones.push(lastPhone);
  }

  for (const phone of phones) {
    try {
      const res = await fetch(`${API}/api/orders?phone=${encodeURIComponent(phone)}`);
      if (!res.ok) continue;
      
      const data = await res.json();
      if (!data.orders || data.orders.length === 0) continue;

      // 更新本地订单状态
      let updated = false;
      const updatedOrders = localOrders.map(localOrder => {
        const serverOrder = data.orders.find(o => o.orderId === localOrder.orderId);
        if (serverOrder && serverOrder.status !== localOrder.status) {
          updated = true;
          return { ...localOrder, ...serverOrder };
        }
        return localOrder;
      });

      // 如果有更新，保存并重新渲染（根据当前筛选条件）
      if (updated) {
        localStorage.setItem('xtc_orders', JSON.stringify(updatedOrders));
        
        // 根据当前筛选条件过滤后渲染
        let displayOrders = updatedOrders;
        if (currentOrderFilter !== 'all') {
          displayOrders = updatedOrders.filter(o => o.status === currentOrderFilter);
        }
        
        const listEl = document.getElementById('orderList');
        const emptyEl = document.getElementById('emptyOrders');
        
        if (displayOrders.length === 0) {
          listEl.innerHTML = '';
          emptyEl.style.display = 'flex';
        } else {
          emptyEl.style.display = 'none';
          listEl.innerHTML = displayOrders.map(order => renderOrderCard(order)).join('');
        }
      }
    } catch (e) {
      console.error('同步订单失败:', e);
    }
  }
}

function saveOrderToLocal(orderId, items, totalAmount, phone) {
  const saved = localStorage.getItem('xtc_orders');
  const orders = saved ? JSON.parse(saved) : [];

  orders.unshift({
    orderId,
    items,
    totalAmount,
    phone,
    createdAt: new Date().toISOString(),
    status: 'pending'
  });

  localStorage.setItem('xtc_orders', JSON.stringify(orders.slice(0, 50)));
  
  // 保存手机号用于后续同步
  if (phone) {
    localStorage.setItem('xtc_last_phone', phone);
  }
}

function renderOrderCard(order) {
  const statusMap = {
    pending: { text: '待付款', class: 'status-pending' },
    paid: { text: '已付款', class: 'status-paid' },
    shipped: { text: '已发货', class: 'status-shipped' },
    completed: { text: '已完成', class: 'status-completed' },
    cancelled: { text: '已取消', class: 'status-cancelled' }
  };

  const status = statusMap[order.status] || statusMap.pending;
  const date = new Date(order.createdAt).toLocaleDateString('zh-CN');

  return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-id">订单号: ${order.orderId}</span>
        <span class="order-status ${status.class}">${status.text}</span>
      </div>
      <div class="order-body">
        <p class="order-date">下单时间: ${date}</p>
        ${order.items && order.items.length > 0 ? `
          <div class="order-items">
            ${order.items.slice(0, 3).map(item => `
              <div class="order-item">
                <span>${item.name} × ${item.quantity}</span>
                <span>¥${item.price}</span>
              </div>
            `).join('')}
            ${order.items.length > 3 ? `<div class="order-item-more">...等${order.items.length}件商品</div>` : ''}
          </div>
        ` : ''}
      </div>
      <div class="order-footer">
        <span class="order-total">合计: ¥${order.totalAmount || 0}</span>
        <div class="order-actions">
          ${order.status === 'pending' ? `
            <button class="btn btn-primary btn-sm" onclick="gotoPay('${order.orderId}', ${order.totalAmount || 0})">
              去付款
            </button>
          ` : ''}
          ${order.status === 'shipped' || order.status === 'completed' ? `
            <button class="btn btn-outline-primary btn-sm" onclick="viewTracking('${order.orderId}', '${order.logisticsCompany || ''}', '${order.logisticsNo || ''}')">
              查看物流
            </button>
          ` : ''}
          <button class="btn btn-outline-danger btn-sm" onclick="deleteOrder('${order.orderId}', '${order.phone || ''}', '${order.status}')">
            删除
          </button>
          <button class="btn btn-outline-secondary btn-sm" onclick="showOrderDetail('${order.orderId}')">
            查看详情
          </button>
        </div>
      </div>
    </div>
  `;
}

function gotoPay(orderId, totalAmount) {
  openPayModal(orderId, totalAmount);
}

async function showOrderDetail(orderId) {
  try {
    const res = await fetch(`${API}/api/orders/${orderId}`);
    const order = await res.json();

    const statusMap = {
      pending: '待付款',
      paid: '已付款',
      shipped: '已发货',
      completed: '已完成',
      cancelled: '已取消'
    };

    const body = document.getElementById('orderDetailBody');
    body.innerHTML = `
      <div class="order-detail">
        <div class="detail-section">
          <h5>订单信息</h5>
          <p><strong>订单号:</strong> ${order.orderId}</p>
          <p><strong>订单状态:</strong> <span class="text-primary">${statusMap[order.status] || order.status}</span></p>
          <p><strong>下单时间:</strong> ${order.createdAt}</p>
        </div>
        <div class="detail-section">
          <h5>收货信息</h5>
          <p><strong>联系电话:</strong> ${order.phone}</p>
          <p><strong>收货人:</strong> ${order.receiverName || '-'}</p>
          <p><strong>收货地址:</strong> ${order.receiverAddress || '-'}</p>
        </div>
        <div class="detail-section">
          <h5>商品明细</h5>
          ${(order.items || []).map(item => `
            <div class="detail-item">
              <span>${item.name} × ${item.quantity} (${item.spec})</span>
              <span>¥${item.price}</span>
            </div>
          `).join('')}
          <div class="detail-total">
            <span>订单总额:</span>
            <span class="text-danger">¥${order.totalAmount}</span>
          </div>
        </div>
        ${order.logisticsNo ? `
          <div class="detail-section">
            <h5>物流信息</h5>
            <p><strong>快递公司:</strong> ${order.logisticsCompany || '-'}</p>
            <p><strong>运单号:</strong> ${order.logisticsNo}</p>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('orderDetailModal').classList.add('show');
  } catch (e) {
    console.error('加载订单详情失败:', e);
    showToast('加载订单详情失败', 'error');
  }
}

function closeOrderDetail() {
  document.getElementById('orderDetailModal').classList.remove('show');
}

// 删除订单
async function deleteOrder(orderId, phone, status) {
  if (!phone) {
    phone = localStorage.getItem('xtc_last_phone');
  }
  
  if (!phone) {
    showToast('无法获取手机号，请重新登录', 'error');
    return;
  }

  // 根据订单状态给出不同的确认提示
  let confirmMsg = '确定要删除此订单吗？删除后无法恢复。';
  if (status === 'shipped' || status === 'completed') {
    confirmMsg = '⚠️ 该订单' + (status === 'shipped' ? '已发货' : '已完成') + '，确定要删除吗？删除后无法恢复。';
  } else if (status === 'paid') {
    confirmMsg = '⚠️ 该订单已付款（待发货），确定要删除吗？删除后无法恢复。';
  }

  if (!confirm(confirmMsg)) {
    return;
  }

  try {
    const res = await fetch(`${API}/api/orders/${orderId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();

    // 无论后端是否成功，都从本地存储中删除
    const saved = localStorage.getItem('xtc_orders');
    if (saved) {
      const orders = JSON.parse(saved).filter(o => o.orderId !== orderId);
      localStorage.setItem('xtc_orders', JSON.stringify(orders));
    }

    if (!res.ok) {
      // 后端返回错误（如"订单不存在"），本地已经清除，直接刷新
      // 不再提示错误，因为本地订单已删除
    }

    // 重新加载订单列表
    loadOrders();
    showToast('订单已删除', 'success');
  } catch (e) {
    console.error('删除订单失败:', e);
    showToast('删除失败，请重试', 'error');
  }
}

// ==================== 物流查询 ====================

let currentTrackingOrderId = '';
let currentTrackingCompany = '';
let currentTrackingNo = '';

function viewTracking(orderId, company, trackingNo) {
  currentTrackingOrderId = orderId;
  currentTrackingCompany = company;
  currentTrackingNo = trackingNo;
  
  document.getElementById('trackingOrderId').textContent = orderId;
  document.getElementById('trackingCompany').textContent = company || '-';
  document.getElementById('trackingNo').textContent = trackingNo || '-';
  document.getElementById('trackingModal').classList.add('show');
  
  loadTrackingData(company, trackingNo);
}

function closeTrackingModal() {
  document.getElementById('trackingModal').classList.remove('show');
  currentTrackingOrderId = '';
  currentTrackingCompany = '';
  currentTrackingNo = '';
}

async function loadTrackingData(company, trackingNo) {
  const timeline = document.getElementById('trackingTimeline');
  
  if (!company || !trackingNo) {
    timeline.innerHTML = '<div style="text-align:center;color:#999;padding:30px;">暂无物流信息</div>';
    return;
  }
  
  timeline.innerHTML = '<div style="text-align:center;padding:30px;"><i class="bi bi-arrow-repeat" style="animation:spin 1s linear infinite;"></i> 查询中...</div>';
  
  try {
    const res = await fetch(`${API}/api/tracking?company=${encodeURIComponent(company)}&no=${encodeURIComponent(trackingNo)}&orderId=${encodeURIComponent(currentTrackingOrderId)}`);
    const data = await res.json();
    
    if (data.success && data.tracks && data.tracks.length > 0) {
      renderTrackingTimeline(data.tracks, data.courierInfo, data.source);
    } else {
      timeline.innerHTML = `
        <div style="text-align:center;color:#999;padding:30px;">
          <i class="bi bi-inbox" style="font-size:48px;display:block;margin-bottom:10px;color:#ddd;"></i>
          暂无物流轨迹信息<br>
          <small style="color:#bbb;">${company} ${trackingNo}</small>
        </div>
      `;
    }
  } catch (e) {
    timeline.innerHTML = '<div style="text-align:center;color:#dc3545;padding:30px;">查询失败，请稍后重试</div>';
  }
}

function renderTrackingTimeline(tracks, courierInfo, source) {
  const timeline = document.getElementById('trackingTimeline');
  
  // 快递员信息卡片
  let courierCard = '';
  if (courierInfo && (courierInfo.deliveryManName || courierInfo.deliveryManPhone)) {
    const name = courierInfo.deliveryManName || '';
    const phone = courierInfo.deliveryManPhone || '';
    const maskedPhone = phone ? phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : '';
    courierCard = `
      <div style="background:linear-gradient(135deg,#e3f2fd,#f3e5f5);border-radius:12px;padding:15px;margin-bottom:15px;display:flex;align-items:center;">
        <div style="width:45px;height:45px;border-radius:50%;background:#1976d2;display:flex;align-items:center;justify-content:center;margin-right:12px;">
          <i class="bi bi-person-fill" style="color:white;font-size:22px;"></i>
        </div>
        <div style="flex:1;">
          <div style="font-weight:bold;color:#333;font-size:14px;">派件快递员：${name || '待分配'}</div>
          ${maskedPhone ? `<div style="color:#1976d2;font-size:13px;margin-top:3px;"><i class="bi bi-telephone"></i> ${maskedPhone}</div>` : ''}
        </div>
        ${maskedPhone ? `<a href="tel:${phone}" style="background:#1976d2;color:white;border-radius:20px;padding:6px 14px;text-decoration:none;font-size:12px;"><i class="bi bi-telephone-fill"></i> 联系</a>` : ''}
      </div>
    `;
  }
  
  // 物流来源标识
  const sourceTag = source === 'kuaidi100' 
    ? '<div style="text-align:right;font-size:11px;color:#4caf50;margin-bottom:8px;"><i class="bi bi-patch-check-fill"></i> 数据来源：快递100实时查询</div>'
    : '<div style="text-align:right;font-size:11px;color:#999;margin-bottom:8px;"><i class="bi bi-info-circle"></i> 模拟数据（未配置快递100 API）</div>';
  
  const html = sourceTag + courierCard + tracks.map((track, index) => {
    // 根据物流状态显示不同图标
    let icon = 'bi-circle';
    let iconColor = '#bbb';
    if (track.status) {
      if (track.status.includes('签收')) { icon = 'bi-check-circle-fill'; iconColor = '#4caf50'; }
      else if (track.status.includes('派件') || track.status.includes('派送')) { icon = 'bi-truck'; iconColor = '#ff9800'; }
      else if (track.status.includes('揽收')) { icon = 'bi-box-seam-fill'; iconColor = '#2196f3'; }
      else if (track.status.includes('在途') || track.status.includes('运输')) { icon = 'bi-arrow-right-circle-fill'; iconColor = '#00bcd4'; }
    }
    if (index === 0) { icon = 'bi-geo-alt-fill'; iconColor = '#1976d2'; }
    
    return `
    <div style="display:flex;padding:15px 0;border-bottom:1px solid #eee;${index === 0 ? 'background:#e3f2fd;border-radius:8px;padding:15px;margin:0 -5px;' : ''}">
      <div style="width:40px;text-align:center;margin-right:15px;">
        <i class="bi ${icon}" style="font-size:18px;color:${iconColor};"></i>
      </div>
      <div style="flex:1;">
        <div style="font-weight:${index === 0 ? 'bold' : 'normal'};margin-bottom:5px;color:${index === 0 ? '#1976d2' : '#333'};">${track.context}</div>
        <div style="color:#999;font-size:12px;">${track.time}</div>
        ${track.location ? `<div style="color:#999;font-size:11px;"><i class="bi bi-geo"></i> ${track.location}</div>` : ''}
      </div>
    </div>
  `}).join('');
  
  timeline.innerHTML = html;
}

function refreshTracking() {
  if (currentTrackingCompany && currentTrackingNo) {
    loadTrackingData(currentTrackingCompany, currentTrackingNo);
  }
}

// ==================== 工具函数 ====================

function showToast(message, type = 'info') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : type === 'warning' ? 'exclamation-circle' : 'info-circle'}"></i>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// 辅助函数：格式化日期
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}
