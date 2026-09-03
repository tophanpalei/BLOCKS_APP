// ── HELPERS ──────────────────────────────────────────────────────────────────
function buildCustomerMap() {
  const phoneMap = {};
  getOrders().forEach(o => {
    const p = o.customer.phone;
    if (!phoneMap[p]) {
      phoneMap[p] = {
        name:           o.customer.name,
        phone:          p,
        address:        o.customer.address  || '',
        village:        o.customer.village  || '',
        district:       o.customer.district || '',
        pin:            o.customer.pin      || '',
        paymentMethods: new Set(),
        totalOrders:    0,
        totalSpent:     0,
        lastOrderDate:  o.date
      };
    }
    const cm = phoneMap[p];
    cm.totalOrders++;
    if (o.status !== 'Cancelled') cm.totalSpent += o.total;
    if (o.customer.paymentMethod) cm.paymentMethods.add(o.customer.paymentMethod);
    if (o.date > cm.lastOrderDate) cm.lastOrderDate = o.date;
  });
  return Object.values(phoneMap);
}

// ── RENDER ────────────────────────────────────────────────────────────────────
function renderCustomersAdvanced(filters = {}) {
  const container = document.getElementById('customers-table');
  if (!container) return;

  let customers = buildCustomerMap();

  const { search, district, minOrders, sortBy, dateFrom, dateTo } = filters;

  if (search) {
    const q = search.toLowerCase();
    customers = customers.filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }
  if (district) {
    customers = customers.filter(c => c.district.toLowerCase() === district.toLowerCase());
  }
  if (minOrders && parseInt(minOrders) > 0) {
    customers = customers.filter(c => c.totalOrders >= parseInt(minOrders));
  }
  if (dateFrom || dateTo) {
    const from = dateFrom ? new Date(dateFrom) : null;
    const to   = dateTo   ? new Date(dateTo + 'T23:59:59') : null;
    const allOrders = getOrders();
    customers = customers.filter(c => {
      return allOrders.some(o => {
        if (o.customer.phone !== c.phone) return false;
        const od = new Date(o.date);
        if (from && od < from) return false;
        if (to   && od > to)   return false;
        return true;
      });
    });
  }

  const sort = sortBy || 'spent_desc';
  if      (sort === 'spent_desc')  customers.sort((a, b) => b.totalSpent   - a.totalSpent);
  else if (sort === 'spent_asc')   customers.sort((a, b) => a.totalSpent   - b.totalSpent);
  else if (sort === 'orders_desc') customers.sort((a, b) => b.totalOrders  - a.totalOrders);
  else if (sort === 'name_asc')    customers.sort((a, b) => a.name.localeCompare(b.name));
  else if (sort === 'recent')      customers.sort((a, b) => new Date(b.lastOrderDate) - new Date(a.lastOrderDate));

  if (customers.length === 0) {
    container.innerHTML = `<div class="no-results"><div class="no-results-icon">👥</div><p>No customers found</p></div>`;
    return;
  }

  container.innerHTML = `
    <div style="padding:0.5rem 1.25rem;font-size:0.8rem;color:var(--text-muted)">${customers.length} customer${customers.length !== 1 ? 's' : ''} found</div>
    <table class="admin-table">
      <thead><tr>
        <th>#</th>
        <th>Customer Name</th>
        <th>Phone</th>
        <th>District</th>
        <th>Total Orders</th>
        <th>Total Spent</th>
        <th>Last Order</th>
        <th>Payment</th>
        <th>Details</th>
      </tr></thead>
      <tbody>
        ${customers.map((c, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><strong>${c.name}</strong></td>
            <td>${c.phone}</td>
            <td>${c.district || '—'}</td>
            <td>${c.totalOrders} order${c.totalOrders !== 1 ? 's' : ''}</td>
            <td><strong style="color:var(--primary)">${formatRupees(c.totalSpent)}</strong></td>
            <td style="font-size:0.82rem;color:var(--text-muted)">${c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'}) : '—'}</td>
            <td style="font-size:0.82rem">${[...c.paymentMethods].join(', ') || 'N/A'}</td>
            <td><button class="btn-action btn-edit" onclick="showCustomerDetail('${c.phone}')">👤 View</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

// ── FILTERS ───────────────────────────────────────────────────────────────────
window.applyCustomerFilters = function() {
  renderCustomersAdvanced({
    search:    document.getElementById('cust-search')?.value.trim()  || '',
    district:  document.getElementById('cust-district')?.value       || '',
    minOrders: document.getElementById('cust-min-orders')?.value     || '',
    sortBy:    document.getElementById('cust-sort')?.value           || 'spent_desc',
    dateFrom:  document.getElementById('cust-date-from')?.value      || '',
    dateTo:    document.getElementById('cust-date-to')?.value        || ''
  });
};

window.resetCustomerFilters = function() {
  const s  = document.getElementById('cust-search');
  const d  = document.getElementById('cust-district');
  const m  = document.getElementById('cust-min-orders');
  const r  = document.getElementById('cust-sort');
  const df = document.getElementById('cust-date-from');
  const dt = document.getElementById('cust-date-to');
  if (s)  s.value  = '';
  if (d)  d.value  = '';
  if (m)  m.value  = '';
  if (r)  r.value  = 'spent_desc';
  if (df) df.value = '';
  if (dt) dt.value = '';
  applyCustomerFilters();
};

// ── EXCEL DOWNLOAD ────────────────────────────────────────────────────────────
window.downloadCustomersExcel = function() {
  const customers = buildCustomerMap();
  customers.sort((a, b) => b.totalSpent - a.totalSpent);

  const esc = v => `"${String(v).replace(/"/g, '""')}"`;
  const rows = [
    ['#', 'Name', 'Phone', 'Address', 'Village', 'District', 'PIN', 'Total Orders', 'Total Spent (₹)', 'Last Order', 'Payment Methods'].join(','),
    ...customers.map((c, i) => [
      i + 1,
      esc(c.name),
      c.phone,
      esc(c.address),
      esc(c.village),
      esc(c.district),
      c.pin,
      c.totalOrders,
      c.totalSpent,
      c.lastOrderDate ? new Date(c.lastOrderDate).toLocaleDateString('en-IN') : '',
      esc([...c.paymentMethods].join(', '))
    ].join(','))
  ];

  const blob = new Blob(['﻿' + rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'customers_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// ── CUSTOMER DETAIL MODAL ─────────────────────────────────────────────────────
window.showCustomerDetail = function(phone) {
  const orders = getOrders().filter(o => o.customer.phone === phone);
  if (!orders.length) return;
  const c = orders[0].customer;

  document.getElementById('cd-name').textContent     = c.name;
  document.getElementById('cd-phone').textContent    = c.phone;
  document.getElementById('cd-address').textContent  = c.address  || '—';
  document.getElementById('cd-village').textContent  = c.village  || '—';
  document.getElementById('cd-district').textContent = c.district || '—';
  document.getElementById('cd-pin').textContent      = c.pin      || '—';

  const statusIcons = { Pending: '⏳', Confirmed: '✅', Delivered: '🏠', Cancelled: '❌' };

  document.getElementById('cd-orders').innerHTML = orders.map(o => `
    <div style="border:1px solid var(--border);border-radius:var(--radius-sm);margin-bottom:0.8rem;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:0.7rem 1rem;background:var(--bg);flex-wrap:wrap;gap:0.5rem">
        <div>
          <span style="font-weight:800;color:var(--primary)">${o.id}</span>
          <span style="font-size:0.78rem;color:var(--text-muted);margin-left:0.6rem">${new Date(o.date).toLocaleDateString('en-IN', {day:'numeric', month:'short', year:'numeric'})}</span>
        </div>
        <div style="display:flex;gap:0.6rem;align-items:center">
          <span class="status-badge status-${o.status.toLowerCase()}">${statusIcons[o.status] || ''} ${o.status}</span>
          <span style="font-weight:800;color:var(--primary)">${formatRupees(o.total)}</span>
        </div>
      </div>
      <div style="padding:0.6rem 1rem">
        ${o.items.map(item => `<div style="font-size:0.85rem;display:flex;justify-content:space-between;padding:0.25rem 0;border-bottom:1px solid var(--border)"><span>${item.name} × ${item.qty}</span><span style="font-weight:700">${formatRupees(item.total)}</span></div>`).join('')}
        <div style="font-size:0.82rem;color:var(--text-muted);margin-top:0.4rem">Payment: <strong>${o.customer.paymentMethod || 'N/A'}</strong></div>
      </div>
    </div>`).join('');

  document.getElementById('customer-modal-overlay').style.display = 'block';
  document.body.style.overflow = 'hidden';
};

window.closeCustomerDetail = function() {
  document.getElementById('customer-modal-overlay').style.display = 'none';
  document.body.style.overflow = '';
};

// ── INIT ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Populate district dropdown from live data
  const districtSel = document.getElementById('cust-district');
  if (districtSel) {
    const districts = [...new Set(
      getOrders()
        .map(o => o.customer.district)
        .filter(Boolean)
        .map(d => d.trim())
    )].sort();
    districts.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      districtSel.appendChild(opt);
    });
  }

  // Initial render (overrides the basic renderCustomers from admin.js)
  renderCustomersAdvanced({ sortBy: 'spent_desc' });

  // Close modal on backdrop click
  const overlay = document.getElementById('customer-modal-overlay');
  if (overlay) {
    overlay.addEventListener('click', e => { if (e.target === overlay) closeCustomerDetail(); });
  }
});
