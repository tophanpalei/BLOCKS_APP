/* ===== ADMIN.JS — Admin dashboard, products, orders, customers, reports ===== */

// ── Auth ───────────────────────────────────────────────────────────────────
const ADMIN_CREDENTIALS = { username: 'admin', password: 'admin123' };

function getAdminCredentials() {
  return Store.get('bm_admin_creds', ADMIN_CREDENTIALS);
}

function isAdminLoggedIn() {
  return Store.get('bm_admin_session', false);
}

function adminLogin(username, password) {
  const creds = getAdminCredentials();
  if (username === creds.username && password === creds.password) {
    Store.set('bm_admin_session', true);
    return true;
  }
  return false;
}

function adminLogout() {
  Store.remove('bm_admin_session');
  window.location.href = '../admin/admin.html';
}

// ── Guard ──────────────────────────────────────────────────────────────────
function requireAdminAuth() {
  if (!isAdminLoggedIn()) {
    window.location.href = '../admin/admin.html';
    return false;
  }
  return true;
}

// ── LOGIN PAGE ──────────────────────────────────────────────────────────────
function initLoginPage() {
  if (isAdminLoggedIn()) {
    window.location.href = '../dashboard/dashboard.html';
    return;
  }

  const form = document.getElementById('admin-login-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('admin-username').value.trim();
    const password = document.getElementById('admin-password').value;

    if (adminLogin(username, password)) {
      showSpinner('Logging in...');
      setTimeout(() => {
        hideSpinner();
        window.location.href = '../orders/orders.html';
      }, 800);
    } else {
      const errEl = document.getElementById('login-error');
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = 'Invalid username or password.';
      }
    }
  });
}

// ── DASHBOARD ──────────────────────────────────────────────────────────────
function initDashboard() {
  if (!requireAdminAuth()) return;

  const orders = getOrders();
  const products = getProducts();

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.status === 'Pending').length;
  const confirmedOrders = orders.filter(o => o.status === 'Confirmed').length;
  const deliveredOrders = orders.filter(o => o.status === 'Delivered').length;
  const cancelledOrders = orders.filter(o => o.status === 'Cancelled').length;
  const totalRevenue = orders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);
  const todayOrders = orders.filter(o => {
    const d = new Date(o.date);
    const today = new Date();
    return d.toDateString() === today.toDateString();
  }).length;

  const customers = getUniqueCustomers();

  setEl('stat-total-orders', totalOrders);
  setEl('stat-total-products', products.length);
  setEl('stat-pending-orders', pendingOrders);
  setEl('stat-delivered', deliveredOrders);
  setEl('stat-revenue', formatRupees(totalRevenue));
  setEl('stat-customers', customers.length);
  setEl('stat-today', todayOrders);
  setEl('stat-confirmed', confirmedOrders);
  setEl('stat-cancelled', cancelledOrders);

  renderRecentOrders();
  renderTopProducts();
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function getUniqueCustomers() {
  const orders = getOrders();
  const phones = new Set();
  orders.forEach(o => phones.add(o.customer.phone));
  return [...phones].map(phone => {
    const order = orders.find(o => o.customer.phone === phone);
    return { name: order.customer.name, phone, orders: orders.filter(o => o.customer.phone === phone).length };
  });
}

function renderRecentOrders() {
  const container = document.getElementById('recent-orders-table');
  if (!container) return;

  const recent = getOrders().slice(0, 5);

  if (recent.length === 0) {
    container.innerHTML = `<div class="no-results" style="padding:2rem"><div class="no-results-icon">📦</div><p>No orders yet</p></div>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th><th>Date</th>
      </tr></thead>
      <tbody>
        ${recent.map(o => `
          <tr>
            <td><strong>${o.id}</strong></td>
            <td>${o.customer.name}</td>
            <td>${formatRupees(o.total)}</td>
            <td>${statusBadge(o.status)}</td>
            <td>${new Date(o.date).toLocaleDateString('en-IN')}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

function renderTopProducts() {
  const container = document.getElementById('top-products-chart');
  if (!container) return;

  const orders = getOrders();
  const productSales = {};

  orders.forEach(o => {
    o.items.forEach(item => {
      productSales[item.name] = (productSales[item.name] || 0) + item.qty;
    });
  });

  const sorted = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const max = sorted[0]?.[1] || 1;

  if (sorted.length === 0) {
    container.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:1rem">No sales data yet</div>';
    return;
  }

  container.innerHTML = `
    <div class="chart-bar-list">
      ${sorted.map(([name, qty]) => `
        <div class="chart-bar-item">
          <div class="chart-bar-label">
            <span>${name}</span>
            <span>${qty} units</span>
          </div>
          <div class="chart-bar-track">
            <div class="chart-bar-fill" style="width:${Math.round((qty / max) * 100)}%"></div>
          </div>
        </div>`).join('')}
    </div>`;
}

function statusBadge(status) {
  const map = {
    Pending: 'status-pending',
    Confirmed: 'status-confirmed',
    Delivered: 'status-delivered',
    Cancelled: 'status-cancelled'
  };
  return `<span class="status-badge ${map[status] || ''}">${status}</span>`;
}

// ── PRODUCT MANAGEMENT ──────────────────────────────────────────────────────
let editingProductId = null;

function initProductManagement() {
  if (!requireAdminAuth()) return;
  renderAdminProducts();
}

function renderAdminProducts(filter = '') {
  const container = document.getElementById('admin-products-table');
  if (!container) return;

  let products = getProducts();
  if (filter) {
    const q = filter.toLowerCase();
    products = products.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
  }

  if (products.length === 0) {
    container.innerHTML = `<div class="no-results"><div class="no-results-icon">📦</div><p>No products found</p></div>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>Product</th><th>Category</th><th>Price</th><th>Stock</th><th>Actions</th>
      </tr></thead>
      <tbody>
        ${products.map(p => `
          <tr>
            <td>
              <div class="product-admin-row">
                <div class="product-thumb-admin" style="overflow:hidden;border-radius:6px">
                  ${p.image
                    ? `<img src="${p.image}" alt="${p.name}" style="width:100%;height:100%;object-fit:cover;border-radius:6px">`
                    : (p.emoji || '🧱')}
                </div>
                <div>
                  <div style="font-weight:700">${p.name}</div>
                  <div style="font-size:0.78rem;color:var(--text-muted)">${p.description.substring(0, 45)}...</div>
                </div>
              </div>
            </td>
            <td><span style="text-transform:capitalize">${p.category}</span></td>
            <td><strong>${formatRupees(p.price)}</strong> / ${p.unit}</td>
            <td>
              <div>
                <div style="display:flex;align-items:center;gap:0.5rem">
                  <input type="number" value="${p.stock}" min="0"
                    style="width:70px;padding:0.3rem 0.5rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.85rem;text-align:center;background:var(--bg);color:var(--text)"
                    onchange="quickUpdateStock(${p.id}, this.value)" title="Edit stock">
                  <span style="font-size:0.8rem;color:${p.stock > 0 ? '#27ae60' : '#e74c3c'}">${p.stock > 0 ? '✓' : '✗'}</span>
                </div>
                ${p.stock === 0 && p.outOfStockReason ? `<div style="font-size:0.75rem;color:var(--warning);margin-top:0.25rem">⚠️ ${p.outOfStockReason}</div>` : ''}
              </div>
            </td>
            <td>
              <div class="action-btns">
                <button class="btn-action btn-edit" onclick="editProduct(${p.id})">✏️ Edit</button>
                <button class="btn-action btn-delete" onclick="deleteProduct(${p.id})">🗑 Delete</button>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

window.openAddProduct = function () {
  editingProductId = null;
  document.getElementById('product-form-title').textContent = 'Add New Product';
  document.getElementById('product-form').reset();
  if (typeof clearProductImage === 'function') clearProductImage();
  document.getElementById('product-modal-overlay').classList.add('active');
};

window.editProduct = function (productId) {
  const product = getProductById(productId);
  if (!product) return;

  editingProductId = productId;
  document.getElementById('product-form-title').textContent = 'Edit Product';

  document.getElementById('pf-name').value = product.name;
  document.getElementById('pf-category').value = product.category;
  document.getElementById('pf-price').value = product.price;
  document.getElementById('pf-unit').value = product.unit;
  document.getElementById('pf-stock').value = product.stock;
  document.getElementById('pf-desc').value = product.description;
  document.getElementById('pf-dimensions').value = product.dimensions || '';
  document.getElementById('pf-weight').value = product.weight || '';
  document.getElementById('pf-emoji').value = product.emoji || '';
  document.getElementById('pf-oos-reason').value = product.outOfStockReason || '';
  // Show reason field if stock is 0
  const reasonGroup = document.getElementById('out-of-stock-reason-group');
  if (reasonGroup) reasonGroup.style.display = product.stock === 0 ? 'block' : 'none';
  // Load product image
  if (typeof loadProductImageIntoForm === 'function') loadProductImageIntoForm(product.image || null);

  document.getElementById('product-modal-overlay').classList.add('active');
};

window.closeProductForm = function () {
  document.getElementById('product-modal-overlay').classList.remove('active');
};

window.saveProduct = function () {
  const name = document.getElementById('pf-name').value.trim();
  const category = document.getElementById('pf-category').value;
  const price = parseFloat(document.getElementById('pf-price').value);
  const unit = document.getElementById('pf-unit').value.trim() || 'Piece';
  const stock = parseInt(document.getElementById('pf-stock').value);
  const description = document.getElementById('pf-desc').value.trim();
  const dimensions = document.getElementById('pf-dimensions').value.trim();
  const weight = document.getElementById('pf-weight').value.trim();
  const emoji = document.getElementById('pf-emoji').value.trim() || '🧱';
  const outOfStockReason = stock === 0 ? (document.getElementById('pf-oos-reason').value.trim()) : '';
  const imageData = (document.getElementById('pf-image-data') || {}).value || null;

  if (!name || !category || isNaN(price) || isNaN(stock) || !description) {
    showToast('Please fill all required fields', 'error');
    return;
  }

  const products = getProducts();

  if (editingProductId) {
    const idx = products.findIndex(p => p.id === editingProductId);
    if (idx !== -1) {
      products[idx] = { ...products[idx], name, category, price, unit, stock, description, dimensions, weight, emoji, outOfStockReason, image: imageData || products[idx].image || null };
    }
    showToast('Product updated successfully!', 'success');
  } else {
    const newId = products.length > 0 ? Math.max(...products.map(p => p.id)) + 1 : 1;
    products.push({ id: newId, name, category, price, unit, stock, description, dimensions, weight, emoji, outOfStockReason, image: imageData || null, featured: false });
    showToast('Product added successfully!', 'success');
  }

  saveProducts(products);
  closeProductForm();
  renderAdminProducts();
};

window.deleteProduct = function (productId) {
  if (!confirmAction('Are you sure you want to delete this product?')) return;
  const products = getProducts().filter(p => p.id !== productId);
  saveProducts(products);
  showToast('Product deleted', 'info');
  renderAdminProducts();
};

// ── SHARED WHATSAPP MESSAGE BUILDER ─────────────────────────────────────────
function buildOrderWhatsAppMsg(order, newStatus, s) {
  const c          = order.customer || {};
  const itemLines  = (order.items || []).map(i =>
    `  • ${i.name} × ${i.qty} — ₹${(i.total || 0).toLocaleString('en-IN')}`).join('\n');
  const deliveryLine = order.delivery === 0 ? 'Free 🎉' : `₹${(order.delivery || 0).toLocaleString('en-IN')}`;
  const labourLine   = order.labour > 0 ? `\nLabour (Loading/Unloading): ₹${order.labour.toLocaleString('en-IN')}` : '';
  const address      = [c.address, c.village, c.district, c.pin].filter(Boolean).join(', ');
  const dateStr      = new Date(order.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });

  const invoiceBlock =
`📋 *Order ID:* ${order.id}
📅 *Date:* ${dateStr}

🛒 *Items Ordered*
${itemLines}

💰 *Invoice Summary*
Subtotal: ₹${(order.subtotal || order.total || 0).toLocaleString('en-IN')}
Delivery: ${deliveryLine}${labourLine}
*Total: ₹${(order.total || 0).toLocaleString('en-IN')}*
Payment: ${c.paymentMethod || 'N/A'}

📍 *Delivery Address*
${address}`;

  const statusMap = {
    Confirmed: {
      header: `🧱 *${s.storeName} — Order Confirmed!* 📦`,
      body:   `Hello *${c.name}*! Your order has been *confirmed* and is being processed.`,
      footer: `⏰ Estimated delivery: *3–5 working days*\n\nFor queries, call: *${s.phone1}*\n\n_Thank you for choosing ${s.storeName}! 🙏_`
    },
    Delivered: {
      header: `🚚 *${s.storeName} — Order Delivered!* 📦`,
      body:   `Hello *${c.name}*! Your order has been *delivered* successfully. 🎉`,
      footer: `⏰ Estimated delivery: *Delivered*\n\nFor queries, call: *${s.phone1}*\n\n_Thank you for choosing ${s.storeName}! 🙏_`
    },
    Cancelled: {
      header: `❌ *${s.storeName} — Order Cancelled* 📦`,
      body:   `Hello *${c.name}*! We're sorry, your order has been *cancelled*.`,
      footer: `For queries, call: *${s.phone1}*\n\n_Thank you for choosing ${s.storeName}! 🙏_`
    },
    Pending: {
      header: `⏳ *${s.storeName} — Order Pending* 📦`,
      body:   `Hello *${c.name}*! Your order is currently *pending* review.`,
      footer: `⏰ We will contact you shortly.\n\nFor queries, call: *${s.phone1}*\n\n_Thank you for choosing ${s.storeName}! 🙏_`
    }
  };

  const t = statusMap[newStatus] || {
    header: `🧱 *${s.storeName} — Order Update* 📦`,
    body:   `Hello *${c.name}*! Your order status has been updated to *${newStatus}*.`,
    footer: `For queries, call: *${s.phone1}*\n\n_Thank you for choosing ${s.storeName}! 🙏_`
  };

  return `${t.header}\n\n${t.body}\n\n${invoiceBlock}\n\n${t.footer}`;
}

// ── ORDER MANAGEMENT ────────────────────────────────────────────────────────
function initOrderManagement() {
  if (!requireAdminAuth()) return;
  renderAdminOrders();
}

function renderAdminOrders(filters = {}) {
  const container = document.getElementById('admin-orders-table');
  if (!container) return;

  let orders = getOrders();
  const { orderId = '', customer = '', date = '', status = '', payment = '' } = filters;

  if (orderId) {
    const q = orderId.toLowerCase();
    orders = orders.filter(o => o.id.toLowerCase().includes(q));
  }

  if (customer) {
    const q = customer.toLowerCase();
    orders = orders.filter(o =>
      o.customer.name.toLowerCase().includes(q) ||
      o.customer.phone.includes(q)
    );
  }

  if (status) {
    orders = orders.filter(o => o.status === status);
  }

  if (date) {
    orders = orders.filter(o => {
      const d = new Date(o.date);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}` === date;
    });
  }

  if (payment) {
    orders = orders.filter(o => (o.customer?.paymentMethod || o.paymentMethod || '').toLowerCase() === payment.toLowerCase());
  }

  if (orders.length === 0) {
    container.innerHTML = `<div class="no-results"><div class="no-results-icon">📦</div><p>No orders found</p></div>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th style="width:32px"><input type="checkbox" onchange="if(typeof toggleAllOrders==='function')toggleAllOrders(this)" style="cursor:pointer"></th>
        <th>Order ID</th><th>Customer</th><th>Items</th><th>Total</th><th>Payment</th><th>Status</th><th>Date</th><th>Action</th>
      </tr></thead>
      <tbody>
        ${orders.map(o => `
          <tr>
            <td><input type="checkbox" class="order-checkbox" value="${o.id}" onchange="if(typeof updateBulkBar==='function')updateBulkBar()" style="cursor:pointer"></td>
            <td><strong>${o.id}</strong></td>
            <td>
              <div style="font-weight:700">${o.customer.name}</div>
              <div style="font-size:0.78rem;color:var(--text-muted)">${o.customer.phone}</div>
              <div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.2rem;max-width:180px;line-height:1.4">
                📍 ${[o.customer.address, o.customer.village, o.customer.district, o.customer.pin].filter(Boolean).join(', ')}
              </div>
            </td>
            <td>
              ${o.items.map(i => `<div style="font-size:0.82rem">${i.name} × ${i.qty}</div>`).join('')}
            </td>
            <td><strong>${formatRupees(o.total)}</strong></td>
            <td style="font-size:0.85rem">${o.paymentMethod || 'N/A'}</td>
            <td>
              ${statusBadge(o.status)}
              ${o.status === 'Cancelled' && o.cancellationReason
                ? `<div style="font-size:0.75rem;color:var(--danger);margin-top:0.3rem;max-width:140px">⚠️ ${o.cancellationReason}</div>`
                : ''}
              ${o.notes ? `<div style="font-size:0.75rem;color:#2980b9;margin-top:0.3rem;max-width:140px">📝 ${o.notes}</div>` : ''}
            </td>
            <td style="font-size:0.85rem">${new Date(o.date).toLocaleDateString('en-IN')}</td>
            <td>
              <div style="display:flex;flex-direction:column;gap:0.4rem">
                <select class="status-select" onchange="updateOrderStatus('${o.id}', this.value)">
                  <option value="Pending" ${o.status === 'Pending' ? 'selected' : ''}>Pending</option>
                  <option value="Confirmed" ${o.status === 'Confirmed' ? 'selected' : ''}>Confirmed</option>
                  <option value="Delivered" ${o.status === 'Delivered' ? 'selected' : ''}>Delivered</option>
                  <option value="Cancelled" ${o.status === 'Cancelled' ? 'selected' : ''}>Cancelled</option>
                </select>
                <div style="display:flex;gap:0.3rem">
                  <button onclick="openEditOrder('${o.id}')" class="btn-action btn-edit" style="padding:0.3rem 0.5rem;font-size:0.75rem" title="Edit Order">✏️</button>
                  <button onclick="printInvoice('${o.id}')" class="btn-action btn-edit" style="padding:0.3rem 0.5rem;font-size:0.75rem" title="Print Invoice">🖨️</button>
                  <button onclick="addOrderNote('${o.id}')" class="btn-action" style="padding:0.3rem 0.5rem;font-size:0.75rem;background:var(--bg);border:1px solid var(--border)" title="Add Note">${o.notes ? '📝✓' : '📝'}</button>
                  ${o.status === 'Cancelled' ? `<button onclick="deleteOrder('${o.id}')" class="btn-action btn-delete" style="padding:0.3rem 0.5rem;font-size:0.75rem" title="Delete Order">🗑️</button>` : ''}
                </div>
              </div>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

window.updateOrderStatus = function (orderId, newStatus) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;

  if (newStatus === 'Cancelled') {
    const reason = window.prompt(
      `Reason for cancelling order ${orderId}?\n(This will be shown to the customer)`,
      ''
    );
    // If admin hits Cancel on the prompt, revert the dropdown and abort
    if (reason === null) {
      renderAdminOrders();
      return;
    }
    order.cancellationReason = reason.trim() || 'Order cancelled by store.';
    // Restore stock for cancelled order
    const products = getProducts();
    order.items.forEach(item => {
      const p = products.find(p => p.id === item.productId);
      if (p) p.stock += item.qty;
    });
    saveProducts(products);
  } else {
    // Clear any previous cancellation reason if status is changed away from Cancelled
    order.cancellationReason = '';
  }

  order.status = newStatus;
  saveOrders(orders);
  showToast(`Order ${orderId} marked as ${newStatus}`, 'success');

  // Notify customer on WhatsApp for key status changes
  if (newStatus === 'Confirmed' || newStatus === 'Delivered' || newStatus === 'Cancelled') {
    const s   = getSettings();
    const msg = buildOrderWhatsAppMsg(order, newStatus, s);
    const c   = order.customer || {};
    const phone   = (c.phone || '').replace(/\D/g, '');
    const waPhone = phone.startsWith('91') ? phone : '91' + phone.replace(/^0+/, '');
    if (window.confirm(`Send WhatsApp ${newStatus} message to ${c.name} (${c.phone})?`)) {
      window.open(`https://wa.me/${waPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    }
  }

  if (typeof applyFilters === 'function') applyFilters(); else renderAdminOrders();
};

// ── CUSTOMER LIST ────────────────────────────────────────────────────────────
function initCustomerList() {
  if (!requireAdminAuth()) return;
  renderCustomers();
}

function renderCustomers(filter = '') {
  const container = document.getElementById('customers-table');
  if (!container) return;

  let customers = getUniqueCustomers();

  if (filter) {
    const q = filter.toLowerCase();
    customers = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }

  if (customers.length === 0) {
    container.innerHTML = `<div class="no-results"><div class="no-results-icon">👥</div><p>No customers yet</p></div>`;
    return;
  }

  container.innerHTML = `
    <table class="admin-table">
      <thead><tr>
        <th>#</th><th>Customer Name</th><th>Phone</th><th>Address</th><th>Total Orders</th><th>Total Spent</th><th>Details</th>
      </tr></thead>
      <tbody>
        ${customers.map((c, i) => {
          const spent = getOrders()
            .filter(o => o.customer.phone === c.phone && o.status !== 'Cancelled')
            .reduce((s, o) => s + o.total, 0);
          const sample = getOrders().find(o => o.customer.phone === c.phone);
          const addr = sample ? `${sample.customer.address || ''}, ${sample.customer.village || ''}, ${sample.customer.district || ''} — ${sample.customer.pin || ''}` : '—';
          return `
            <tr>
              <td>${i + 1}</td>
              <td><strong>${c.name}</strong></td>
              <td>${c.phone}</td>
              <td style="font-size:0.82rem;color:var(--text-muted);max-width:200px">${addr}</td>
              <td>${c.orders} order${c.orders !== 1 ? 's' : ''}</td>
              <td>${formatRupees(spent)}</td>
              <td><button class="btn-action btn-edit" onclick="showCustomerDetail('${c.phone}')">👤 View</button></td>
            </tr>`;
        }).join('')}
      </tbody>
    </table>`;
}

// ── REPORTS ────────────────────────────────────────────────────────────────
function initReports() {
  if (!requireAdminAuth()) return;
  renderReports();
}

function renderReports() {
  const orders = getOrders();
  const products = getProducts();

  // Revenue chart by day (last 7 days)
  const dailyRevContainer = document.getElementById('daily-revenue-chart');
  if (dailyRevContainer) {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
      const rev = orders.filter(o => {
        const od = new Date(o.date);
        return od.toDateString() === d.toDateString() && o.status !== 'Cancelled';
      }).reduce((s, o) => s + o.total, 0);
      days.push({ label, rev });
    }
    const maxRev = Math.max(...days.map(d => d.rev), 1);
    dailyRevContainer.innerHTML = `
      <div class="chart-bar-list">
        ${days.map(d => `
          <div class="chart-bar-item">
            <div class="chart-bar-label"><span>${d.label}</span><span>${formatRupees(d.rev)}</span></div>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((d.rev / maxRev) * 100)}%"></div></div>
          </div>`).join('')}
      </div>`;
  }

  // Order status breakdown
  const statusContainer = document.getElementById('status-breakdown-chart');
  if (statusContainer) {
    const statuses = ['Pending', 'Confirmed', 'Delivered', 'Cancelled'];
    const counts = statuses.map(s => ({ label: s, count: orders.filter(o => o.status === s).length }));
    const maxCount = Math.max(...counts.map(c => c.count), 1);
    statusContainer.innerHTML = `
      <div class="chart-bar-list">
        ${counts.map(c => `
          <div class="chart-bar-item">
            <div class="chart-bar-label"><span>${c.label}</span><span>${c.count} orders</span></div>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((c.count / maxCount) * 100)}%"></div></div>
          </div>`).join('')}
      </div>`;
  }

  // Top products
  const topContainer = document.getElementById('top-products-report');
  if (topContainer) {
    const productSales = {};
    orders.forEach(o => {
      o.items.forEach(item => {
        productSales[item.name] = (productSales[item.name] || 0) + item.qty;
      });
    });
    const sorted = Object.entries(productSales).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const maxSale = sorted[0]?.[1] || 1;
    if (sorted.length === 0) {
      topContainer.innerHTML = '<div style="color:var(--text-muted);text-align:center;padding:1rem">No sales data yet</div>';
    } else {
      topContainer.innerHTML = `
        <div class="chart-bar-list">
          ${sorted.map(([name, qty]) => `
            <div class="chart-bar-item">
              <div class="chart-bar-label"><span>${name}</span><span>${qty} units sold</span></div>
              <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${Math.round((qty / maxSale) * 100)}%"></div></div>
            </div>`).join('')}
        </div>`;
    }
  }

  // Summary stats
  const totalRevenue = orders.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);
  const today = orders.filter(o => {
    const d = new Date(o.date);
    return d.toDateString() === new Date().toDateString();
  });
  const todayRevenue = today.filter(o => o.status !== 'Cancelled').reduce((s, o) => s + o.total, 0);

  setEl('report-total-orders', orders.length);
  setEl('report-total-revenue', formatRupees(totalRevenue));
  setEl('report-today-orders', today.length);
  setEl('report-today-revenue', formatRupees(todayRevenue));
  setEl('report-products', products.length);
  setEl('report-customers', getUniqueCustomers().length);
}

// ── DELETE ORDERS ────────────────────────────────────────────────────────────
window.deleteOrder = function (orderId) {
  if (!confirmAction(`Permanently delete order ${orderId}? This cannot be undone.`)) return;
  const orders = getOrders().filter(o => o.id !== orderId);
  saveOrders(orders);
  showToast(`Order ${orderId} deleted`, 'info');
  if (typeof applyFilters === 'function') applyFilters(); else renderAdminOrders();
};

window.deleteAllCancelled = function () {
  const orders = getOrders();
  const cancelled = orders.filter(o => o.status === 'Cancelled');
  if (cancelled.length === 0) { showToast('No cancelled orders to delete', 'info'); return; }
  if (!confirmAction(`Permanently delete all ${cancelled.length} cancelled order(s)? This cannot be undone.`)) return;
  saveOrders(orders.filter(o => o.status !== 'Cancelled'));
  showToast(`${cancelled.length} cancelled order(s) deleted`, 'success');
  if (typeof applyFilters === 'function') applyFilters(); else renderAdminOrders();
};

// ── EXPORT ORDERS TO CSV ─────────────────────────────────────────────────────
window.exportOrdersCSV = function () {
  // Apply current filters if on orders page
  let orders = getOrders();
  const orderId  = document.getElementById('filter-order-id')?.value.trim() || '';
  const customer = document.getElementById('filter-customer')?.value.trim() || '';
  const date     = document.getElementById('filter-date')?.value || '';
  const status   = document.getElementById('filter-status')?.value || '';
  const payment  = document.getElementById('filter-payment')?.value || '';
  if (orderId)  { const q = orderId.toLowerCase();  orders = orders.filter(o => o.id.toLowerCase().includes(q)); }
  if (customer) { const q = customer.toLowerCase(); orders = orders.filter(o => o.customer.name.toLowerCase().includes(q) || o.customer.phone.includes(q)); }
  if (status)   orders = orders.filter(o => o.status === status);
  if (date)     orders = orders.filter(o => { const d = new Date(o.date); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` === date; });
  if (payment)  orders = orders.filter(o => (o.customer?.paymentMethod || o.paymentMethod || '').toLowerCase() === payment.toLowerCase());
  if (orders.length === 0) { showToast('No orders match current filters', 'warning'); return; }
  const rows = [['Order ID','Date','Customer','Phone','Address','Village','District','PIN','Items','Subtotal','Delivery','Total','Status','Payment','Notes']];
  orders.forEach(o => {
    rows.push([
      o.id,
      new Date(o.date).toLocaleDateString('en-IN'),
      o.customer.name,
      o.customer.phone,
      o.customer.address || '',
      o.customer.village || '',
      o.customer.district || '',
      o.customer.pin || '',
      o.items.map(i => `${i.name}x${i.qty}`).join('; '),
      o.subtotal || o.total,
      o.delivery || 0,
      o.total,
      o.status,
      o.customer.paymentMethod || o.paymentMethod || '',
      o.notes || ''
    ]);
  });
  const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `orders_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast(`Exported ${orders.length} orders to CSV`, 'success');
};

// ── PRINT INVOICE ────────────────────────────────────────────────────────────
window.printInvoice = function (orderId) {
  const order = getOrders().find(o => o.id === orderId);
  if (!order) return;
  const s = getSettings();
  const w = window.open('', '_blank', 'width=720,height=900');
  w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Invoice ${order.id}</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:Arial,sans-serif;padding:2rem;color:#333;font-size:0.9rem}
  .hdr{display:flex;justify-content:space-between;margin-bottom:2rem;padding-bottom:1rem;border-bottom:2px solid #e65c00}
  table{width:100%;border-collapse:collapse;margin:1rem 0}th,td{padding:0.6rem 0.8rem;border:1px solid #ddd;text-align:left}
  th{background:#f8f8f8;font-weight:700}tfoot td{font-weight:700;background:#f8f8f8}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem}
  .box{background:#f8f8f8;padding:1rem;border-radius:6px}.box h4{color:#e65c00;margin-bottom:0.5rem}
  .footer{margin-top:2rem;padding-top:1rem;border-top:1px solid #eee;font-size:0.8rem;color:#888;text-align:center}
  @media print{body{padding:1rem}}</style>
  </head><body>
  <div class="hdr">
    <div>
      <div style="font-size:1.4rem;font-weight:800;color:#e65c00">🧱 ${s.storeName}</div>
      <div style="color:#666;margin-top:0.3rem">${s.address}, ${s.city}</div>
      <div style="color:#666">${s.phone1} | ${s.email1}</div>
    </div>
    <div style="text-align:right">
      <div style="font-size:1.2rem;font-weight:800">INVOICE</div>
      <div style="font-size:1rem;font-weight:700;color:#e65c00">${order.id}</div>
      <div style="color:#666;margin-top:0.3rem">${new Date(order.date).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'})}</div>
      <div style="margin-top:0.4rem;background:#27ae60;color:white;display:inline-block;padding:0.2rem 0.8rem;border-radius:20px;font-size:0.8rem;font-weight:700">${order.status}</div>
    </div>
  </div>
  <div class="grid">
    <div class="box"><h4>Bill To</h4>
      <div style="font-weight:700">${order.customer.name}</div>
      <div>${order.customer.phone}</div>
      <div>${order.customer.address || ''}</div>
      <div>${[order.customer.village, order.customer.district].filter(Boolean).join(', ')}</div>
      <div>${order.customer.pin || ''}</div>
    </div>
    <div class="box"><h4>Payment</h4>
      <div>${order.customer.paymentMethod || order.paymentMethod || 'N/A'}</div>
    </div>
  </div>
  <table>
    <thead><tr><th>#</th><th>Item</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead>
    <tbody>${order.items.map((i, idx) => `<tr><td>${idx+1}</td><td>${i.name}</td><td>${i.qty}</td><td>₹${i.price.toLocaleString('en-IN')}</td><td>₹${i.total.toLocaleString('en-IN')}</td></tr>`).join('')}</tbody>
    <tfoot>
      <tr><td colspan="4" style="text-align:right">Subtotal</td><td>₹${(order.subtotal||order.total).toLocaleString('en-IN')}</td></tr>
      <tr><td colspan="4" style="text-align:right">Delivery</td><td>${order.delivery === 0 ? '<span style="color:#27ae60">Free</span>' : '₹' + (order.delivery || 299).toLocaleString('en-IN')}</td></tr>
      <tr><td colspan="4" style="text-align:right;font-size:1rem">Grand Total</td><td style="font-size:1rem;color:#e65c00">₹${order.total.toLocaleString('en-IN')}</td></tr>
    </tfoot>
  </table>
  ${order.notes ? `<div style="margin-top:1rem;padding:0.8rem;background:#fff3cd;border-radius:6px"><strong>📝 Note:</strong> ${order.notes}</div>` : ''}
  <div class="footer">Thank you for choosing ${s.storeName}! Queries: ${s.phone1}</div>
  <script>window.onload=function(){window.print()}<\/script>
  </body></html>`);
  w.document.close();
};

// ── ORDER NOTE ───────────────────────────────────────────────────────────────
window.addOrderNote = function (orderId) {
  const orders = getOrders();
  const order = orders.find(o => o.id === orderId);
  if (!order) return;
  const note = window.prompt(`Note for order ${orderId}:`, order.notes || '');
  if (note === null) return;
  order.notes = note.trim();
  saveOrders(orders);
  showToast('Note saved', 'success');
  if (typeof applyFilters === 'function') applyFilters(); else renderAdminOrders();
};

// ── QUICK STOCK UPDATE ───────────────────────────────────────────────────────
window.quickUpdateStock = function (productId, val) {
  const products = getProducts();
  const p = products.find(p => p.id === productId);
  if (!p) return;
  const stock = Math.max(0, parseInt(val) || 0);
  p.stock = stock;
  if (stock > 0) p.outOfStockReason = '';
  saveProducts(products);
  showToast(`${p.name}: stock updated to ${stock}`, 'success');
};

// ── BULK STATUS UPDATE ────────────────────────────────────────────────────────
window.bulkUpdateStatusAdmin = function (ids, newStatus) {
  if (!ids || !ids.length) { showToast('No orders selected', 'warning'); return; }
  const orders = getOrders();
  let reason = '';
  if (newStatus === 'Cancelled') {
    reason = window.prompt(`Reason for cancelling ${ids.length} order(s)?`, '') ;
    if (reason === null) return;
    reason = reason.trim() || 'Bulk cancelled by admin.';
  }
  ids.forEach(id => {
    const o = orders.find(o => o.id === id);
    if (!o) return;
    o.status = newStatus;
    if (newStatus === 'Cancelled') o.cancellationReason = reason;
    else o.cancellationReason = '';
  });
  saveOrders(orders);
  showToast(`${ids.length} order(s) marked as ${newStatus}`, 'success');
  if (typeof applyFilters === 'function') applyFilters(); else renderAdminOrders();
};

// ── EDIT ORDER ───────────────────────────────────────────────────────────────
let _editingOrderId = null;

window.openEditOrder = function (orderId) {
  const order = getOrders().find(o => o.id === orderId);
  if (!order) return;
  _editingOrderId = orderId;

  const c = order.customer || {};
  document.getElementById('oe-id-title').textContent  = orderId;
  document.getElementById('oe-name').value            = c.name || '';
  document.getElementById('oe-phone').value           = c.phone || '';
  document.getElementById('oe-address').value         = c.address || '';
  document.getElementById('oe-village').value         = c.village || '';
  document.getElementById('oe-district').value        = c.district || '';
  document.getElementById('oe-pin').value             = c.pin || '';
  document.getElementById('oe-payment').value         = c.paymentMethod || order.paymentMethod || 'Cash on Delivery';
  document.getElementById('oe-delivery').value        = order.delivery || 0;
  document.getElementById('oe-labour').value          = order.labour || 0;

  // Format date for datetime-local input (YYYY-MM-DDTHH:MM)
  const d = new Date(order.date);
  const pad = n => String(n).padStart(2, '0');
  const localDt = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  document.getElementById('oe-date').value = localDt;

  // Populate items
  const tbody = document.getElementById('oe-items-body');
  tbody.innerHTML = '';
  (order.items || []).forEach(item => _appendOrderEditRow(item.name, item.qty, item.price, tbody));

  recalcOrderEdit();
  document.getElementById('order-edit-overlay').classList.add('active');
};

window.closeOrderEdit = function () {
  document.getElementById('order-edit-overlay').classList.remove('active');
  _editingOrderId = null;
};

function _appendOrderEditRow(name, qty, price, tbody) {
  const tr = document.createElement('tr');
  tr.style.borderBottom = '1px solid var(--border)';
  tr.innerHTML = `
    <td style="padding:0.35rem 0.5rem">
      <input type="text" value="${name}" placeholder="Product name"
        style="width:100%;padding:0.35rem 0.5rem;border:1.5px solid var(--border);border-radius:6px;font-size:0.83rem;background:var(--bg);color:var(--text);font-family:var(--font)">
    </td>
    <td style="padding:0.35rem 0.5rem;text-align:center">
      <input type="number" value="${qty}" min="1" oninput="recalcOrderEdit()"
        style="width:60px;padding:0.35rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;text-align:center;font-size:0.83rem;background:var(--bg);color:var(--text);font-family:var(--font)">
    </td>
    <td style="padding:0.35rem 0.5rem;text-align:center">
      <input type="number" value="${price}" min="0" step="0.01" oninput="recalcOrderEdit()"
        style="width:80px;padding:0.35rem 0.4rem;border:1.5px solid var(--border);border-radius:6px;text-align:right;font-size:0.83rem;background:var(--bg);color:var(--text);font-family:var(--font)">
    </td>
    <td style="padding:0.35rem 0.5rem;text-align:center;font-weight:700;color:var(--primary);min-width:70px" class="oe-row-total">
      ₹${(qty * price).toLocaleString('en-IN')}
    </td>
    <td style="padding:0.35rem 0.3rem;text-align:center">
      <button type="button" onclick="this.closest('tr').remove();recalcOrderEdit()"
        style="background:none;border:none;cursor:pointer;color:var(--danger);font-size:1rem;line-height:1" title="Remove item">✕</button>
    </td>`;
  (tbody || document.getElementById('oe-items-body')).appendChild(tr);
}

window.addOrderEditItem = function () {
  _appendOrderEditRow('', 1, 0);
  recalcOrderEdit();
};

window.recalcOrderEdit = function () {
  let subtotal = 0;
  document.querySelectorAll('#oe-items-body tr').forEach(tr => {
    const inputs = tr.querySelectorAll('input[type="number"]');
    const qty   = parseFloat(inputs[0]?.value) || 0;
    const price = parseFloat(inputs[1]?.value) || 0;
    const rowTotal = qty * price;
    subtotal += rowTotal;
    const td = tr.querySelector('.oe-row-total');
    if (td) td.textContent = '₹' + rowTotal.toLocaleString('en-IN');
  });
  const delivery = parseFloat(document.getElementById('oe-delivery')?.value) || 0;
  const labour   = parseFloat(document.getElementById('oe-labour')?.value) || 0;
  document.getElementById('oe-subtotal-display').textContent = '₹' + subtotal.toLocaleString('en-IN');
  document.getElementById('oe-total-display').textContent    = '₹' + (subtotal + delivery + labour).toLocaleString('en-IN');
};

window.saveOrderEdit = function () {
  if (!_editingOrderId) return;
  const orders = getOrders();
  const idx = orders.findIndex(o => o.id === _editingOrderId);
  if (idx === -1) return;

  const order = orders[idx];
  order.customer = {
    ...order.customer,
    name:          document.getElementById('oe-name').value.trim(),
    phone:         document.getElementById('oe-phone').value.trim(),
    address:       document.getElementById('oe-address').value.trim(),
    village:       document.getElementById('oe-village').value.trim(),
    district:      document.getElementById('oe-district').value.trim(),
    pin:           document.getElementById('oe-pin').value.trim(),
    paymentMethod: document.getElementById('oe-payment').value
  };
  order.paymentMethod = document.getElementById('oe-payment').value;
  order.date          = new Date(document.getElementById('oe-date').value).toISOString();

  // Rebuild items
  const items = [];
  document.querySelectorAll('#oe-items-body tr').forEach(tr => {
    const nameEl  = tr.querySelector('input[type="text"]');
    const numInps = tr.querySelectorAll('input[type="number"]');
    const name    = nameEl?.value.trim() || '';
    const qty     = parseFloat(numInps[0]?.value) || 0;
    const price   = parseFloat(numInps[1]?.value) || 0;
    if (name && qty > 0) items.push({ name, qty, price, total: qty * price });
  });
  order.items    = items;
  order.subtotal = items.reduce((s, i) => s + i.total, 0);
  order.delivery = parseFloat(document.getElementById('oe-delivery').value) || 0;
  order.labour   = parseFloat(document.getElementById('oe-labour').value) || 0;
  order.total    = order.subtotal + order.delivery + order.labour;

  orders[idx] = order;
  saveOrders(orders);
  showToast(`Order ${_editingOrderId} updated`, 'success');
  closeOrderEdit();
  if (typeof applyFilters === 'function') applyFilters(); else renderAdminOrders();
};

// ── BULK STATUS UPDATE ─────────────────────────────────────────────────────
window.bulkUpdateStatusAdmin = function (ids, newStatus) {
  if (!ids.length || !newStatus) return;
  const orders = getOrders();
  const updated = [];
  orders.forEach(o => {
    if (ids.includes(o.id)) { o.status = newStatus; updated.push(o); }
  });
  saveOrders(orders);
  showToast(updated.length + ' order' + (updated.length !== 1 ? 's' : '') + ' updated to "' + newStatus + '"', 'success');
  if (typeof clearBulkSelection === 'function') clearBulkSelection();
  if (typeof applyFilters === 'function') applyFilters(); else renderAdminOrders();
  // Show WhatsApp notify panel if the function is available on this page
  if (typeof showBulkNotifyModal === 'function') showBulkNotifyModal(updated, newStatus);
};

// ── SIDEBAR TOGGLE (mobile) ────────────────────────────────────────────────
window.toggleAdminSidebar = function () {
  const sidebar = document.querySelector('.admin-sidebar');
  if (!sidebar) return;
  const isOpen = sidebar.classList.toggle('open');

  // Add/remove backdrop
  let backdrop = document.getElementById('sidebar-backdrop');
  if (isOpen) {
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'sidebar-backdrop';
      backdrop.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.45);z-index:199;';
      backdrop.addEventListener('click', () => toggleAdminSidebar());
      document.body.appendChild(backdrop);
    }
  } else if (backdrop) {
    backdrop.remove();
  }
};

// ── INIT ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  const page = window.location.pathname.split('/').pop().replace(/\.html$/, '');

  if (page === 'admin' || page === '') {
    initLoginPage();
    return;
  }

  // All other admin pages require auth
  if (!isAdminLoggedIn()) {
    window.location.href = '../admin/admin.html';
    return;
  }

  // Sync from Google Sheets before rendering (no-op if SHEETS_URL not set)
  await syncFromSheets();

  // New order badge
  const _orderCount = getOrders().length;
  if (page === 'orders') {
    Store.set('bm_last_seen_orders', _orderCount);
  } else {
    const _lastSeen = parseInt(Store.get('bm_last_seen_orders', _orderCount) || _orderCount);
    const _newCount = _orderCount - _lastSeen;
    if (_newCount > 0) {
      const _ordersLink = document.querySelector('a[href="orders.html"], a[href="../admin/orders.html"]');
      if (_ordersLink) {
        _ordersLink.innerHTML += `<span style="background:#e74c3c;color:white;font-size:0.65rem;font-weight:800;padding:1px 6px;border-radius:10px;margin-left:0.4rem;vertical-align:middle">${_newCount}</span>`;
      }
    }
  }

  // Logout buttons
  document.querySelectorAll('.admin-logout').forEach(btn => {
    btn.addEventListener('click', adminLogout);
  });

  // Admin search inputs (products / customers pages only — orders page handles its own filters)
  const searchInput = document.getElementById('admin-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (page === 'products' || document.getElementById('admin-products-table')) renderAdminProducts(val);
      else if (document.getElementById('customers-table')) renderCustomers(val);
    });
  }

  // Status filter (orders page — legacy dropdown, kept for safety)
  const statusFilter = document.getElementById('order-status-filter');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      renderAdminOrders({ status: e.target.value });
    });
  }
  // Page init
  if (document.getElementById('stat-total-orders')) initDashboard();
  if (document.getElementById('admin-products-table')) initProductManagement();
  if (document.getElementById('admin-orders-table')) initOrderManagement();
  if (document.getElementById('customers-table')) initCustomerList();
  if (document.getElementById('daily-revenue-chart')) initReports();
});
