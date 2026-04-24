/**
 * 小铁船海鲜甄选商城 - 管理后台 JS
 */

// API 配置
const API = window.location.origin;

// 全局状态
// 从localStorage和cookie中读取token
let token = localStorage.getItem('admin_token') || '';
if (!token) {
  const match = (document.cookie || '').match(/admin_token=([^;]+)/);
  if (match) token = match[1];
}
let currentTab = 'dashboard';
let currentOrderStatus = '';
let currentOrderPage = 1;
let uploadTarget = ''; // 'alipay' | 'wechat' | 'product'
let editingProductId = null;

// ==================== 初始化 ====================

document.addEventListener('DOMContentLoaded', () => {
  if (token) {
    showAdmin();
  } else {
    showLogin();
  }
  bindEvents();
  updateTime();
  setInterval(updateTime, 1000);
});

// ==================== 事件绑定 ====================

function bindEvents() {
  // 登录表单
  document.getElementById('loginForm').addEventListener('submit', handleLogin);

  // 侧边栏导航
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = item.dataset.tab;
      switchTab(tab);
    });
  });

  // 订单状态筛选
  document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentOrderStatus = tab.dataset.status;
      document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      loadOrders(1);
    });
  });

  // 设置表单
  document.getElementById('settingsForm').addEventListener('submit', handleSaveSettings);

  // 密码表单
  document.getElementById('passwordForm').addEventListener('submit', handleChangePassword);

  // 商品表单
  document.getElementById('productForm').addEventListener('submit', (e) => e.preventDefault());

  // 文件上传
  const uploadArea = document.getElementById('uploadArea');
  const fileInput = document.getElementById('fileInput');

  uploadArea.addEventListener('click', () => fileInput.click());
  uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
  });
  uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
  });
  uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  });
  fileInput.addEventListener('change', () => {
    if (fileInput.files[0]) uploadFile(fileInput.files[0]);
  });
}

// ==================== 登录 ====================

async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUser').value.trim();
  const password = document.getElementById('loginPass').value;
  const msgEl = document.getElementById('loginMsg');

  msgEl.textContent = '';

  try {
    const res = await fetch(`${API}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();

    if (data.success) {
      token = data.token;
      localStorage.setItem('admin_token', token);
      // 同时设置cookie，服务端也通过cookie验证
      document.cookie = 'admin_token=' + token + '; path=/; max-age=86400';
      showAdmin();
    } else {
      msgEl.textContent = data.error || '登录失败';
    }
  } catch (e) {
    msgEl.textContent = '网络错误，请检查服务器';
  }
}

function showLogin() {
  document.getElementById('loginPage').style.display = 'flex';
  document.getElementById('adminPage').style.display = 'none';
}

function showAdmin() {
  document.getElementById('loginPage').style.display = 'none';
  document.getElementById('adminPage').style.display = 'flex';
  loadDashboard();
}

// ==================== 退出 ====================

function logout() {
  token = '';
  localStorage.removeItem('admin_token');
  document.cookie = 'admin_token=; path=/; max-age=0';
  showLogin();
}

// ==================== 标签切换 ====================

function switchTab(tab) {
  currentTab = tab;

  // 更新侧边栏
  document.querySelectorAll('.sidebar-nav .nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab);
  });

  // 更新标题
  const titles = {
    dashboard: '仪表盘',
    orders: '订单管理',
    products: '商品管理',
    settings: '系统设置',
    account: '账号设置'
  };
  document.getElementById('currentTabTitle').textContent = titles[tab] || tab;

  // 显示对应内容
  document.querySelectorAll('.tab-content').forEach(el => {
    el.style.display = 'none';
  });
  document.getElementById(`tab-${tab}`).style.display = 'block';

  // 加载数据
  switch (tab) {
    case 'dashboard': loadDashboard(); break;
    case 'orders': loadOrders(1); break;
    case 'products': loadProducts(); break;
    case 'settings': loadSettings(); break;
  }
}

// ==================== 仪表盘 ====================

async function loadDashboard() {
  try {
    const res = await fetch(`${API}/api/admin/stats`, authHeaders());
    const stats = await res.json();

    document.getElementById('stat-today-orders').textContent = stats.orders?.total || 0;
    document.getElementById('stat-today-revenue').textContent = (stats.revenue?.today || 0).toFixed(2);
    document.getElementById('stat-pending-orders').textContent = stats.orders?.pending || 0;
    document.getElementById('stat-toship-orders').textContent = stats.orders?.toShip || 0;
    document.getElementById('stat-shipped-orders').textContent = stats.orders?.shipped || 0;
    document.getElementById('stat-completed-orders').textContent = stats.orders?.completed || 0;
    document.getElementById('stat-products').textContent = stats.products?.total || 0;
    document.getElementById('stat-total-revenue').textContent = (stats.revenue?.total || 0).toFixed(2);

    // 更新待处理订单徽章
    const pendingCount = stats.orders?.pending || 0;
    const badge = document.getElementById('badge-pending');
    if (pendingCount > 0) {
      badge.textContent = pendingCount;
      badge.style.display = 'inline';
    } else {
      badge.style.display = 'none';
    }
  } catch (e) {
    console.error('加载仪表盘失败:', e);
  }
}

// ==================== 订单管理 ====================

async function loadOrders(page = 1) {
  currentOrderPage = page;
  const tbody = document.getElementById('ordersTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">加载中...</td></tr>';

  try {
    let url = `${API}/api/admin/orders?page=${page}&limit=20`;
    if (currentOrderStatus) url += `&status=${currentOrderStatus}`;

    const res = await fetch(url, authHeaders());
    const data = await res.json();

    if (data.orders && data.orders.length > 0) {
      renderOrdersTable(data.orders);
      renderOrdersPagination(data.pages, data.total);
    } else {
      tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-5">暂无订单</td></tr>';
      document.getElementById('ordersPagination').innerHTML = '';
    }
  } catch (e) {
    console.error('加载订单失败:', e);
    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-5">加载失败</td></tr>';
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('ordersTableBody');
  const statusMap = {
    pending: { text: '待付款', class: 'status-pending' },
    confirming: { text: '待确认', class: 'status-confirming' },
    paid: { text: '已付款', class: 'status-paid' },
    shipped: { text: '已发货', class: 'status-shipped' },
    completed: { text: '已完成', class: 'status-completed' },
    cancelled: { text: '已取消', class: 'status-cancelled' }
  };

  tbody.innerHTML = orders.map(order => {
    const status = statusMap[order.status] || statusMap.pending;
    const items = parseItems(order.items);
    const itemNames = items.slice(0, 2).map(i => `${i.name}×${i.quantity}`).join(', ');
    const moreCount = items.length > 2 ? `等${items.length}件` : '';

    return `
      <tr>
        <td>
          <strong>${order.orderId}</strong>
          <br><small class="text-muted">${order.phone}</small>
        </td>
        <td>
          <span class="item-names">${itemNames}${moreCount}</span>
        </td>
        <td class="text-danger">¥${order.totalAmount}</td>
        <td><span class="badge ${status.class}">${status.text}</span></td>
        <td><small>${formatDate(order.createdAt)}</small></td>
        <td>
          <div class="action-btns">
            <a href="javascript:void(0)" class="action-link" onclick="showOrderDetail('${order.orderId}')">详情</a>
            ${order.status === 'pending' ? `
              <a href="javascript:void(0)" class="action-link text-success" onclick="confirmPay('${order.orderId}')">确认付款</a>
              <a href="javascript:void(0)" class="action-link text-danger" onclick="deleteOrder('${order.orderId}')">删除</a>
            ` : ''}
            ${order.status === 'paid' ? `
              <a href="javascript:void(0)" class="action-link text-primary" onclick="openShipModal('${order.orderId}')">发货</a>
              <a href="javascript:void(0)" class="action-link text-danger" onclick="deleteOrder('${order.orderId}')">删除</a>
            ` : ''}
            ${order.status === 'shipped' ? `
              <a href="javascript:void(0)" class="action-link" onclick="viewTracking('${order.orderId}', '${order.logisticsCompany}', '${order.logisticsNo}')">查看物流</a>
              <a href="javascript:void(0)" class="action-link text-success" onclick="completeOrder('${order.orderId}')">完成</a>
              <a href="javascript:void(0)" class="action-link text-danger" onclick="deleteOrder('${order.orderId}')">删除</a>
            ` : ''}
            ${order.status === 'completed' ? `
              <a href="javascript:void(0)" class="action-link" onclick="viewTracking('${order.orderId}', '${order.logisticsCompany}', '${order.logisticsNo}')">查看物流</a>
              <a href="javascript:void(0)" class="action-link text-danger" onclick="deleteOrder('${order.orderId}')">删除</a>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function renderOrdersPagination(pages, total) {
  const container = document.getElementById('ordersPagination');
  if (pages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';
  for (let i = 1; i <= pages; i++) {
    html += `<button class="page-btn ${i === currentOrderPage ? 'active' : ''}" onclick="loadOrders(${i})">${i}</button>`;
  }
  container.innerHTML = html;
}

async function showOrderDetail(orderId) {
  try {
    const res = await fetch(`${API}/api/admin/orders/${orderId}`, authHeaders());
    const order = await res.json();

    const statusMap = {
      pending: '待付款', confirming: '待确认', paid: '已付款',
      shipped: '已发货', completed: '已完成', cancelled: '已取消'
    };

    const body = document.getElementById('orderDetailBody');
    body.innerHTML = `
      <div class="detail-section">
        <h5>订单信息</h5>
        <p><strong>订单号:</strong> ${order.orderId}</p>
        <p><strong>订单状态:</strong> <span class="text-primary">${statusMap[order.status]}</span></p>
        <p><strong>下单时间:</strong> ${formatDate(order.createdAt)}</p>
        ${order.paidAt ? `<p><strong>付款时间:</strong> ${formatDate(order.paidAt)}</p>` : ''}
        ${order.shippedAt ? `<p><strong>发货时间:</strong> ${formatDate(order.shippedAt)}</p>` : ''}
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
            <span>${item.name} × ${item.quantity}${item.spec ? ` (${item.spec})` : ''}</span>
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
    `;

    document.getElementById('orderDetailModal').classList.add('show');
  } catch (e) {
    showToast('加载订单详情失败', 'error');
  }
}

function closeOrderDetailModal() {
  document.getElementById('orderDetailModal').classList.remove('show');
}

async function confirmPay(orderId) {
  if (!confirm('确认收到付款？')) return;
  try {
    await fetch(`${API}/api/admin/orders/${orderId}/confirm-pay`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' }
    });
    showToast('已确认付款', 'success');
    loadOrders(currentOrderPage);
    loadDashboard();
  } catch (e) {
    showToast('操作失败', 'error');
  }
}

async function deleteOrder(orderId) {
  if (!confirm('确定删除该订单？此操作不可恢复！')) return;
  try {
    await fetch(`${API}/api/admin/orders/${orderId}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    showToast('订单已删除', 'success');
    loadOrders(currentOrderPage);
    loadDashboard();
  } catch (e) {
    showToast('删除失败', 'error');
  }
}

function openShipModal(orderId) {
  document.getElementById('shipOrderId').value = orderId;
  document.getElementById('shipForm').reset();
  document.getElementById('shipModal').classList.add('show');
}

function closeShipModal() {
  document.getElementById('shipModal').classList.remove('show');
}

async function confirmShip() {
  const orderId = document.getElementById('shipOrderId').value;
  const logisticsCompany = document.querySelector('#shipForm [name="logisticsCompany"]').value;
  const logisticsNo = document.querySelector('#shipForm [name="logisticsNo"]').value;

  if (!logisticsCompany) { showToast('请选择快递公司', 'warning'); return; }
  if (!logisticsNo) { showToast('请输入运单号', 'warning'); return; }

  try {
    const res = await fetch(`${API}/api/admin/orders/${orderId}/ship`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ logisticsCompany, logisticsNo })
    });
    const result = await res.json();
    if (result.success) {
      showToast('发货成功', 'success');
      closeShipModal();
      loadOrders(currentOrderPage);
      loadDashboard();
    } else {
      showToast(result.error || '发货失败', 'error');
    }
  } catch (e) {
    showToast('发货失败', 'error');
  }
}

async function completeOrder(orderId) {
  try {
    await fetch(`${API}/api/admin/orders/${orderId}/complete`, {
      method: 'POST',
      headers: authHeaders()
    });
    showToast('订单已完成', 'success');
    loadOrders(currentOrderPage);
    loadDashboard();
  } catch (e) {
    showToast('操作失败', 'error');
  }
}

// ==================== 物流查询 ====================

let currentTrackingOrderId = '';

function viewTracking(orderId, company, trackingNo) {
  currentTrackingOrderId = orderId;
  document.getElementById('trackingOrderId').textContent = orderId;
  document.getElementById('trackingCompany').textContent = company || '-';
  document.getElementById('trackingNo').textContent = trackingNo || '-';
  document.getElementById('trackingModal').classList.add('show');
  loadTrackingData(company, trackingNo);
}

function closeTrackingModal() {
  document.getElementById('trackingModal').classList.remove('show');
  currentTrackingOrderId = '';
}

async function loadTrackingData(company, trackingNo) {
  const timeline = document.getElementById('trackingTimeline');
  
  if (!company || !trackingNo) {
    timeline.innerHTML = '<div class="text-center text-muted py-4">暂无物流信息</div>';
    return;
  }
  
  timeline.innerHTML = '<div class="text-center py-4"><i class="bi bi-arrow-repeat spin"></i> 查询中...</div>';
  
  try {
    const res = await fetch(`${API}/api/tracking?company=${encodeURIComponent(company)}&no=${encodeURIComponent(trackingNo)}&orderId=${encodeURIComponent(currentTrackingOrderId)}`);
    const data = await res.json();
    
    if (data.success && data.tracks && data.tracks.length > 0) {
      renderTrackingTimeline(data.tracks, data.courierInfo, data.source);
    } else {
      timeline.innerHTML = `
        <div class="text-center text-muted py-4">
          <i class="bi bi-inbox" style="font-size:48px;display:block;margin-bottom:10px;"></i>
          暂无物流轨迹信息<br>
          <small>快递公司：${company}，单号：${trackingNo}</small>
        </div>
      `;
    }
  } catch (e) {
    timeline.innerHTML = '<div class="text-center text-danger py-4">查询失败，请稍后重试</div>';
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
      <div class="card mb-3 border-0" style="background:linear-gradient(135deg,#e3f2fd,#f3e5f5);">
        <div class="card-body py-2 px-3 d-flex align-items-center">
          <div class="me-3">
            <div style="width:40px;height:40px;border-radius:50%;background:#1976d2;display:flex;align-items:center;justify-content:center;">
              <i class="bi bi-person-fill text-white"></i>
            </div>
          </div>
          <div class="flex-grow-1">
            <div class="fw-bold" style="font-size:14px;">派件快递员：${name || '待分配'}</div>
            ${maskedPhone ? `<div class="text-primary" style="font-size:13px;"><i class="bi bi-telephone"></i> ${maskedPhone}</div>` : ''}
          </div>
          ${maskedPhone ? `<a href="tel:${phone}" class="btn btn-primary btn-sm rounded-pill"><i class="bi bi-telephone-fill"></i> 联系</a>` : ''}
        </div>
      </div>
    `;
  }
  
  // 物流来源标识
  let sourceTag = '';
  if (source === 'kuaidi100') {
    sourceTag = '<div class="text-end mb-2" style="font-size:11px;color:#4caf50;"><i class="bi bi-patch-check-fill"></i> 数据来源：快递100实时查询</div>';
  } else if (source === 'mock_configured') {
    sourceTag = '<div class="text-end mb-2" style="font-size:11px;color:#ff9800;"><i class="bi bi-exclamation-triangle"></i> 模拟数据（单号无效或暂无轨迹）</div>';
  } else {
    sourceTag = '<div class="text-end mb-2" style="font-size:11px;color:#999;"><i class="bi bi-info-circle"></i> 模拟数据（未配置快递100 API）</div>';
  }
  
  const html = sourceTag + courierCard + tracks.map((track, index) => {
    let icon = 'bi-circle text-muted';
    if (track.status) {
      if (track.status.includes('签收')) icon = 'bi-check-circle-fill text-success';
      else if (track.status.includes('派件') || track.status.includes('派送')) icon = 'bi-truck text-warning';
      else if (track.status.includes('揽收')) icon = 'bi-box-seam-fill text-info';
      else if (track.status.includes('在途') || track.status.includes('运输')) icon = 'bi-arrow-right-circle-fill text-cyan';
    }
    if (index === 0) icon = 'bi-geo-alt-fill text-primary';
    
    return `
    <div class="timeline-item" style="display:flex;padding:15px 0;border-bottom:1px solid #eee;${index === 0 ? 'background:#e3f2fd;border-radius:8px;padding:15px;' : ''}">
      <div class="timeline-icon" style="width:40px;text-align:center;margin-right:15px;">
        <i class="bi ${icon}" style="font-size:20px;"></i>
      </div>
      <div class="timeline-content" style="flex:1;">
        <div style="font-weight:${index === 0 ? 'bold' : 'normal'};margin-bottom:5px;">${track.context}</div>
        <div style="color:#999;font-size:12px;">${track.time}</div>
        ${track.location ? `<div style="color:#999;font-size:11px;"><i class="bi bi-geo"></i> ${track.location}</div>` : ''}
      </div>
    </div>
  `}).join('');
  
  timeline.innerHTML = html;
}

function refreshTracking() {
  const company = document.getElementById('trackingCompany').textContent;
  const trackingNo = document.getElementById('trackingNo').textContent;
  if (company !== '-' && trackingNo !== '-') {
    loadTrackingData(company, trackingNo);
  }
}

// ==================== 商品管理 ====================

async function loadProducts() {
  const tbody = document.getElementById('productsTableBody');
  tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">加载中...</td></tr>';

  try {
    const res = await fetch(`${API}/api/admin/products`, { headers: authHeaders() });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error('加载商品API错误:', res.status, errData);
      tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-5">加载失败(${res.status}): ${errData.error || '认证失败，请重新登录'}</td></tr>`;
      return;
    }
    
    const products = await res.json();
    console.log('商品列表:', products);

    if (products && products.length > 0) {
      renderProductsTable(products);
    } else {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-5">暂无商品，点击上方按钮添加</td></tr>';
    }
  } catch (e) {
    console.error('加载商品失败:', e);
    tbody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-5">加载失败: ${e.message}</td></tr>`;
  }
}

function renderProductsTable(products) {
  const tbody = document.getElementById('productsTableBody');

  tbody.innerHTML = products.map(p => {
    const specs = parseSpecs(p.specs);
    const specText = specs.length > 0 ? specs.map(s => `${s.name || s.qty+s.unit}:¥${s.price}`).join(', ') : '-';

    return `
      <tr>
        <td>
          <img src="${p.image || '/img/default-product.png'}" class="product-thumb" onerror="this.src='/img/default-product.png'">
        </td>
        <td>
          <strong>${p.name}</strong>
          ${p.is_featured ? '<span class="badge badge-featured">精选</span>' : ''}
          ${p.tag ? `<span class="badge badge-tag">${p.tag}</span>` : ''}
        </td>
        <td class="text-danger">¥${p.price}</td>
        <td><small>${specText}</small></td>
        <td>${p.stock}</td>
        <td>
          <span class="badge ${p.active ? 'status-active' : 'status-inactive'}">
            ${p.active ? '上架' : '下架'}
          </span>
        </td>
        <td>
          <div class="action-btns">
            <a href="javascript:void(0)" class="action-link" onclick="editProduct(${p.id})">编辑</a>
            <a href="javascript:void(0)" class="action-link" onclick="toggleFeatured(${p.id}, ${!p.is_featured})">${p.is_featured ? '取消精选' : '设为精选'}</a>
            <a href="javascript:void(0)" class="action-link text-danger" onclick="deleteProduct(${p.id})">删除</a>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function openProductModal(productId = null) {
  editingProductId = productId;
  document.getElementById('productModalTitle').textContent = productId ? '编辑商品' : '添加商品';
  document.getElementById('productForm').reset();

  // 重置图片预览
  document.getElementById('productImageInput').value = '';
  document.querySelector('#productImageBox .upload-preview').style.display = 'none';
  document.querySelector('#productImageBox .upload-placeholder').style.display = 'flex';
  document.getElementById('productImagePreview').src = '';

  // 重置规格
  const editor = document.getElementById('specsEditor');
  editor.innerHTML = '';
  addSpecRow();

  if (!productId) {
    document.getElementById('productStock').value = 999;
    document.getElementById('productActive').checked = true;
    document.getElementById('productFeatured').checked = false;
  }

  document.getElementById('productModal').classList.add('show');
}

function closeProductModal() {
  document.getElementById('productModal').classList.remove('show');
  editingProductId = null;
}

async function editProduct(id) {
  try {
    const res = await fetch(`${API}/api/admin/products`, { headers: authHeaders() });
    const products = await res.json();
    const product = products.find(p => p.id === id);

    if (!product) {
      showToast('商品不存在', 'error');
      return;
    }

    document.getElementById('productId').value = product.id;
    document.getElementById('productName').value = product.name;
    document.getElementById('productUnit').value = product.unit;
    document.getElementById('productStock').value = product.stock;
    document.getElementById('productDesc').value = product.description || '';
    document.getElementById('productActive').checked = product.active;
    document.getElementById('productFeatured').checked = product.is_featured;

    // 图片 - 兼容 image 和 images[0]
    const imageUrl = product.image || (product.images && product.images[0]) || '';
    if (imageUrl) {
      document.getElementById('productImageInput').value = imageUrl;
      document.getElementById('productImagePreview').src = imageUrl;
      document.querySelector('#productImageBox .upload-preview').style.display = 'flex';
      document.querySelector('#productImageBox .upload-placeholder').style.display = 'none';
    }

    // 规格
    const specs = parseSpecs(product.specs);
    const editor = document.getElementById('specsEditor');
    editor.innerHTML = '';

    if (specs.length > 0) {
      console.log('Loading specs:', JSON.stringify(specs));
      specs.forEach((spec, i) => {
        console.log(`Spec[${i}]:`, spec);
        addSpecRow(spec);
      });
    } else {
      addSpecRow();
    }

    // 关键：设置 editingProductId，这样保存时会用 PUT 而不是 POST
    editingProductId = id;

    // 直接显示弹窗，不再调用 openProductModal（否则会清空规格数据）
    document.getElementById('productModal').classList.add('show');
  } catch (e) {
    showToast('加载商品失败', 'error');
  }
}

function addSpecRow(spec = {}) {
  const editor = document.getElementById('specsEditor');
  const row = document.createElement('div');
  row.className = 'spec-row';
  row.innerHTML = `
    <input type="text" name="specName[]" placeholder="规格名称" value="${spec.name || spec.sku || spec.spec || ''}">
    <input type="number" name="specPrice[]" placeholder="价格" step="0.01" value="${spec.price || ''}">
    <input type="number" name="specQty[]" placeholder="数量" value="${spec.qty || ''}">
    <select name="specUnit[]">
      <option value="斤" ${(spec.unit || '') === '斤' ? 'selected' : ''}>斤</option>
      <option value="克" ${(spec.unit || '') === '克' ? 'selected' : ''}>克</option>
      <option value="盒" ${(spec.unit || '') === '盒' ? 'selected' : ''}>盒</option>
      <option value="份" ${(spec.unit || '') === '份' ? 'selected' : ''}>份</option>
      <option value="只" ${(spec.unit || '') === '只' ? 'selected' : ''}>只</option>
      <option value="个" ${(spec.unit || '') === '个' ? 'selected' : ''}>个</option>
    </select>
    <button type="button" class="btn-remove-spec" onclick="removeSpecRow(this)">
      <i class="bi bi-trash"></i>
    </button>
  `;
  editor.appendChild(row);
}

function removeSpecRow(btn) {
  const rows = document.querySelectorAll('#specsEditor .spec-row');
  if (rows.length > 1) {
    btn.closest('.spec-row').remove();
  }
}

async function saveProduct() {
  const name = document.getElementById('productName').value.trim();
  if (!name) {
    showToast('请输入商品名称', 'warning');
    return;
  }

  const unit = document.getElementById('productUnit').value || '份';
  const stock = parseInt(document.getElementById('productStock').value) || 999;
  const description = document.getElementById('productDesc').value;
  const image = document.getElementById('productImageInput').value;
  const active = document.getElementById('productActive').checked;
  const is_featured = document.getElementById('productFeatured').checked;

  // 收集规格
  const specNames = document.querySelectorAll('[name="specName[]"]');
  const specPrices = document.querySelectorAll('[name="specPrice[]"]');
  const specQtys = document.querySelectorAll('[name="specQty[]"]');
  const specUnits = document.querySelectorAll('[name="specUnit[]"]');

  const specs = [];
  for (let i = 0; i < specNames.length; i++) {
    const price = parseFloat(specPrices[i].value);
    if (price > 0) {
      specs.push({
        name: specNames[i].value,
        price: price,
        qty: parseInt(specQtys[i].value) || 1,
        unit: specUnits[i].value
      });
    }
  }

  // 第一个规格的价格作为默认价格
  const price = specs.length > 0 ? specs[0].price : 0;

  try {
    const data = { name, unit, stock, description, image, images: image ? [image] : [], active, is_featured, specs, price };

    let url = `${API}/api/admin/products`;
    let method = 'POST';

    if (editingProductId) {
      url += `/${editingProductId}`;
      method = 'PUT';
    }

    const res = await fetch(url, {
      method,
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });

    const result = await res.json();

    if (result.success) {
      showToast(editingProductId ? '商品已更新' : '商品已添加', 'success');
      closeProductModal();
      loadProducts();
      loadDashboard();
    } else {
      showToast(result.error || '保存失败', 'error');
    }
  } catch (e) {
    showToast('保存失败', 'error');
  }
}

async function toggleFeatured(id, is_featured) {
  try {
    await fetch(`${API}/api/admin/products/${id}/featured`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_featured })
    });
    showToast(is_featured ? '已设为精选' : '已取消精选', 'success');
    loadProducts();
  } catch (e) {
    showToast('操作失败', 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('确定删除该商品？此操作不可恢复！')) return;

  try {
    await fetch(`${API}/api/admin/products/${id}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    showToast('商品已删除', 'success');
    loadProducts();
    loadDashboard();
  } catch (e) {
    showToast('删除失败', 'error');
  }
}

function openProductUpload() {
  uploadTarget = 'product';
  document.getElementById('fileInput').value = '';
  document.getElementById('uploadProgress').style.display = 'none';
  document.getElementById('uploadArea').style.display = 'flex';
  document.getElementById('uploadModal').classList.add('show');
}

// ==================== 系统设置 ====================

async function loadSettings() {
  try {
    const res = await fetch(`${API}/api/admin/settings`, authHeaders());
    const settings = await res.json();

    Object.entries(settings).forEach(([key, value]) => {
      const input = document.querySelector(`[name="${key}"]`);
      if (input) input.value = value;
    });

    // 收款码预览
    if (settings.alipay_qr) {
      document.getElementById('alipayQrInput').value = settings.alipay_qr;
      document.getElementById('alipayQrPreview').src = settings.alipay_qr;
      document.querySelector('#alipayQrBox .upload-preview').style.display = 'flex';
      document.querySelector('#alipayQrBox .upload-placeholder').style.display = 'none';
    }

    if (settings.wechat_qr) {
      document.getElementById('wechatQrInput').value = settings.wechat_qr;
      document.getElementById('wechatQrPreview').src = settings.wechat_qr;
      document.querySelector('#wechatQrBox .upload-preview').style.display = 'flex';
      document.querySelector('#wechatQrBox .upload-placeholder').style.display = 'none';
    }
  } catch (e) {
    console.error('加载设置失败:', e);
  }
}

async function handleSaveSettings(e) {
  e.preventDefault();

  const form = e.target;
  const formData = new FormData(form);
  const settings = {};

  for (const [key, value] of formData.entries()) {
    settings[key] = value;
  }

  try {
    const res = await fetch(`${API}/api/admin/settings`, {
      method: 'PUT',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });

    const result = await res.json();
    if (result.success) {
      showToast('设置已保存', 'success');
    } else {
      showToast(result.error || '保存失败', 'error');
    }
  } catch (e) {
    showToast('保存失败', 'error');
  }
}

// ==================== 账号设置 ====================

async function handleChangePassword(e) {
  e.preventDefault();

  const oldPass = document.querySelector('[name="oldPass"]').value;
  const newPass = document.querySelector('[name="newPass"]').value;
  const confirmPass = document.querySelector('[name="confirmPass"]').value;

  if (!oldPass || !newPass) {
    showToast('请填写所有字段', 'warning');
    return;
  }

  if (newPass !== confirmPass) {
    showToast('两次输入的密码不一致', 'warning');
    return;
  }

  if (newPass.length < 6) {
    showToast('密码长度不能少于6位', 'warning');
    return;
  }

  try {
    const res = await fetch(`${API}/api/admin/password`, {
      method: 'POST',
      headers: { ...authHeaders(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ oldPass, newPass })
    });

    const result = await res.json();

    if (result.success) {
      showToast('密码修改成功', 'success');
      document.getElementById('passwordForm').reset();
    } else {
      showToast(result.error || '修改失败', 'error');
    }
  } catch (e) {
    showToast('修改失败', 'error');
  }
}

// ==================== 文件上传 ====================

function openUpload(target) {
  uploadTarget = target;
  document.getElementById('fileInput').value = '';
  document.getElementById('uploadProgress').style.display = 'none';
  document.getElementById('uploadArea').style.display = 'flex';
  document.getElementById('uploadModal').classList.add('show');
}

function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('show');
}

async function uploadFile(file) {
  const formData = new FormData();
  formData.append('file', file);

  document.getElementById('uploadArea').style.display = 'none';
  document.getElementById('uploadProgress').style.display = 'block';
  document.getElementById('uploadStatus').textContent = '上传中...';
  document.getElementById('progressFill').style.width = '0%';

  try {
    const xhr = new XMLHttpRequest();

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = (e.loaded / e.total * 100).toFixed(0);
        document.getElementById('progressFill').style.width = percent + '%';
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        const result = JSON.parse(xhr.responseText);
        if (result.success) {
          document.getElementById('uploadStatus').textContent = '上传成功！';
          document.getElementById('progressFill').style.width = '100%';

          setTimeout(() => {
            closeUploadModal();
            applyUploadedImage(result.url, uploadTarget);
          }, 500);
        } else {
          document.getElementById('uploadStatus').textContent = result.error || '上传失败';
        }
      } else {
        document.getElementById('uploadStatus').textContent = '上传失败';
      }
    };

    xhr.onerror = () => {
      document.getElementById('uploadStatus').textContent = '上传失败，请重试';
    };

    xhr.open('POST', `${API}/api/admin/upload`);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.send(formData);
  } catch (e) {
    document.getElementById('uploadStatus').textContent = '上传失败';
  }
}

function applyUploadedImage(url, target) {
  switch (target) {
    case 'alipay':
      document.getElementById('alipayQrInput').value = url;
      document.getElementById('alipayQrPreview').src = url;
      document.querySelector('#alipayQrBox .upload-preview').style.display = 'flex';
      document.querySelector('#alipayQrBox .upload-placeholder').style.display = 'none';
      break;
    case 'wechat':
      document.getElementById('wechatQrInput').value = url;
      document.getElementById('wechatQrPreview').src = url;
      document.querySelector('#wechatQrBox .upload-preview').style.display = 'flex';
      document.querySelector('#wechatQrBox .upload-placeholder').style.display = 'none';
      break;
    case 'product':
      document.getElementById('productImageInput').value = url;
      document.getElementById('productImagePreview').src = url;
      document.querySelector('#productImageBox .upload-preview').style.display = 'flex';
      document.querySelector('#productImageBox .upload-placeholder').style.display = 'none';
      break;
  }
}

function removeImage(target) {
  const inputId = target === 'alipay' ? 'alipayQrInput' : 'wechatQrInput';
  document.getElementById(inputId).value = '';
  document.querySelector(`#${target}QrBox .upload-preview`).style.display = 'none';
  document.querySelector(`#${target}QrBox .upload-placeholder`).style.display = 'flex';
}

// 图片迁移（旧文件路径→base64）
async function migrateImages() {
  if (!confirm('确认迁移所有旧图片？迁移后图片将转为base64格式，永久保存。')) return;
  try {
    const res = await fetch(`${API}/api/admin/migrate-images`, { method: 'POST', headers: authHeaders() });
    const result = await res.json();
    if (result.success) {
      showToast(`迁移完成，共处理 ${result.migrated} 个图片`, 'success');
      loadProducts();
    } else {
      showToast(result.error || '迁移失败', 'error');
    }
  } catch(e) {
    showToast('迁移失败', 'error');
  }
}

// ==================== 工具函数 ====================

function authHeaders() {
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

function parseSpecs(specs) {
  if (!specs) return [];
  if (typeof specs === 'string') {
    try {
      return JSON.parse(specs);
    } catch (e) {
      return [];
    }
  }
  return specs;
}

function parseItems(items) {
  if (!items) return [];
  if (typeof items === 'string') {
    try {
      return JSON.parse(items);
    } catch (e) {
      return [];
    }
  }
  return items;
}

function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN') + ' ' + date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
}

function updateTime() {
  const now = new Date();
  document.getElementById('currentTime').textContent = now.toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
}

function toggleSidebar() {
  document.getElementById('sidebar').classList.toggle('collapsed');
}

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
