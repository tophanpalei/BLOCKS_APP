  let activeTab = 'id';

  let _lastPhoneQuery = '';

  function switchTab(tab) {
    activeTab = tab;
    document.getElementById('tab-id').classList.toggle('active', tab === 'id');
    document.getElementById('tab-phone').classList.toggle('active', tab === 'phone');
    document.getElementById('input-id-wrap').style.display = tab === 'id' ? 'block' : 'none';
    document.getElementById('input-phone-wrap').style.display = tab === 'phone' ? 'block' : 'none';
    document.getElementById('track-result').innerHTML = '';
  }

  // ── Status progress config ────────────────────────────────────────────────
  const STATUS_STEPS = ['Pending', 'Confirmed', 'Delivered'];

  function stepIndex(status) {
    if (status === 'Cancelled') return -1;
    return STATUS_STEPS.indexOf(status);
  }

  function buildProgressBar(status, cancelReason) {
    const idx = stepIndex(status);
    const isCancelled = status === 'Cancelled';

    const steps = [
      { label: 'Order\nPlaced', icon: '📋' },
      { label: 'Confirmed', icon: '✅' },
      { label: 'Out for\nDelivery', icon: '🚚' },
      { label: 'Delivered', icon: '🏠' },
    ];

    const statusToStep = { Pending: 0, Confirmed: 1, Delivered: 3 };
    const currentStep = isCancelled ? -1 : (statusToStep[status] ?? 0);
    const fillPct = isCancelled ? 0 : Math.round((currentStep / (steps.length - 1)) * 100);

    if (isCancelled) {
      const reasonHtml = cancelReason
        ? `<div style="font-size:0.85rem;color:var(--danger);margin-top:0.5rem;font-weight:600">Reason: ${cancelReason}</div>`
        : `<div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.2rem">This order has been cancelled</div>`;
      return `
        <div style="text-align:center;padding:1rem 0">
          <div style="display:inline-flex;align-items:flex-start;gap:0.7rem;background:rgba(231,76,60,0.1);border:1.5px solid rgba(231,76,60,0.3);border-radius:10px;padding:0.8rem 1.5rem;text-align:left">
            <span style="font-size:1.5rem;flex-shrink:0">❌</span>
            <div>
              <div style="font-weight:800;color:var(--danger);font-size:1rem">Order Cancelled</div>
              ${reasonHtml}
            </div>
          </div>
        </div>`;
    }

    const stepsHtml = steps.map((s, i) => {
      let circleClass = '';
      let labelClass = '';
      if (i < currentStep) { circleClass = 'done'; }
      else if (i === currentStep) { circleClass = 'current'; labelClass = 'active'; }
      return `
        <div class="progress-step">
          <div class="step-circle ${circleClass}">${i <= currentStep ? (i < currentStep ? '✓' : s.icon) : s.icon}</div>
          <div class="step-label ${labelClass}">${s.label.replace('\n', '<br>')}</div>
        </div>`;
    }).join('');

    return `
      <div class="progress-steps">
        <div class="progress-fill" style="width:calc(${fillPct}% - 40px)"></div>
        ${stepsHtml}
      </div>`;
  }

  // ── Render single order detail ────────────────────────────────────────────
  function renderOrderDetail(order) {
    const statusColors = {
      Pending: 'var(--warning)', Confirmed: 'var(--info)',
      Delivered: 'var(--success)', Cancelled: 'var(--danger)'
    };
    const statusIcons = { Pending: '⏳', Confirmed: '✅', Delivered: '🏠', Cancelled: '❌' };
    const color = statusColors[order.status] || 'var(--text)';
    const icon = statusIcons[order.status] || '📦';

    const itemsHtml = order.items.map(item => `
      <div class="order-item-row">
        <div>
          <div class="order-item-name">${item.name}</div>
          <div class="order-item-qty">${item.qty} × ${formatRupees(item.price)}</div>
        </div>
        <div class="order-item-price">${formatRupees(item.total)}</div>
      </div>`).join('');

    const delivery = order.total >= 5000 ? 'Free' : formatRupees(299);

    const delivDate = order.customer.deliveryDate
      ? (() => { try { return new Date(order.customer.deliveryDate).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'}); } catch { return order.customer.deliveryDate; } })()
      : getEstimatedDelivery(5);

    return `
      <div class="order-result-card">
        <div class="order-result-header">
          <div>
            <div class="order-result-id">${order.id}</div>
            <div class="order-result-date">Placed on ${new Date(order.date).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</div>
          </div>
          <div style="background:rgba(255,255,255,0.15);border-radius:20px;padding:0.4rem 1rem;display:flex;align-items:center;gap:0.4rem;font-weight:800;font-size:0.95rem">
            ${icon} ${order.status}
          </div>
        </div>

        <div class="order-progress">
          <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:1.2rem">Order Progress</div>
          ${buildProgressBar(order.status, order.cancellationReason)}
        </div>

        <div class="order-result-body">
          <div class="order-info-grid">
            <div class="order-info-box">
              <div class="order-info-label">Customer</div>
              <div class="order-info-value">${order.customer.name}</div>
            </div>
            <div class="order-info-box">
              <div class="order-info-label">Phone</div>
              <div class="order-info-value">${order.customer.phone}</div>
            </div>
            <div class="order-info-box" style="grid-column:1/-1">
              <div class="order-info-label">Delivery Address</div>
              <div class="order-info-value" style="font-size:0.88rem;font-weight:600">${order.customer.address}, ${order.customer.village}, ${order.customer.district} — ${order.customer.pin}</div>
            </div>
            <div class="order-info-box">
              <div class="order-info-label">Payment</div>
              <div class="order-info-value">${order.customer.paymentMethod || 'N/A'}</div>
            </div>
            <div class="order-info-box">
              <div class="order-info-label">Est. Delivery</div>
              <div class="order-info-value" style="color:var(--success)">${delivDate}</div>
            </div>
          </div>

          <div style="font-size:0.8rem;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:var(--text-muted);margin-bottom:0.8rem">Items Ordered</div>
          <div class="order-items-list">
            ${itemsHtml}
            <div class="order-total-row">
              <span>Delivery</span><span>${delivery}</span>
            </div>
            <div class="order-total-row">
              <span>Grand Total</span><span>${formatRupees(order.total)}</span>
            </div>
          </div>

          <div style="display:flex;gap:0.8rem;margin-top:1.5rem;flex-wrap:wrap">
            <a href="../products/products.html" class="btn-primary" style="font-size:0.9rem;padding:0.65rem 1.4rem">🛒 Order Again</a>
            ${order.status === 'Delivered' ? `
            <button onclick="downloadInvoice('${order.id}')"
              style="background:var(--success,#27ae60);border:none;color:#fff;padding:0.65rem 1.4rem;border-radius:30px;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:0.4rem;cursor:pointer">
              📄 Download Invoice
            </button>` : ''}
            ${order.status === 'Pending' ? `
            <button onclick="showCancelForm('${order.id}')" id="btn-cancel-${order.id}"
              style="background:#fff;border:1.5px solid var(--danger,#e74c3c);color:var(--danger,#e74c3c);padding:0.65rem 1.4rem;border-radius:30px;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:0.4rem;cursor:pointer">
              ❌ Cancel Order
            </button>` : ''}
            <a href="https://wa.me/919876543210?text=Hi%2C%20I%20have%20a%20query%20about%20order%20${order.id}"
               target="_blank"
               style="background:var(--bg);border:1.5px solid var(--border);color:var(--text);padding:0.65rem 1.4rem;border-radius:30px;font-weight:700;font-size:0.9rem;display:flex;align-items:center;gap:0.4rem">
              💬 WhatsApp Support
            </a>
          </div>
          <div id="cancel-form-${order.id}" style="display:none;margin-top:1.2rem;background:rgba(231,76,60,0.06);border:1.5px solid rgba(231,76,60,0.3);border-radius:10px;padding:1.2rem">
            <div style="font-weight:700;color:var(--danger,#e74c3c);margin-bottom:0.6rem;font-size:0.95rem">⚠️ Cancel this order?</div>
            <p style="font-size:0.85rem;color:var(--text-muted);margin-bottom:0.8rem">This action cannot be undone. Please provide a reason (optional).</p>
            <textarea id="cancel-reason-${order.id}" rows="2" placeholder="e.g. Changed my mind, ordered by mistake..."
              style="width:100%;padding:0.6rem 0.8rem;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.88rem;font-family:var(--font);resize:none;box-sizing:border-box;margin-bottom:0.8rem"></textarea>
            <div style="display:flex;gap:0.7rem">
              <button onclick="confirmCancelOrder('${order.id}')"
                style="background:var(--danger,#e74c3c);border:none;color:#fff;padding:0.6rem 1.3rem;border-radius:30px;font-weight:700;font-size:0.88rem;cursor:pointer">
                Yes, Cancel Order
              </button>
              <button onclick="hideCancelForm('${order.id}')"
                style="background:var(--bg);border:1.5px solid var(--border);color:var(--text);padding:0.6rem 1.3rem;border-radius:30px;font-weight:700;font-size:0.88rem;cursor:pointer">
                Keep Order
              </button>
            </div>
          </div>
        </div>
      </div>`;
  }

  // ── Render mini card list (multiple orders for same phone) ────────────────
  function renderOrderList(orders) {
    return `
      <div style="font-size:0.88rem;color:var(--text-muted);margin-bottom:1rem;text-align:center">
        Found <strong>${orders.length}</strong> order${orders.length > 1 ? 's' : ''} — click one to view details
      </div>
      <div class="orders-list">
        ${orders.map(o => {
          const statusIcons = { Pending:'⏳', Confirmed:'✅', Delivered:'🏠', Cancelled:'❌' };
          return `
            <div class="mini-order-card" onclick="showSingleOrder('${o.id}')">
              <div class="mini-order-left">
                <h4>${o.id}</h4>
                <p>${o.items.map(i => i.name).join(', ').substring(0, 50)}${o.items.map(i=>i.name).join(', ').length > 50 ? '...' : ''}</p>
                <p style="margin-top:0.3rem">${new Date(o.date).toLocaleDateString('en-IN', {day:'numeric',month:'short',year:'numeric'})}</p>
              </div>
              <div style="display:flex;flex-direction:column;align-items:flex-end;gap:0.4rem">
                <span class="status-badge status-${o.status.toLowerCase()}">${statusIcons[o.status]} ${o.status}</span>
                <span style="font-weight:800;color:var(--primary)">${formatRupees(o.total)}</span>
              </div>
            </div>`;
        }).join('')}
      </div>`;
  }

  // ── Normalise phone: keep digits only ────────────────────────────────────
  function normalisePhone(val) {
    return val.replace(/\D/g, '');
  }

  // ── Track order ───────────────────────────────────────────────────────────
  function trackOrder() {
    const resultEl = document.getElementById('track-result');

    if (activeTab === 'id') {
      const raw = document.getElementById('search-order-id').value.trim().toUpperCase();
      if (!raw) { showToast('Please enter an Order ID', 'warning'); return; }

      const order = getOrders().find(o => o.id === raw);
      if (!order) {
        resultEl.innerHTML = `
          <div style="text-align:center;max-width:560px;margin:0 auto;padding:2rem;background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border)">
            <div style="font-size:3rem;margin-bottom:1rem">🔎</div>
            <h3 style="margin-bottom:0.5rem">Order Not Found</h3>
            <p style="color:var(--text-muted)">No order found with ID <strong>${raw}</strong>. Please check and try again.</p>
          </div>`;
        return;
      }
      resultEl.innerHTML = renderOrderDetail(order);

    } else {
      const raw = document.getElementById('search-phone').value.trim();
      if (!raw) { showToast('Please enter a mobile number', 'warning'); return; }
      const phoneQuery = normalisePhone(raw);
      if (phoneQuery.length < 10) { showToast('Please enter a valid 10-digit mobile number', 'warning'); return; }
      _lastPhoneQuery = phoneQuery;

      const orders = getOrders().filter(o => normalisePhone(o.customer.phone || '').includes(phoneQuery));
      if (orders.length === 0) {
        resultEl.innerHTML = `
          <div style="text-align:center;max-width:560px;margin:0 auto;padding:2rem;background:var(--card-bg);border-radius:var(--radius);box-shadow:var(--shadow);border:1px solid var(--border)">
            <div style="font-size:3rem;margin-bottom:1rem">🔎</div>
            <h3 style="margin-bottom:0.5rem">No Orders Found</h3>
            <p style="color:var(--text-muted)">No orders found for mobile number <strong>${raw}</strong>.</p>
          </div>`;
        return;
      }
      if (orders.length === 1) {
        resultEl.innerHTML = renderOrderDetail(orders[0]);
      } else {
        resultEl.innerHTML = renderOrderList(orders);
      }
    }

    document.getElementById('track-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // ── Drill into a single order from the list ───────────────────────────────
  function showSingleOrder(orderId) {
    const order = getOrders().find(o => o.id === orderId);
    if (!order) return;
    document.getElementById('track-result').innerHTML = `
      <button onclick="goBackToList()" style="display:flex;align-items:center;gap:0.4rem;background:none;border:none;color:var(--primary);font-weight:700;font-size:0.9rem;cursor:pointer;margin-bottom:1rem;font-family:var(--font)">
        ← Back to all orders
      </button>
      ${renderOrderDetail(order)}`;
    document.getElementById('track-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goBackToList() {
    const orders = getOrders().filter(o => normalisePhone(o.customer.phone || '').includes(_lastPhoneQuery));
    document.getElementById('track-result').innerHTML = renderOrderList(orders);
  }

  // ── Customer cancel order (Pending only) ─────────────────────────────────
  function showCancelForm(orderId) {
    document.getElementById('cancel-form-' + orderId).style.display = 'block';
    document.getElementById('btn-cancel-' + orderId).style.display = 'none';
  }

  function hideCancelForm(orderId) {
    document.getElementById('cancel-form-' + orderId).style.display = 'none';
    document.getElementById('btn-cancel-' + orderId).style.display = 'flex';
  }

  function confirmCancelOrder(orderId) {
    const reason = document.getElementById('cancel-reason-' + orderId).value.trim();
    const orders = getOrders();
    const idx = orders.findIndex(o => o.id === orderId);
    if (idx === -1) return;

    if (orders[idx].status !== 'Pending') {
      showToast('This order can no longer be cancelled.', 'warning');
      return;
    }

    orders[idx].status = 'Cancelled';
    orders[idx].cancellationReason = reason || 'Cancelled by customer';
    orders[idx].cancelledAt = new Date().toISOString();
    saveOrders(orders);

    showToast('Order ' + orderId + ' has been cancelled.', 'success');

    // Re-render the updated order card
    const resultEl = document.getElementById('track-result');
    const backBtn = resultEl.querySelector('button[onclick="goBackToList()"]');
    const updatedOrder = orders[idx];
    if (backBtn) {
      resultEl.innerHTML =
        '<button onclick="goBackToList()" style="display:flex;align-items:center;gap:0.4rem;background:none;border:none;color:var(--primary);font-weight:700;font-size:0.9rem;cursor:pointer;margin-bottom:1rem;font-family:var(--font)">← Back to all orders</button>' +
        renderOrderDetail(updatedOrder);
    } else {
      resultEl.innerHTML = renderOrderDetail(updatedOrder);
    }
  }

  // ── Download invoice (Delivered orders only) ─────────────────────────────
  function downloadInvoice(orderId) {
    const order = getOrders().find(o => o.id === orderId);
    if (!order) return;
    const s = getSettings();
    const c = order.customer || {};

    const delivDate = c.deliveryDate
      ? (() => { try { return new Date(c.deliveryDate).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'}); } catch { return c.deliveryDate; } })()
      : new Date(order.date).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'});

    const address = [c.address, c.village, c.district, c.pin].filter(Boolean).join(', ');
    const subtotal = order.subtotal || order.total || 0;
    const delivery = order.delivery === 0 ? 0 : (order.delivery || 0);
    const labour = order.labour || 0;

    const itemRows = (order.items || []).map((item, i) => `
      <tr>
        <td style="padding:0.6rem 0.8rem;border-bottom:1px solid #eee;text-align:center">${i + 1}</td>
        <td style="padding:0.6rem 0.8rem;border-bottom:1px solid #eee">${item.name}</td>
        <td style="padding:0.6rem 0.8rem;border-bottom:1px solid #eee;text-align:center">${item.qty}</td>
        <td style="padding:0.6rem 0.8rem;border-bottom:1px solid #eee;text-align:right">₹${(item.price||0).toLocaleString('en-IN')}</td>
        <td style="padding:0.6rem 0.8rem;border-bottom:1px solid #eee;text-align:right;font-weight:600">₹${(item.total||0).toLocaleString('en-IN')}</td>
      </tr>`).join('');

    const w = window.open('', '_blank', 'width=750,height=950');
    if (!w) { showToast('Please allow pop-ups to download the invoice', 'warning'); return; }

    w.document.write(`<!DOCTYPE html>
<html><head>
<meta charset="UTF-8">
<title>Invoice ${order.id}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 0.88rem; color: #333; background: #fff; padding: 2rem; }
  .inv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 2rem; padding-bottom: 1.2rem; border-bottom: 3px solid #e65c00; }
  .brand-name { font-size: 1.6rem; font-weight: 900; color: #e65c00; }
  .brand-sub { font-size: 0.8rem; color: #888; margin-top: 0.15rem; }
  .brand-contact { font-size: 0.82rem; color: #555; margin-top: 0.4rem; line-height: 1.6; }
  .inv-title { text-align: right; }
  .inv-title h2 { font-size: 1.6rem; font-weight: 900; color: #e65c00; letter-spacing: 2px; }
  .inv-title .inv-no { font-size: 0.85rem; color: #555; margin-top: 0.4rem; }
  .inv-title .inv-date { font-size: 0.82rem; color: #777; margin-top: 0.2rem; }
  .inv-status { display: inline-block; background: #e8f8ef; color: #27ae60; font-weight: 800; font-size: 0.82rem; padding: 0.2rem 0.7rem; border-radius: 20px; border: 1px solid #27ae60; margin-top: 0.4rem; }
  .bill-section { display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 1.8rem; }
  .bill-box { background: #f9f9f9; border-radius: 8px; padding: 1rem; }
  .bill-box h4 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.5px; color: #999; margin-bottom: 0.6rem; }
  .bill-box p { font-size: 0.88rem; color: #333; line-height: 1.7; }
  .bill-box strong { color: #111; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }
  thead tr { background: #e65c00; color: #fff; }
  thead th { padding: 0.7rem 0.8rem; font-size: 0.82rem; text-align: left; }
  thead th:nth-child(3), thead th:nth-child(4), thead th:nth-child(5) { text-align: center; }
  thead th:nth-child(4), thead th:nth-child(5) { text-align: right; }
  tbody tr:hover { background: #fdf5f0; }
  .totals { margin-left: auto; width: 280px; }
  .totals-row { display: flex; justify-content: space-between; padding: 0.35rem 0; font-size: 0.88rem; border-bottom: 1px solid #eee; }
  .totals-row.grand { border-top: 2px solid #e65c00; border-bottom: none; margin-top: 0.4rem; padding-top: 0.6rem; font-weight: 900; font-size: 1rem; color: #e65c00; }
  .footer-note { margin-top: 2rem; text-align: center; font-size: 0.8rem; color: #aaa; border-top: 1px solid #eee; padding-top: 1rem; }
  @media print {
    body { padding: 1rem; }
    button { display: none !important; }
  }
</style>
</head><body>

<div class="inv-header">
  <div>
    <div class="brand-name">🧱 ${s.storeName || 'BuildMate'}</div>
    <div class="brand-sub">Blocks &amp; Bricks</div>
    <div class="brand-contact">
      ${s.address || ''}, ${s.city || ''}<br>
      📞 ${s.phone1 || ''}&nbsp;&nbsp;✉️ ${s.email || ''}
    </div>
  </div>
  <div class="inv-title">
    <h2>INVOICE</h2>
    <div class="inv-no">Invoice # &nbsp;<strong>${order.id}</strong></div>
    <div class="inv-date">Order Date: ${new Date(order.date).toLocaleDateString('en-IN', {day:'numeric',month:'long',year:'numeric'})}</div>
    <div class="inv-date">Delivered: ${delivDate}</div>
    <div><span class="inv-status">✅ Delivered</span></div>
  </div>
</div>

<div class="bill-section">
  <div class="bill-box">
    <h4>Bill To</h4>
    <p>
      <strong>${c.name || '—'}</strong><br>
      📞 ${c.phone || '—'}<br>
      ${address || '—'}<br>
      Payment: ${c.paymentMethod || 'N/A'}
    </p>
  </div>
  <div class="bill-box">
    <h4>Invoice Summary</h4>
    <p>
      <strong>Invoice No:</strong> ${order.id}<br>
      <strong>Items:</strong> ${(order.items||[]).length}<br>
      <strong>Total Amount:</strong> <span style="color:#e65c00;font-weight:900">₹${(order.total||0).toLocaleString('en-IN')}</span>
    </p>
  </div>
</div>

<table>
  <thead>
    <tr>
      <th style="width:40px">#</th>
      <th>Description</th>
      <th style="width:70px;text-align:center">Qty</th>
      <th style="width:100px;text-align:right">Unit Price</th>
      <th style="width:110px;text-align:right">Amount</th>
    </tr>
  </thead>
  <tbody>
    ${itemRows}
  </tbody>
</table>

<div class="totals">
  <div class="totals-row"><span>Subtotal</span><span>₹${subtotal.toLocaleString('en-IN')}</span></div>
  <div class="totals-row"><span>Delivery Charges</span><span>${delivery === 0 ? 'Free 🎉' : '₹' + delivery.toLocaleString('en-IN')}</span></div>
  ${labour > 0 ? `<div class="totals-row"><span>Labour (Loading/Unloading)</span><span>₹${labour.toLocaleString('en-IN')}</span></div>` : ''}
  <div class="totals-row grand"><span>Grand Total</span><span>₹${(order.total||0).toLocaleString('en-IN')}</span></div>
</div>

<div class="footer-note">
  Thank you for choosing ${s.storeName || 'BuildMate'}! &nbsp;|&nbsp; ${s.phone1 || ''} &nbsp;|&nbsp; This is a computer-generated invoice.
</div>

<script>window.onload = function(){ window.print(); }<\/script>
<\/body><\/html>`);
    w.document.close();
  }

  // ── Pre-fill from URL param (?id=BM10001) ────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const id = params.get('id');
    if (id) {
      document.getElementById('search-order-id').value = id.toUpperCase();
      trackOrder();
    }
  });
